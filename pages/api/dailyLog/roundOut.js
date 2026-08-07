import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import DailyLog from '../../../models/DailyLog';
import IngredientConversion from '../../../models/IngredientConversion';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { calculateDailyIntake, NUTRIENT_LABELS } from '../../../lib/dailyIntake';
import { buildDietaryConstraints, allowedIngredientCategories } from '../../../lib/dietaryRules';
import { computeRecipeNutrientTotals, computePlainIngredientNutrients } from '../../../lib/planNutrition';
import { callGroqChat } from '../../../lib/ai';

const PLANNER_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const CATALOG_LIMIT = 150;
const PANTRY_LIMIT = 40;

// Categories that contain animal flesh. Excluded by default (and only bypassed
// when the client explicitly opts out with excludeMeat: false).
const EXCLUDED_CATEGORIES = ['Meat', 'Seafood', 'Meat and Seafood', 'Poultry', 'Fish'];

// Word-boundary keyword fallback so a miscategorised tuna/chicken/etc. never
// sneaks through, even when its category is missing or generic.
const MEAT_KEYWORDS = [
    'tuna', 'salmon', 'chicken', 'beef', 'pork', 'lamb', 'fish', 'prawn', 'shrimp',
    'turkey', 'ham', 'bacon', 'sausage', 'anchovy', 'sardine', 'schnitzel', 'mince',
    'steak', 'chorizo', 'mackerel', 'cod', 'crab', 'oyster', 'mussel', 'calamari',
    'squid', 'duck', 'venison', 'prosciutto', 'salami', 'meat', 'kangaroo',
    'crayfish', 'lobster', 'ribs', 'drumstick', 'wings', 'scallop', 'trout',
    'basa', 'barramundi', 'whiting', 'rabbit', 'goat'
];

// A keyword followed by one of these is a condiment/seasoning, not the flesh
// itself (e.g. "fish sauce", "chicken stock", "anchovy paste").
const MEAT_IGNORE_SUFFIXES = ['sauce', 'paste', 'stock', 'salt', 'powder', 'seasoning', 'flavour', 'flavor', 'extract', 'oil', 'broth', 'essence'];

function isMeatName(name) {
    const s = String(name || '').toLowerCase().trim();
    if (!s) return false;
    for (const kw of MEAT_KEYWORDS) {
        const idx = s.indexOf(kw);
        if (idx === -1) continue;
        const before = idx === 0 ? '' : s[idx - 1];
        const after = idx + kw.length >= s.length ? '' : s[idx + kw.length];
        if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
        const nextWord = (s.slice(idx + kw.length).trim().split(/\s+/)[0] || '');
        if (MEAT_IGNORE_SUFFIXES.includes(nextWord)) continue;
        return true;
    }
    return false;
}

function getLocalDateString(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default async function handler(req, res) {
    logAPI(req);
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();

    try {
        const { date, excludeMeat } = req.body || {};
        const day = date || getLocalDateString(new Date());
        const noMeat = excludeMeat !== false; // default: exclude all meat/seafood

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
        const nutrientKeys = Object.keys(targets);

        // 1. Aggregate today's ACTUAL logged intake (unlike the weekly planner
        //    which works from a plan, this is what the user really ate).
        const totals = {};
        nutrientKeys.forEach(k => totals[k] = 0);
        const log = await DailyLog.findOne({ user_id: decoded.id, date: day });
        if (log) {
            log.items.forEach(item => {
                nutrientKeys.forEach(k => {
                    totals[k] += (item.nutrients[k] || 0);
                });
            });
        }

        const alreadyEaten = new Set(
            (log?.items || [])
                .map(i => String(i.name || i.recipe_name || '').toLowerCase().trim())
                .filter(Boolean)
        );

        const coverage = [];
        nutrientKeys.forEach(k => {
            const target = targets[k];
            if (!target || !Number.isFinite(target) || target <= 0) return;
            coverage.push({ key: k, value: totals[k], target, pct: (totals[k] / target) * 100 });
        });

        const lowNutrients = coverage.filter(c => c.pct < 95).sort((a, b) => a.pct - b.pct);

        if (lowNutrients.length === 0) {
            return res.status(200).json({
                success: true,
                dayCoverage: coverage.map(c => ({ key: c.key, label: NUTRIENT_LABELS[c.key]?.label || c.key, unit: NUTRIENT_LABELS[c.key]?.unit || '', pct: Math.round(c.pct) })),
                lowNutrients: [],
                alreadyEaten: [...alreadyEaten],
                recommendations: [],
                message: "All your targets are on track for today. Nothing to round out."
            });
        }

        // 2. Candidate recipes from the user's library. Prefer easy ones but
        //    keep the whole catalog available so the AI can still pick a quick
        //    proper meal when nothing raw fits. Meat recipes are dropped by
        //    default (any ingredient name that reads as meat/seafood/fish).
        const recipeQuery = decoded.role === 'admin' ? {} : { creator_email: user.email };
        const catalogAll = await Recipe.find({ ...recipeQuery, hidden: { $ne: true } })
            .select('name image genre mealTypes carbType time servings ingredients')
            .lean();
        const catalog = noMeat
            ? catalogAll.filter(r => !(r.ingredients || []).some(ing => isMeatName(ing.Name)))
            : catalogAll;

        const compactCatalog = catalog.slice(0, CATALOG_LIMIT).map(r => {
            const ingCount = (r.ingredients || []).length;
            return {
                name: r.name,
                time: r.time || null,
                mealTypes: r.mealTypes || [],
                carbType: r.carbType || null,
                genre: r.genre || null,
                ingredientCount: ingCount,
                ingredients: (r.ingredients || []).slice(0, 6).map(i => i.Name).filter(Boolean)
            };
        });

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
            for (const pRaw of alreadyEaten) {
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

        // 3. Real pantry ingredient candidates for the day's lowest nutrients.
        const allowedCategories = new Set(allowedIngredientCategories(user));
        if (noMeat) {
            EXCLUDED_CATEGORIES.forEach(c => allowedCategories.delete(c));
        }
        const pantrySet = new Set();
        for (const key of lowNutrients.slice(0, 6).map(c => c.key)) {
            const minContribution = targets[key] * 0.1;
            if (!minContribution) continue;
            const foods = await IngredientConversion.find({
                [key]: { $gte: minContribution },
                should_recommend: { $ne: false },
                $or: [
                    { category: { $in: [...allowedCategories] } },
                    { category: { $exists: false } },
                    { category: "" },
                    { category: null }
                ]
            })
                .sort({ [key]: -1 })
                .limit(8)
                .lean();
            foods.forEach(f => pantrySet.add(f.ingredient_name));
            if (pantrySet.size >= PANTRY_LIMIT) break;
        }
        const pantryCandidates = [...pantrySet]
            .filter(p => !isFoodOnHand(p))
            .filter(p => noMeat ? !isMeatName(p) : true)
            .slice(0, PANTRY_LIMIT);

        // 4. Build the AI prompt
        let dietaryConstraints = buildDietaryConstraints(user);
        if (noMeat) {
            dietaryConstraints += ' NO MEAT, POULTRY, SEAFOOD, OR FISH OF ANY KIND (no tuna, chicken, beef, pork, salmon, prawns, etc.) — all suggestions must be vegetarian/plant-based.';
        }

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

        const alreadySummary = [...alreadyEaten].length
            ? [...alreadyEaten].join(', ')
            : 'nothing yet';

        const systemContent = `You are an expert nutritionist and quick home cook. A user is part-way through today and their ACTUAL logged intake needs rounding out.
You will be given:
- the daily nutrient targets,
- today's current intake coverage (percent of each target already EATEN, based on their food log),
- the foods they have already eaten today,
- a catalog of recipes from the user's own library,
- a list of real pantry ingredients you may recommend.

DIETARY RULES FOR THIS USER (STRICT — never break these): ${dietaryConstraints}

EFFORT IS EVERYTHING. The whole point is that this is INCREDIBLY SIMPLE — the user wants to round out today with as little effort as possible:
- STRONGLY prefer 5-minute foods and raw ingredients you likely already have in the cupboard or fridge: fruit, nuts/seeds, yoghurt, eggs, cheese, tinned beans/lentils, peanut butter, rolled oats, milk, bread/toast, rice cakes, raw vegetables (carrot, cucumber, cherry tomatoes), canned corn, dark chocolate, etc.
- Raw ingredients need zero cooking. If you suggest a small dish, it must be no-cook or under 5 minutes (e.g. toast with peanut butter, Greek yoghurt with fruit and seeds, canned beans mashed on toast, boiled egg, oats with milk).
- ONLY pick a recipe from the catalog when it is genuinely quick (its "time" is "short" OR it has at most 6 ingredients). Otherwise pick pantry items instead.
- Prioritise foods that boost today's LOWEST nutrients and protein/fiber where they're behind target.
- Avoid over-suggesting energy-dense foods (nuts/seeds/oils ~15-30g, nut butters ~15-20g, not 100g+).
- NEVER re-suggest a food already eaten today.
- Recipe names MUST be chosen from the catalog verbatim. Pantry names MUST be chosen from the pantry list verbatim.
- For pantry recommendations include a REALISTIC 'quantity' in grams for how the food is actually eaten: nuts/seeds ~15-30g, nut butters ~15-20g, oils ~10-15g, leafy greens ~50-100g, other vegetables ~100-150g, fruit ~120-200g, legumes/canned beans ~80-150g, yoghurt ~150-200g, eggs ~50g each, oats ~40g.

TASTE MATTERS — THIS IS NON-NEGOTIABLE. Every recommendation must be genuinely delicious and appetising on its own. Never suggest a food or pairing just because it scores well on nutrients if it would taste bland, sad, or weird together. A single food is fine when it's great on its own (ripe mango, cold grapes, Greek yoghurt with honey, peanut butter on toast, avocado, berries). If you pair things, they must taste good together (sweet + creamy, crunchy + salty). Never pair savoury fish-flavoured things with sweet things.

Return ONLY a JSON object: {"recommendations": [{"type": "recipe"|"pantry", "name": "exact name", "mealSlot": "Breakfast"|"Lunch"|"Dinner"|"Snack", "quantity": "grams (pantry only, omit for recipes)", "reason": "one short sentence on why it fits"}]}`;

        const userContent = `DAY: ${day}
DAILY TARGETS: ${targetsSummary}

TODAY'S ACTUAL INTAKE COVERAGE (% of target): ${coverageSummary}
Already eaten today: ${alreadySummary}
Lowest nutrients right now: ${lowNutrients.slice(0, 6).map(c => NUTRIENT_LABELS[c.key]?.label || c.key).join(', ')}

RECIPE CATALOG:
${JSON.stringify(compactCatalog)}

PANTRY CANDIDATES:
${JSON.stringify(pantryCandidates)}`;

        const messages = [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent }
        ];

        const responseText = await callGroqChat(messages, true);

        let raw;
        try {
            raw = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) raw = JSON.parse(match[0]);
            else throw new Error('Failed to parse AI response as JSON');
        }

        const recs = Array.isArray(raw?.recommendations) ? raw.recommendations : [];
        const nameToRecipe = new Map(catalog.map(r => [String(r.name).toLowerCase(), r]));

        const clampQty = (suggested, energyPer100g) => {
            let qty = Number(suggested);
            if (!Number.isFinite(qty) || qty <= 0) qty = 30;
            qty = Math.max(10, Math.min(200, Math.round(qty)));
            if (energyPer100g > 0 && targets.energy_kcal > 0) {
                const energyCap = (0.2 * targets.energy_kcal) / (energyPer100g / 100);
                if (energyCap > 0) qty = Math.min(qty, Math.floor(energyCap));
            }
            return Math.max(10, qty);
        };

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

        const recommendations = [];
        for (const rec of recs.slice(0, 3)) {
            const name = String(rec.name || '').trim();
            if (!name) continue;

            if (rec.type === 'pantry') {
                const match = pantryCandidates.find(p => p.toLowerCase() === name.toLowerCase());
                if (!match) continue;
                const base = await computePlainIngredientNutrients(match, 100, 'grams', nutrientKeys);
                if (!base) continue;
                const quantity = clampQty(rec.quantity, base.nutrients.energy_kcal || 0);
                const info = await computePlainIngredientNutrients(match, quantity, 'grams', nutrientKeys);
                recommendations.push({
                    type: 'pantry',
                    pantryName: match,
                    quantity,
                    mealSlot: null,
                    reason: String(rec.reason || ''),
                    nutrientDelta: info ? deltaFromValues(info.nutrients) : []
                });
                continue;
            }

            const candidate = nameToRecipe.get(name.toLowerCase())
                || catalog.find(r => String(r.name).toLowerCase().includes(name.toLowerCase()));
            if (!candidate) continue;

            const mealSlot = PLANNER_MEALS.includes(rec.mealSlot) ? rec.mealSlot : 'Snack';
            const data = await computeRecipeNutrientTotals(candidate._id, 1, nutrientKeys);
            recommendations.push({
                type: 'recipe',
                recipe: {
                    _id: String(candidate._id),
                    name: candidate.name,
                    image: candidate.image,
                    time: candidate.time,
                    mealTypes: candidate.mealTypes,
                    carbType: candidate.carbType,
                    genre: candidate.genre,
                    ingredientCount: (candidate.ingredients || []).length
                },
                mealSlot,
                reason: String(rec.reason || ''),
                nutrientDelta: data ? deltaFromValues(data.nutrients) : []
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
            lowNutrients: lowNutrients.map(c => ({ key: c.key, label: NUTRIENT_LABELS[c.key]?.label || c.key, pct: Math.round(c.pct) })),
            alreadyEaten: [...alreadyEaten],
            recommendations
        });
    } catch (err) {
        console.error('Round-out suggest error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
