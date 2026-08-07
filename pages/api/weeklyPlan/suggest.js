import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import User from '../../../models/User';
import IngredientConversion from '../../../models/IngredientConversion';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { calculateDailyIntake, NUTRIENT_LABELS } from '../../../lib/dailyIntake';
import { buildDietaryConstraints } from '../../../lib/dietaryRules';
import { computeDayNutrients, computeRecipeNutrientTotals, computePlainIngredientNutrients } from '../../../lib/planNutrition';
import { callGroqChat } from '../../../lib/ai';

const PLANNER_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const CATALOG_LIMIT = 150;
const PANTRY_LIMIT = 40;

export default async function handler(req, res) {
    logAPI(req);
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();

    try {
        const { plan, day } = req.body;
        if (!plan || !day) {
            return res.status(400).json({ success: false, message: 'plan and day are required' });
        }

        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const profile = {
            age: user.age,
            gender: user.gender,
            weight_kg: user.weight_kg,
            height_cm: user.height_cm,
            activity_level: user.activity_level,
            daily_exercise_kj: user.daily_exercise_kj
        };
        const targets = calculateDailyIntake(profile);
        const people = plan.defaultServings || 1;
        const nutrientKeys = Object.keys(targets);

        // Per-person, per-day nutrient contribution of a recommendation, expressed
        // as a percentage of the daily target. Recipes are logged at the plan's
        // default servings; pantry items use their suggested daily grams.
        const deltaFromValues = (values) => {
            const delta = [];
            nutrientKeys.forEach(k => {
                const target = targets[k];
                const amount = values[k] || 0;
                if (!target || target <= 0 || amount <= 0) return;
                delta.push({ key: k, label: NUTRIENT_LABELS[k]?.label || k, pct: (amount / target) * 100 });
            });
            return delta;
        };
        const recipeDelta = async (recipeId) => {
            const data = await computeRecipeNutrientTotals(recipeId, plan.defaultServings || 1, nutrientKeys);
            if (!data) return [];
            const perPerson = {};
            nutrientKeys.forEach(k => perPerson[k] = (data.nutrients[k] || 0) / Math.max(1, people));
            return deltaFromValues(perPerson);
        };

        // Pantry items are added as grams/day to the household pool; the coverage
        // panel is per-person, so divide by people to stay consistent.
        const pantryInfo = async (name, gramsPerDay) => {
            const data = await computePlainIngredientNutrients(name, gramsPerDay, 'grams', nutrientKeys);
            if (!data) return null;
            const perPerson = {};
            nutrientKeys.forEach(k => perPerson[k] = (data.nutrients[k] || 0) / Math.max(1, people));
            const energyPer100g = data.nutrients.energy_kcal ? (data.nutrients.energy_kcal / gramsPerDay) * 100 : 0;
            return { perPerson, delta: deltaFromValues(perPerson), energyPer100g };
        };

        // Keep pantry quantities realistic: a suggested grams/day is clamped to
        // a sane range and capped so it never supplies more than ~20% of the
        // day's energy (otherwise we'd suggest 100g+ of macadamia nuts).
        const clampPantryQty = (suggested, energyPer100g) => {
            let qty = Number(suggested);
            if (!Number.isFinite(qty) || qty <= 0) qty = 30;
            qty = Math.max(10, Math.min(200, Math.round(qty)));
            if (energyPer100g > 0 && targets.energy_kcal > 0) {
                const energyCap = (0.2 * targets.energy_kcal) / (energyPer100g / 100);
                if (energyCap > 0) qty = Math.min(qty, Math.floor(energyCap));
            }
            return Math.max(10, qty);
        };

        // 1. Current day nutrient estimates (what the day already covers)
        const dayData = await computeDayNutrients({ plan, day, targets, people, numDays: plan.numDays });
        const { coverage, plannedMeals } = dayData;

        const lowNutrients = coverage.filter(c => c.pct < 95).sort((a, b) => a.pct - b.pct);
        const emptySlots = PLANNER_MEALS.filter(m => !plannedMeals.some(p => p.mealType === m));

        // 2. Candidate recipes from the user's library. Exclude any recipe
        // already in the plan (this day or other days) or already pooled in the
        // pantry, so nothing on hand gets re-suggested.
        const recipeQuery = decoded.role === 'admin' ? {} : { creator_email: user.email };
        const candidates = await Recipe.find({ ...recipeQuery, hidden: { $ne: true } })
            .select('name image genre mealTypes carbType ingredients')
            .lean();

        const planRecipeIds = new Set(
            [...(plan.plannedRecipes || []), ...(plan.everydayItems || [])]
                .map(r => String(r.recipe_id))
                .filter(Boolean)
        );
        const usable = candidates.filter(r => !planRecipeIds.has(String(r._id)));

        // Plain (non-recipe) pantry items already on hand, so the AI never
        // re-suggests an ingredient we already have in the pool.
        const onHandFoodNames = new Set(
            (plan.everydayItems || [])
                .filter(i => !i.recipe_id && i.name)
                .map(i => String(i.name).toLowerCase().trim())
                .filter(Boolean)
        );

        // Also treat anything used inside a planned or pooled recipe as on hand.
        const onHandRecipeIds = [...planRecipeIds].filter(id => /^[0-9a-fA-F]{24}$/.test(String(id)));
        if (onHandRecipeIds.length > 0) {
            const plannedDocs = await Recipe.find({ _id: { $in: onHandRecipeIds } })
                .select('ingredients')
                .lean();
            plannedDocs.forEach(doc => {
                (doc.ingredients || []).forEach(ing => onHandFoodNames.add(String(ing.Name || '').toLowerCase()));
            });
        }

        const isFoodOnHand = (candidate) => {
            const c = String(candidate || '').toLowerCase().trim();
            if (!c) return true;
            const containsAsWord = (longer, shorter) => {
                const idx = longer.indexOf(shorter);
                if (idx === -1) return false;
                const before = idx === 0 ? ' ' : longer[idx - 1];
                const after = idx + shorter.length >= longer.length ? ' ' : longer[idx + shorter.length];
                return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
            };
            for (const pRaw of onHandFoodNames) {
                const p = String(pRaw || '').toLowerCase().trim();
                if (!p) continue;
                if (c === p) return true;
                if (c.length >= p.length) {
                    if (containsAsWord(c, p)) return true;
                } else if (containsAsWord(p, c)) {
                    return true;
                }
            }
            return false;
        };

        const compactCatalog = usable.slice(0, CATALOG_LIMIT).map(r => ({
            name: r.name,
            mealTypes: r.mealTypes || [],
            carbType: r.carbType || null,
            genre: r.genre || null,
            ingredients: (r.ingredients || []).slice(0, 6).map(i => i.Name).filter(Boolean)
        }));

        // 3. Real pantry ingredient candidates for the day's lowest nutrients,
        // so pantry suggestions always map to an IngredientConversion entry.
        const pantrySet = new Set();
        for (const key of lowNutrients.slice(0, 6).map(c => c.key)) {
            const minContribution = targets[key] * 0.1;
            if (!minContribution) continue;
            const foods = await IngredientConversion.find({
                [key]: { $gte: minContribution },
                should_recommend: { $ne: false }
            })
                .sort({ [key]: -1 })
                .limit(8)
                .lean();
            foods.forEach(f => pantrySet.add(f.ingredient_name));
            if (pantrySet.size >= PANTRY_LIMIT) break;
        }
        const pantryCandidates = [...pantrySet]
            .filter(p => !isFoodOnHand(p))
            .slice(0, PANTRY_LIMIT);

        // 4. Build the AI prompt
        const dietaryConstraints = buildDietaryConstraints(user);

        const pantryPoolSummary = (plan.everydayItems || [])
            .map(i => i.name || (i.recipe_id ? 'recipe' : ''))
            .filter(Boolean)
            .join(', ') || 'none';

        const targetsSummary = Object.keys(targets)
            .map(k => {
                const meta = NUTRIENT_LABELS[k];
                return meta ? `${meta.label}: ${Math.round(targets[k])} ${meta.unit}` : null;
            })
            .filter(Boolean)
            .join(', ');

        const coverageSummary = coverage
            .map(c => `${NUTRIENT_LABELS[c.key]?.label || c.key} ${Math.round(c.pct)}%`)
            .join(', ');

        const plannedSummary = plannedMeals.length
            ? plannedMeals.map(m => `${m.mealType}: ${m.name}${m.carbType ? ` (${m.carbType})` : ''}`).join('; ')
            : 'Nothing planned yet';

        const systemContent = `You are an expert nutritionist and creative meal planner for a home cook.
A single day of their weekly plan needs filling out. You will be given:
- the daily nutrient targets,
- the day's current nutrient coverage (percent of each target already covered),
- what meals are already planned for that day (with their carb type),
- the empty meal slots,
- the user's pantry pool (ingredients they already have on hand),
- a catalog of recipes from the user's own library,
- a list of real pantry ingredients you may recommend.

DIETARY RULES FOR THIS USER (STRICT — never break these): ${dietaryConstraints}

Your job:
- Recommend 1 to 3 items that best round out the day. Fill an empty meal slot when it makes sense (e.g. suggest a breakfast when lunch and dinner are set), but you are NOT forced to fill every slot — a snack or a single complementary item is often the right call.
- Encourage variety: avoid repeating the same carb base (rice/pasta/potato/bread/noodles) and the same protein source already used that day. Prefer ingredients that differ from what's already planned.
- Prioritise recipes/ingredients that boost the day's LOWEST nutrients and protein/fiber where they're behind target.
- NEVER re-suggest anything already in the plan or the pantry pool — no recipes from the plan, no ingredients already on hand.
- Recipe names MUST be chosen from the catalog verbatim. Pantry names MUST be chosen from the pantry list verbatim.
- For pantry recommendations include a REALISTIC daily 'quantity' in grams for how the food is actually eaten: nuts/seeds ~15-30g, nut butters ~15-20g, oils ~10-15g, leafy greens ~50-100g, other vegetables ~100-150g, fruit ~120-200g, legumes/canned beans ~80-150g, grains ~50-80g. Never suggest 100g+ of energy-dense foods like nuts, seeds, oils or nut butters.

Return ONLY a JSON object: {"recommendations": [{"type": "recipe"|"pantry", "name": "exact name", "mealSlot": "Breakfast"|"Lunch"|"Dinner"|"Snack", "quantity": "grams per day (pantry only, omit for recipes)", "reason": "one short sentence on why it fits"}]}`;

        const userContent = `DAY: ${day}
DAILY TARGETS: ${targetsSummary}

CURRENT DAY COVERAGE (% of target): ${coverageSummary}
Already planned today: ${plannedSummary}
Empty slots: ${emptySlots.length ? emptySlots.join(', ') : 'none (all full)'}
Pantry pool (already on hand — do not re-suggest these): ${pantryPoolSummary}

RECIPE CATALOG:
${JSON.stringify(compactCatalog)}

PANTRY CANDIDATES:
${JSON.stringify(pantryCandidates)}`;

        const messages = [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent }
        ];

        const responseText = await callGroqChat(messages, true);

        // 5. Parse + validate the response
        let raw;
        try {
            raw = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) raw = JSON.parse(match[0]);
            else throw new Error('Failed to parse AI response as JSON');
        }

        const recs = Array.isArray(raw?.recommendations) ? raw.recommendations : [];
        const nameToRecipe = new Map(usable.map(r => [String(r.name).toLowerCase(), r]));

        const recommendations = [];
        for (const rec of recs.slice(0, 3)) {
            const name = String(rec.name || '').trim();
            if (!name) continue;

            if (rec.type === 'pantry') {
                const match = pantryCandidates.find(p => p.toLowerCase() === name.toLowerCase());
                if (!match) continue;
                // Start from the AI's suggested daily amount, clamp to a sane
                // range + energy cap, then recompute the delta at that amount.
                const base = await pantryInfo(match, 100);
                if (!base) continue;
                const quantity = clampPantryQty(rec.quantity, base.energyPer100g);
                const info = await pantryInfo(match, quantity);
                recommendations.push({
                    type: 'pantry',
                    pantryName: match,
                    quantity,
                    mealSlot: null,
                    reason: String(rec.reason || ''),
                    nutrientDelta: info ? info.delta : []
                });
                continue;
            }

            const candidate = nameToRecipe.get(name.toLowerCase())
                || usable.find(r => String(r.name).toLowerCase().includes(name.toLowerCase()));
            if (!candidate) continue;

            const mealSlot = PLANNER_MEALS.includes(rec.mealSlot) ? rec.mealSlot : (emptySlots[0] || 'Snack');
            recommendations.push({
                type: 'recipe',
                recipe: {
                    _id: String(candidate._id),
                    name: candidate.name,
                    image: candidate.image,
                    mealTypes: candidate.mealTypes,
                    carbType: candidate.carbType,
                    genre: candidate.genre
                },
                mealSlot,
                reason: String(rec.reason || ''),
                nutrientDelta: await recipeDelta(candidate._id)
            });
        }

        return res.status(200).json({
            success: true,
            dayCoverage: coverage.map(c => ({
                key: c.key,
                label: NUTRIENT_LABELS[c.key]?.label || c.key,
                unit: NUTRIENT_LABELS[c.key]?.unit || '',
                pct: Math.round(c.pct),
                value: c.value,
                target: c.target
            })),
            plannedMeals,
            emptySlots,
            recommendations
        });
    } catch (err) {
        console.error('Day suggest error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
