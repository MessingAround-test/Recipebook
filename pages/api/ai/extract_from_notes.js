import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';
import { quantity_unit_conversions } from "../../../lib/conversion";
import { normalizeExtractedIngredients } from '../../../lib/recipeNormalize';

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
                
Extract the following information:
1. 'name': The recipe title.
2. 'ingredients': Array of objects with:
   - 'Name': String (e.g., "Chicken Breast"). Do NOT include the amount or unit in this field.
   - 'Amount': String or Number (e.g., "500", "1.5", or "1/2"). This MUST be a numeric or fractional value only. Do NOT include unit strings like "g" or "cups" here.
   - 'AmountType': String. This MUST be one of the following exact keys: ${VALID_UNITS.join(', ')}.
   - 'Note': String (Optional extra info like "diced" or "room temperature").
3. 'instructions': Array of objects with:
   - 'Text': The step description.
   - 'Note': String (Optional tip or step number).
4. 'time': How long it takes. Use one of: "short", "medium", "long".
5. 'genre': The cuisine type. Use one of: ${VALID_GENRES.join(', ')}.
6. 'mealTypes': Array of strings. Use one or more of: ${VALID_MEALS.join(', ')}.
7. 'servings': Number of servings.
8. 'carbType': The primary carbohydrate source. Use exactly one of: ${VALID_CARB_TYPES.join(', ')}.

STRICT RULES:
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
