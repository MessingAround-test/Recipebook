import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { normalizeCriteria, criteriaInstruction } from '../../../lib/dishLists/criteria';
import { callGroqChat } from '../../../lib/ai';
import { quantity_unit_conversions } from '../../../lib/conversion';
import { normalizeExtractedIngredients, normalizePrepWords, normalizeExtractedInstructions } from '../../../lib/recipeNormalize';

const VALID_GENRES = [
    'Italian', 'Mexican', 'Asian', 'Indian', 'Mediterranean', 'American',
    'French', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Greek',
    'Chinese', 'Vietnamese', 'Other'
];

const VALID_TIMES = ['short', 'medium', 'long'];
const VALID_MEALS = ['Breakfast', 'Lunch', 'Main', 'Entree', 'Dessert', 'Snack'];
const VALID_CARB_TYPES = ['Rice', 'Bread/Wraps', 'Pasta/Noodles', 'Potato', 'Quinoa', 'None/Other'];
const VALID_UNITS = Object.keys(quantity_unit_conversions);

/**
 * Adapts an existing (baseline) recipe to a set of dietary requirements.
 * Takes a Recipe-shaped object plus `criteria` and returns the same shape
 * with non-conforming ingredients/steps substituted. Reused from the dish-list
 * creation flow and intended for other pages later.
 */
export default async function handler(req, res) {
    logAPI(req);
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        const recipe = req.body?.recipe;
        const criteria = normalizeCriteria(req.body?.criteria);

        if (!recipe || typeof recipe !== 'object') {
            return res.status(400).json({ success: false, message: 'A recipe object is required' });
        }

        // No dietary requirements → return the recipe untouched.
        const dietary = criteriaInstruction(criteria);
        if (!dietary) {
            return res.status(200).json({ success: true, data: recipe });
        }

        const baseJson = JSON.stringify({
            name: recipe.name,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            time: recipe.time,
            genre: recipe.genre,
            mealTypes: recipe.mealTypes,
            servings: recipe.servings,
            carbType: recipe.carbType
        });

        const dietaryBlock = `DIETARY ADAPTATION (IMPORTANT): Adapt the recipe so EVERY ingredient and step conforms to this diet — ${dietary}
Replace any non-conforming ingredient with a suitable substitute that does, keeping the dish recognisable and the amounts sensible. Record the substitution in that ingredient's 'Note' (e.g. "soy butter, for butter"). If a step references a replaced ingredient, rewrite it to use the substitute. Never output a non-conforming ingredient. Return the FULL updated recipe (all ingredients and steps), not just the changed parts.`;

        const systemContent = `You are a culinary assistant expert at adapting recipes to dietary requirements while keeping them delicious and recognisable.

Adapt the provided recipe to the diet below. Hard rules:
- Keep the dish's identity — substitute, don't reinvent.
- 'carbType' MUST reflect the primary carbohydrate actually in the adapted dish: Rice for rice dishes, Pasta/Noodles for pasta or noodles, Bread/Wraps for sandwiches/wraps/tortillas, Potato for potato dishes, Quinoa for quinoa dishes, None/Other otherwise.

Return a single JSON object:
{
  "name": "recipe title",
  "ingredients": [{"Name": "BASE ingredient only — the plain food, no preparation or state words", "Amount": "numeric or fraction", "AmountType": "one of: ${VALID_UNITS.join(', ')}", "Note": "preparation/state OR the substitution made — optional"}],
  "instructions": [{"Text": "step description", "Note": "optional tip or step time"}],
  "time": "one of: ${VALID_TIMES.join(', ')}",
  "genre": "one of: ${VALID_GENRES.join(', ')}",
  "mealTypes": ["one or more of: ${VALID_MEALS.join(', ')}"],
  "servings": number,
  "carbType": "one of: ${VALID_CARB_TYPES.join(', ')}"
}
Output ONLY valid JSON, no markdown.${dietaryBlock}`;

        const userContent = `BASE RECIPE:\n${baseJson}\n\nDietary requirement to apply: ${dietary}`;

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
        data.instructions = normalizeExtractedInstructions(data.instructions);
        if (!VALID_GENRES.includes(data.genre)) data.genre = recipe.genre || 'Other';
        data.mealTypes = Array.isArray(data.mealTypes) ? data.mealTypes.filter(m => VALID_MEALS.includes(m)) : (recipe.mealTypes || []);
        if (!data.servings || isNaN(Number(data.servings))) data.servings = recipe.servings || 4;
        else data.servings = Number(data.servings);
        if (!VALID_CARB_TYPES.includes(data.carbType)) data.carbType = recipe.carbType || 'None/Other';
        data.time = VALID_TIMES.includes(data.time) ? data.time : (recipe.time || 'medium');
        if (!data.name) data.name = recipe.name;

        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Remix recipe error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
