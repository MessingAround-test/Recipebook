import dbConnect from '../../../lib/dbConnect';
import DailyLog from '../../../models/DailyLog';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { calculateDailyIntake, NUTRIENT_LABELS } from '../../../lib/dailyIntake';
import { buildDietaryConstraints } from '../../../lib/dietaryRules';
import { computeIngredientListNutrients } from '../../../lib/planNutrition';
import { normalizeExtractedIngredients, normalizePrepWords } from '../../../lib/recipeNormalize';
import { quantity_unit_conversions } from '../../../lib/conversion';
import { callGroqChat } from '../../../lib/ai';

const VALID_GENRES = [
    'Italian', 'Mexican', 'Asian', 'Indian', 'Mediterranean', 'American',
    'French', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Greek',
    'Chinese', 'Vietnamese', 'Other'
];

const VALID_MEALS = ['Breakfast', 'Lunch', 'Main', 'Entree', 'Dessert', 'Snack'];
const VALID_CARB_TYPES = ['Rice', 'Bread/Wraps', 'Pasta/Noodles', 'Potato', 'Quinoa', 'None/Other'];
const PLANNER_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const VALID_UNITS = Object.keys(quantity_unit_conversions);

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
        const { date, requirement, excludeMeat } = req.body || {};
        const day = date || getLocalDateString(new Date());
        const extraRequirement = String(requirement || '').trim();
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

        // Actual logged intake for today.
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

        let dietaryConstraints = buildDietaryConstraints(user);
        if (noMeat) {
            dietaryConstraints += ' NO MEAT, POULTRY, SEAFOOD, OR FISH OF ANY KIND (no tuna, chicken, beef, pork, salmon, prawns, etc.) — the dish MUST be vegetarian/plant-based.';
        }

        const systemContent = `You are a quick home cook who designs INCREDIBLY SIMPLE, 5-minute dishes.
The user is part-way through today and needs a single ultra-easy dish to round out their ACTUAL intake.
This is the single most important rule: the dish must be ready in 5 MINUTES or less with zero-to-minimal cooking.
- AT MOST 5 ingredients and AT MOST 3 steps.
- No-cook or near-no-cook only: raw assemblies, toast, microwave, tinned/pre-cooked staples (canned beans, pre-cooked rice, yoghurt, cheese, eggs, fruit, oats with milk), open-and-serve.
- Use common, everyday supermarket ingredients you almost certainly already have in the cupboard — no obscure ingredients, no lengthy cooking, no resting/chilling/dough/sauces from scratch.
- Suit the user's dietary rules (STRICT — never break these): ${dietaryConstraints}
- Boost the day's lowest nutrients and keep protein/fiber strong.
- Never re-use a food already eaten today: ${alreadySummary}
- 'suggestedSlot' must be the meal the dish would genuinely be eaten for (e.g. overnight oats are NOT dinner).
- 'carbType' MUST reflect the primary carbohydrate actually in the dish: Rice for rice dishes, Pasta/Noodles for pasta or noodles, Bread/Wraps for sandwiches/wraps/tortillas, Potato for potato dishes, Quinoa for quinoa dishes, None/Other otherwise.

TASTE IS KING — the dish MUST be genuinely delicious and something the user would actually want to eat. This matters MORE than hitting every nutrient target. Pick flavour pairings that genuinely work together (sweet + salty, creamy + crunchy, warm + fresh, umami + zingy). No bland, sad, or weird combos. A great 5-minute dish beats a "healthy" one nobody enjoys.

Return a single JSON object:
{
  "name": "recipe title",
  "ingredients": [{"Name": "BASE ingredient only — the plain food, no preparation or state words (e.g. \"avocado\", NOT \"mashed avocado\" or \"diced tomato\")", "Amount": "numeric or fraction e.g. 500 | 1.5 | 1/2", "AmountType": "one of: ${VALID_UNITS.join(', ')}", "Note": "preparation or state (e.g. \"mashed\", \"diced\", \"finely chopped\") — optional"}],
  "instructions": [{"Text": "step description", "Note": "optional tip or step time"}],
  "time": "short",
  "genre": "one of: ${VALID_GENRES.join(', ')}",
  "mealTypes": ["one or more of: ${VALID_MEALS.join(', ')}"],
  "servings": 1,
  "carbType": "one of: ${VALID_CARB_TYPES.join(', ')}",
  "suggestedSlot": "one of: ${PLANNER_MEALS.join(', ')}"
}
The ingredient/step counts must respect the 5-ingredient / 3-step budget above. Amounts must cover 1 serving. If an ingredient has no natural amount, use Amount "1" and AmountType "each". Output ONLY valid JSON, no markdown.`;

        const userContent = `DAY: ${day}
${extraRequirement ? `EXTRA REQUIREMENT (design the recipe to meet this): ${extraRequirement}` : ''}

DAILY TARGETS: ${targetsSummary}

TODAY'S ACTUAL INTAKE COVERAGE (% of target): ${coverageSummary}
Already eaten today: ${alreadySummary}
Days lowest nutrients: ${lowNutrients.length ? lowNutrients.slice(0, 6).map(c => NUTRIENT_LABELS[c.key]?.label || c.key).join(', ') : 'none'}`;

        const messages = [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent }
        ];

        const responseText = await callGroqChat(messages, true);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) data = JSON.parse(match[0]);
            else throw new Error('Failed to parse AI response as JSON');
        }

        if (data.ingredients && Array.isArray(data.ingredients)) {
            data.ingredients = normalizeExtractedIngredients(data.ingredients);
            data.ingredients = normalizePrepWords(data.ingredients);
        }
        if (!Array.isArray(data.instructions)) data.instructions = [];
        data.instructions = data.instructions.map(i => ({ Text: String(i.Text || ''), Note: String(i.Note || '') })).filter(i => i.Text);
        data.time = 'short';
        if (!VALID_GENRES.includes(data.genre)) data.genre = 'Other';
        data.mealTypes = Array.isArray(data.mealTypes) ? data.mealTypes.filter(m => VALID_MEALS.includes(m)) : [];
        if (!data.servings || isNaN(Number(data.servings))) data.servings = 1;
        else data.servings = Number(data.servings);
        if (!VALID_CARB_TYPES.includes(data.carbType)) data.carbType = 'None/Other';
        data.suggestedSlot = PLANNER_MEALS.includes(data.suggestedSlot) ? data.suggestedSlot : 'Snack';

        const recipeTotals = await computeIngredientListNutrients(data.ingredients, nutrientKeys);
        const nutrientDelta = [];
        nutrientKeys.forEach(k => {
            const target = targets[k];
            const amount = recipeTotals[k] || 0;
            if (!target || target <= 0 || amount <= 0) return;
            nutrientDelta.push({ key: k, label: NUTRIENT_LABELS[k]?.label || k, pct: (amount / target) * 100 });
        });

        return res.status(200).json({ success: true, recipe: data, nutrientDelta });
    } catch (err) {
        console.error('Round-out generate error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
