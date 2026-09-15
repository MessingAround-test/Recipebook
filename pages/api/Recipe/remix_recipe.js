import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { normalizeCriteria, criteriaInstruction } from '../../../lib/dishLists/criteria';
import { callGroqChat } from '../../../lib/ai';
import { quantity_unit_conversions } from '../../../lib/conversion';
import { normalizeExtractedIngredients, normalizePrepWords, normalizeExtractedInstructions } from '../../../lib/recipeNormalize';
import { normalizeRemixChanges, sanitizeSubstitutions } from '../../../lib/recipeRemix';

const VALID_GENRES = [
    'Italian', 'Mexican', 'Asian', 'Indian', 'Mediterranean', 'American',
    'French', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Greek',
    'Chinese', 'Vietnamese', 'Other'
];

const VALID_TIMES = ['short', 'medium', 'long'];
const VALID_MEALS = ['Breakfast', 'Lunch', 'Main', 'Entree', 'Dessert', 'Snack'];
const VALID_CARB_TYPES = ['Rice', 'Bread/Wraps', 'Pasta/Noodles', 'Potato', 'Quinoa', 'None/Other'];
const VALID_UNITS = Object.keys(quantity_unit_conversions);

const normalizeRecipe = (data, fallback) => {
    if (data.ingredients && Array.isArray(data.ingredients)) {
        data.ingredients = normalizeExtractedIngredients(data.ingredients);
        data.ingredients = normalizePrepWords(data.ingredients);
    }
    if (!Array.isArray(data.instructions)) data.instructions = [];
    data.instructions = normalizeExtractedInstructions(data.instructions);
    if (!VALID_GENRES.includes(data.genre)) data.genre = fallback?.genre || 'Other';
    data.mealTypes = Array.isArray(data.mealTypes) ? data.mealTypes.filter(m => VALID_MEALS.includes(m)) : (fallback?.mealTypes || []);
    if (!data.servings || isNaN(Number(data.servings))) data.servings = fallback?.servings || 4;
    else data.servings = Number(data.servings);
    if (!VALID_CARB_TYPES.includes(data.carbType)) data.carbType = fallback?.carbType || 'None/Other';
    data.time = VALID_TIMES.includes(data.time) ? data.time : (fallback?.time || 'medium');
    if (!data.name) data.name = fallback?.name;
    return data;
};

/**
 * Adapts an existing (baseline) recipe to a set of dietary requirements and/or
 * free-text notes, returning BOTH the updated recipe and a structured list of
 * the changes so the client can show what was swapped and offer alternatives.
 * Reused from the dish-list creation flow and intended for other pages later.
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
        const notes = String(req.body?.notes || '').trim();
        // Manual substitutions the user made in the review step, e.g.
        // { index: 2, from: 'Cod', to: 'Eggplant' }.
        const substitutions = sanitizeSubstitutions(req.body?.substitutions);

        if (!recipe || typeof recipe !== 'object') {
            return res.status(400).json({ success: false, message: 'A recipe object is required' });
        }

        const dietary = criteriaInstruction(criteria);

        // Nothing to adapt → return the recipe untouched with no changes.
        if (!dietary && !notes && substitutions.length === 0) {
            return res.status(200).json({ success: true, data: { recipe, changes: [] } });
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

        const substitutionLines = substitutions.map(s => {
            const at = s.index != null ? ` (ingredient index ${s.index})` : '';
            return `- "${s.from || s.to}" must become "${s.to}"${at}.`;
        });

        const adaptationBlock = `ADAPTATION REQUIREMENTS:
${dietary ? `- Dietary: ${dietary}` : ''}
${notes ? `- Additional notes from the user: ${notes}` : ''}
${substitutionLines.length ? `- USER-CHOSEN SUBSTITUTIONS (these override the AI's choice and MUST be applied consistently):
${substitutionLines.join('\n')}
- Name the ingredient exactly as above, and rewrite EVERY instruction that mentions the old ingredient — including when the method still refers to an earlier substitute that is no longer in the ingredient list — so the method uses the new ingredient. Adjust cooking times and temperatures to suit it.` : ''}
- Replace every non-conforming ingredient with a suitable substitute that keeps the dish recognisable, and rewrite any step that references a replaced ingredient.
- Put the substitute's plain name in 'Name' (use the substitute, NOT the original) and record it in 'Note' as "<substitute>, for <original>" (e.g. "soy butter, for butter"). Never leave 'Name' as the original when you substituted it.

Return a SINGLE JSON object with the FULL updated recipe plus a 'changes' array describing what you altered:
{
  "recipe": {
    "name": "recipe title",
    "ingredients": [{"Name": "the ingredient actually used (the substitute if you swapped one) with no preparation/state words", "Amount": "numeric or fraction", "AmountType": "one of: ${VALID_UNITS.join(', ')}", "Note": "prep state OR the substitution made — optional"}],
    "instructions": [{"Text": "step description", "Note": "optional tip or step time"}],
    "time": "one of: ${VALID_TIMES.join(', ')}",
    "genre": "one of: ${VALID_GENRES.join(', ')}",
    "mealTypes": ["one or more of: ${VALID_MEALS.join(', ')}"],
    "servings": number,
    "carbType": "one of: ${VALID_CARB_TYPES.join(', ')}"
  },
  "changes": [
    {"kind": "ingredient", "index": 0, "originalName": "Butter", "newName": "Soy butter", "newNote": "soy butter, for butter", "reason": "dairy-free swap", "alternatives": ["Soy butter", "Olive oil", "Coconut oil"]},
    {"kind": "step", "index": 2, "originalText": "Melt the butter over low heat.", "newText": "Melt the soy butter over low heat."}
  ]
}
RULES for 'changes':
- Only list ingredients/steps you actually changed. 'index' is the zero-based position in the recipe's arrays.
- For each changed ingredient provide 2-3 realistic alternative substitutes in 'alternatives' (include the one you chose as 'newName' first).
- Keep 'recipe' internally consistent with 'changes' (the chosen substitute must already be applied in recipe.ingredients[index]).
Output ONLY valid JSON, no markdown.`;

        const systemContent = `You are a culinary assistant expert at adapting recipes to dietary requirements and user notes while keeping them delicious and recognisable.

Adapt the provided recipe. Hard rules:
- Keep the dish's identity — substitute, don't reinvent.
- 'carbType' MUST reflect the primary carbohydrate actually in the adapted dish: Rice for rice dishes, Pasta/Noodles for pasta or noodles, Bread/Wraps for sandwiches/wraps/tortillas, Potato for potato dishes, Quinoa for quinoa dishes, None/Other otherwise.
${adaptationBlock}`;

        const userContent = `BASE RECIPE:\n${baseJson}\n\n${dietary ? `Dietary requirement to apply: ${dietary}` : ''}${notes ? `\nUser notes: ${notes}` : ''}`;

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

        const updated = normalizeRecipe(data.recipe || data, recipe);
        const changes = normalizeRemixChanges(data.changes, updated);

        return res.status(200).json({ success: true, data: { recipe: updated, changes } });
    } catch (err) {
        console.error('Remix recipe error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
