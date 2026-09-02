import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';
import { quantity_unit_conversions } from "../../../lib/conversion";
import { normalizeExtractedIngredients, normalizeExtractedInstructions } from '../../../lib/recipeNormalize';

const VALID_GENRES = [
    'Italian', 'Mexican', 'Asian', 'Indian', 'Mediterranean', 'American',
    'French', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Greek',
    'Chinese', 'Vietnamese', 'Other'
];

const VALID_TIMES = ['short', 'medium', 'long'];
const VALID_MEALS = ['Breakfast', 'Lunch', 'Main', 'Entree', 'Dessert', 'Snack'];
const VALID_UNITS = Object.keys(quantity_unit_conversions);
const VALID_CARB_TYPES = ['Rice', 'Bread/Wraps', 'Pasta/Noodles', 'Potato', 'Quinoa', 'None/Other'];

export default async function handler(req, res) {
    logAPI(req)
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        const { notes } = req.body;

        if (!notes) {
            return res.status(400).json({ success: false, message: "Missing notes" });
        }

        const messages = [
            {
                role: "system",
                content: `You are a culinary assistant expert at extracting structured recipe data from unstructured notes, snippets, or messy text.

FIRST, assess how complete the notes are and pick a mode:
- TRANSCRIPTION MODE — the notes contain a clear ingredient list WITH quantities AND a cooking method/steps. In this mode you are a faithful transcriber: use the user's own wording for each step and do NOT paraphrase, add, remove, reorder, or "improve" any step (even trivial ones like "Preheat oven"). Copy ingredient amounts, units and qualifiers EXACTLY as written (e.g. "2 level cups", "room temperature"). Never round, convert, or estimate an amount the user already stated.
- GAP-FILL MODE — the notes are sparse (e.g. only an ingredient list, missing amounts, or no method). In this mode keep everything the user DID provide exactly as written, and fill ONLY the gaps: estimate sensible quantities for missing amounts and write the standard cooking method for the dish if none is given.

Extract the following information:
1. 'name': The recipe title.
2. 'ingredients': Array of objects with:
   - 'Name': String (e.g., "Chicken Breast"). Do NOT include the amount or unit in this field.
   - 'Amount': String or Number (e.g., "500", "1.5", or "1/2"). This MUST be a numeric or fractional value only. Do NOT include unit strings like "g" or "cups" here.
   - 'AmountType': String. This MUST be one of the following exact keys: ${VALID_UNITS.join(', ')}.
   - 'Note': String (Optional extra info like "diced" or "room temperature").
3. 'instructions': Array of objects with:
   - 'Text': The step description. Each step MUST be self-contained and include the relevant ingredient quantities inline (e.g. "Fry 500g chicken for 5 minutes" instead of "Fry the chicken"), using the amounts from the ingredient list.
   - 'Note': String (Optional tip or step number).
4. 'time': How long it takes. Use one of: "short", "medium", "long".
5. 'genre': The cuisine type. Use one of: ${VALID_GENRES.join(', ')}.
6. 'mealTypes': Array of strings. Use one or more of: ${VALID_MEALS.join(', ')}.
7. 'servings': Number of servings.
8. 'carbType': The primary carbohydrate source. Use exactly one of: ${VALID_CARB_TYPES.join(', ')}.

STRICT RULES:
- The cooking steps MUST be returned under the 'instructions' key as an array, even if the source text labels them "Method", "Directions", or "Steps". NEVER return them under a different key.
- Never invent or alter an amount that is stated in the notes. Never drop a step the user wrote.
- If a unit is not in the list, use 'each' and put the unit in 'Note' or 'Name'.
- 'Amount' must be clean. If you see "320g", 'Amount' is "320" and 'AmountType' is "gram".
- Output MUST be a single valid JSON object. No markdown.`
            },
            {
                role: "user",
                content: `Notes to extract from:\n\n${notes}`
            }
        ];

        const responseText = await callGroqChat(messages, true);
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            // Regex to find JSON block if AI added chatter
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) {
                data = JSON.parse(match[0]);
            } else {
                throw new Error("Failed to parse AI response as JSON");
            }
        }

        // Normalize the cooking method — the AI may return it under 'method'/'steps'
        // or as plain strings instead of a [{ Text, Note }] array
        data.instructions = normalizeExtractedInstructions(data.instructions ?? data.method ?? data.steps);
        delete data.method;
        delete data.steps;

        // Post-processing cleanup for ingredients
        if (data.ingredients && Array.isArray(data.ingredients)) {
            data.ingredients = normalizeExtractedIngredients(data.ingredients);
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error calling AI for recipe extraction:", error);
        return res.status(500).json({ success: false, message: "Error processing request: " + error.message });
    }
}
