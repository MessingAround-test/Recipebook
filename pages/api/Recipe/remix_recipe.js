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
 * Normalises the AI's change list against the returned recipe so the client
 * can render what changed and offer substitution options.
 */
const normalizeChanges = (changes, recipe) => {
    if (!Array.isArray(changes)) return [];
    const out = [];
    for (const c of changes) {
        const kind = c.kind === 'step' ? 'step' : 'ingredient';
        const index = Number(c.index);
        if (!Number.isInteger(index) || index < 0) continue;
        if (kind === 'ingredient') {
            const ing = Array.isArray(recipe?.ingredients) ? recipe.ingredients[index] : null;
            const originalName = String(c.originalName || ing?.Name || '').trim();
            const newName = String(c.newName || ing?.Name || originalName).trim();
            let alternatives = Array.isArray(c.alternatives) ? c.alternatives.map(s => String(s).trim()).filter(Boolean) : [];
            if (!alternatives.includes(newName)) alternatives = [newName, ...alternatives];
            // De-dupe while preserving order.
            alternatives = Array.from(new Set(alternatives));
            out.push({
                kind: 'ingredient',
                index,
                originalName,
                newName,
                newNote: c.newNote != null ? String(c.newNote) : '',
                reason: c.reason ? String(c.reason) : '',
                alternatives
            });
        } else {
            const step = Array.isArray(recipe?.instructions) ? recipe.instructions[index] : null;
            out.push({
                kind: 'step',
                index,
                originalText: String(c.originalText || step?.Text || '').trim(),
                newText: String(c.newText || step?.Text || '').trim()
            });
        }
    }
    return out;
};

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

        if (!recipe || typeof recipe !== 'object') {
            return res.status(400).json({ success: false, message: 'A recipe object is required' });
        }

        const dietary = criteriaInstruction(criteria);

        // Nothing to adapt → return the recipe untouched with no changes.
        if (!dietary && !notes) {
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

        const adaptationBlock = `ADAPTATION REQUIREMENTS:
${dietary ? `- Dietary: ${dietary}` : ''}
${notes ? `- Additional notes from the user: ${notes}` : ''}
- Replace every non-conforming ingredient with a suitable substitute that keeps the dish recognisable, and rewrite any step that references a replaced ingredient.
- Record each substitution in the ingredient's 'Note' (e.g. "soy butter, for butter").

Return a SINGLE JSON object with the FULL updated recipe plus a 'changes' array describing what you altered:
{
  "recipe": {
    "name": "recipe title",
    "ingredients": [{"Name": "BASE ingredient only", "Amount": "numeric or fraction", "AmountType": "one of: ${VALID_UNITS.join(', ')}", "Note": "prep state OR the substitution made — optional"}],
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
        const changes = normalizeChanges(data.changes, updated);

        return res.status(200).json({ success: true, data: { recipe: updated, changes } });
    } catch (err) {
        console.error('Remix recipe error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
