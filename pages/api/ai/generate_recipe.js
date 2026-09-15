import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { normalizeCriteria } from '../../../lib/dishLists/criteria';
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
 * Generates a single brand-new recipe for a dish name with NO dietary
 * constraints — the "normal" baseline. Callers (e.g. the remix flow) layer
 * dietary adaptation on top afterwards.
 */
export default async function handler(req, res) {
    logAPI(req);
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        const name = String(req.body?.name || '').trim();
        if (!name) {
            return res.status(400).json({ success: false, message: 'A dish name is required' });
        }
        // `criteria`/`extra` are accepted but intentionally ignored here — this
        // endpoint always returns the unrestricted baseline for remixing.
        const extra = String(req.body?.extra || '').trim();
        void normalizeCriteria(req.body?.criteria);

        const systemContent = `You are a world-class chef and culinary anthropologist who writes authentic, foolproof home recipes.

Write a SINGLE recipe for the given dish that is as TRADITIONAL and AUTHENTIC as possible — the version locals in the dish's home region would actually cook and eat, NOT a Westernised or fusion shortcut. Hard rules:
- Aim for how the dish is genuinely made and eaten by locals: authentic regional ingredients, traditional techniques, and typical serving style. Reflect the most recognised regional preparation and avoid generic "international" substitutions (e.g. prefer the real regional chillies/herbs/spices over a generic "seasoning", real local staples over convenience products).
- Still be home-cookable and delicious, but faithfulness to the traditional dish comes first.
- Do NOT apply any dietary substitutions — this is the unrestricted baseline that gets adapted afterwards.
- 'carbType' MUST reflect the primary carbohydrate actually in the traditional dish: Rice for rice dishes, Pasta/Noodles for pasta or noodles, Bread/Wraps for sandwiches/wraps/tortillas, Potato for potato dishes, Quinoa for quinoa dishes, None/Other otherwise.

Return a single JSON object:
{
  "name": "recipe title",
  "ingredients": [{"Name": "BASE ingredient only — the plain food, no preparation or state words (e.g. \\"avocado\\", NOT \\"mashed avocado\\" or \\"diced tomato\\")", "Amount": "numeric or fraction e.g. 500 | 1.5 | 1/2", "AmountType": "one of: ${VALID_UNITS.join(', ')}", "Note": "preparation or state (e.g. \\"mashed\\", \\"diced\\", \\"finely chopped\\") — optional"}],
  "instructions": [{"Text": "step description", "Note": "optional tip or step time"}],
  "time": "one of: ${VALID_TIMES.join(', ')}",
  "genre": "one of: ${VALID_GENRES.join(', ')}",
  "mealTypes": ["one or more of: ${VALID_MEALS.join(', ')}"],
  "servings": 4,
  "carbType": "one of: ${VALID_CARB_TYPES.join(', ')}"
}
If an ingredient has no natural amount, use Amount "1" and AmountType "each". Output ONLY valid JSON, no markdown.`;

        const userContent = `DISH: ${name}${extra ? `\nSTYLE NOTES (honour these while staying true to the traditional dish): ${extra}` : ''}

Write the most authentic, traditional version of this dish that you can — as close as possible to how locals would make and eat it.`;

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
        if (!VALID_GENRES.includes(data.genre)) data.genre = 'Other';
        data.mealTypes = Array.isArray(data.mealTypes) ? data.mealTypes.filter(m => VALID_MEALS.includes(m)) : [];
        if (!data.servings || isNaN(Number(data.servings))) data.servings = 4;
        else data.servings = Number(data.servings);
        if (!VALID_CARB_TYPES.includes(data.carbType)) data.carbType = 'None/Other';
        data.time = VALID_TIMES.includes(data.time) ? data.time : 'medium';

        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Generate recipe error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
