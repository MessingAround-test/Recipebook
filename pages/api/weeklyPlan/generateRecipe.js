import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { calculateDailyIntake, NUTRIENT_LABELS } from '../../../lib/dailyIntake';
import { buildDietaryConstraints } from '../../../lib/dietaryRules';
import { computeDayNutrients, computeIngredientListNutrients } from '../../../lib/planNutrition';
import { normalizeExtractedIngredients, normalizePrepWords } from '../../../lib/recipeNormalize';
import { quantity_unit_conversions } from '../../../lib/conversion';
import { callGroqChat } from '../../../lib/ai';

const VALID_GENRES = [
    'Italian', 'Mexican', 'Asian', 'Indian', 'Mediterranean', 'American',
    'French', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Greek',
    'Chinese', 'Vietnamese', 'Other'
];

const VALID_TIMES = ['short', 'medium', 'long'];
const VALID_MEALS = ['Breakfast', 'Lunch', 'Main', 'Entree', 'Dessert', 'Snack'];
const VALID_CARB_TYPES = ['Rice', 'Bread/Wraps', 'Pasta/Noodles', 'Potato', 'Quinoa', 'None/Other'];
const PLANNER_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const VALID_UNITS = Object.keys(quantity_unit_conversions);

const TIME_DESCRIPTIONS = {
    short: 'UNDER 30 MINUTES total (prep + cook) — keep it genuinely quick and simple',
    medium: '30 to 60 minutes total (prep + cook)',
    long: 'over 60 minutes total (prep + cook, e.g. slow-braised, roasted, or risen dough)'
};

export default async function handler(req, res) {
    logAPI(req);
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();

    try {
        const { plan, day, timePreference, requirement } = req.body;
        if (!plan || !day) {
            return res.status(400).json({ success: false, message: 'plan and day are required' });
        }
        const time = VALID_TIMES.includes(timePreference) ? timePreference : 'medium';
        const extraRequirement = String(requirement || '').trim();

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

        // Determine what the day is lacking — this drives the recipe prompt.
        const dayData = await computeDayNutrients({ plan, day, targets, people, numDays: plan.numDays });
        const { coverage, plannedMeals } = dayData;
        const lowNutrients = coverage.filter(c => c.pct < 95).sort((a, b) => a.pct - b.pct);
        const emptySlots = PLANNER_MEALS.filter(m => !plannedMeals.some(p => p.mealType === m));

        const dietaryConstraints = buildDietaryConstraints(user);

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

        const systemContent = `You are a world-class chef who designs exciting, delicious, foolproof home recipes.
You design a single brand-new recipe to fill a gap in the user's day.

FIT THE TIME BUDGET HONESTLY — this is the most important rule. The dish must be fully achievable in the chosen time by a normal home cook, or you must simplify it until it is:
- short (under 30 min): AT MOST 6 ingredients and 4 short steps. Rely on quick cooking or no-cook components (pan-sear, stir-fry, broil, no-bake, canned beans, pre-cut veg, pre-cooked grains). NO resting, chilling, marinating, dough, rice rolling, sauce-making from scratch, or multi-component assembly. Simplicity wins over showmanship.
- medium (30-60 min): AT MOST 8 ingredients and 6 steps.
- long (60+ min): slow-braised, roasted, or risen dishes are fine.

Other hard rules:
- Be genuinely delicious and interesting but use common, everyday supermarket ingredients — no obscure ingredients.
- Suit the user's dietary rules (STRICT — never break these): ${dietaryConstraints}
- Fill an empty meal slot when possible; otherwise make a great snack or a complement to the existing meals.
- Vary the day: do NOT repeat the same carb base or protein already used that day.
- Boost the day's lowest nutrients and keep protein/fiber strong.
- 'suggestedSlot' must be the meal the dish would genuinely be eaten for (e.g. sushi or a steak salad are NOT breakfast).
- 'carbType' MUST reflect the primary carbohydrate actually in the dish: Rice for rice dishes, Pasta/Noodles for pasta or noodles, Bread/Wraps for sandwiches/wraps/tortillas, Potato for potato dishes, Quinoa for quinoa dishes, None/Other otherwise.

Return a single JSON object:
{
  "name": "recipe title",
  "ingredients": [{"Name": "BASE ingredient only — the plain food, no preparation or state words (e.g. \"avocado\", NOT \"mashed avocado\" or \"diced tomato\")", "Amount": "numeric or fraction e.g. 500 | 1.5 | 1/2", "AmountType": "one of: ${VALID_UNITS.join(', ')}", "Note": "preparation or state (e.g. \"mashed\", \"diced\", \"finely chopped\") — optional"}],
  "instructions": [{"Text": "step description", "Note": "optional tip or step time"}],
  "time": "${time}",
  "genre": "one of: ${VALID_GENRES.join(', ')}",
  "mealTypes": ["one or more of: ${VALID_MEALS.join(', ')}"],
  "servings": ${people},
  "carbType": "one of: ${VALID_CARB_TYPES.join(', ')}",
  "suggestedSlot": "one of: ${PLANNER_MEALS.join(', ')}"
}
The ingredient/step counts must respect the budget limits above. Amounts must cover ${people} servings. If an ingredient has no natural amount, use Amount "1" and AmountType "each". Output ONLY valid JSON, no markdown.`;

        const userContent = `DAY: ${day}
TIME BUDGET: ${TIME_DESCRIPTIONS[time]}
${extraRequirement ? `EXTRA REQUIREMENT (design the recipe to meet this): ${extraRequirement}` : ''}

DAILY TARGETS: ${targetsSummary}

CURRENT DAY COVERAGE (% of target): ${coverageSummary}
Already planned today: ${plannedSummary}
Empty slots: ${emptySlots.length ? emptySlots.join(', ') : 'none (all full)'}
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

        // Validate / coerce the returned fields
        if (data.ingredients && Array.isArray(data.ingredients)) {
            data.ingredients = normalizeExtractedIngredients(data.ingredients);
            // Keep the base ingredient as the Name so "mashed avocado" and
            // "avocado" don't become separate ingredients — prep goes to Note.
            data.ingredients = normalizePrepWords(data.ingredients);
        }
        if (!Array.isArray(data.instructions)) data.instructions = [];
        data.instructions = data.instructions.map(i => ({ Text: String(i.Text || ''), Note: String(i.Note || '') })).filter(i => i.Text);
        // The design is tailored to the chosen budget, so always label it that way.
        data.time = time;
        if (!VALID_GENRES.includes(data.genre)) data.genre = 'Other';
        data.mealTypes = Array.isArray(data.mealTypes) ? data.mealTypes.filter(m => VALID_MEALS.includes(m)) : [];
        if (!data.servings || isNaN(Number(data.servings))) data.servings = people;
        else data.servings = Number(data.servings);
        if (!VALID_CARB_TYPES.includes(data.carbType)) data.carbType = 'None/Other';
        data.suggestedSlot = PLANNER_MEALS.includes(data.suggestedSlot) ? data.suggestedSlot : (emptySlots[0] || 'Snack');

        // Preview impact: compute the recipe's per-person, per-day contribution
        // as % of daily targets, so the client can show it on the coverage bars.
        const nutrientKeys = Object.keys(targets);
        const recipeTotals = await computeIngredientListNutrients(data.ingredients, nutrientKeys);
        const perPerson = {};
        nutrientKeys.forEach(k => perPerson[k] = (recipeTotals[k] || 0) / Math.max(1, people));
        const nutrientDelta = [];
        nutrientKeys.forEach(k => {
            const target = targets[k];
            const amount = perPerson[k];
            if (!target || target <= 0 || amount <= 0) return;
            nutrientDelta.push({ key: k, label: NUTRIENT_LABELS[k]?.label || k, pct: (amount / target) * 100 });
        });

        return res.status(200).json({ success: true, recipe: data, nutrientDelta });
    } catch (err) {
        console.error('Generate recipe error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
