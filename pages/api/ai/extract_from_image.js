import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';
import { callGeminiVision } from '../../../lib/ai';
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

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

export default async function handler(req, res) {
    logAPI(req)
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        const { image, notes } = req.body;

        if (!image) {
            console.error("[AI-Extract] Request received but missing image data");
            return res.status(400).json({ success: false, message: "Missing image" });
        }

        console.log(`[AI-Extract] Processing image upload. Payload size: ${(image.length / 1024 / 1024).toFixed(2)} MB`);

        // Validate and clean base64 data
        let base64Image = image;
        let mimeType = "image/jpeg";
        if (base64Image.startsWith('data:image/')) {
            const matches = base64Image.match(/^data:image\/([a-zA-Z]+);base64,(.*)$/);
            if (matches && matches.length === 3) {
                mimeType = `image/${matches[1]}`;
                base64Image = matches[2]; // get the raw base64 data
                console.log(`[AI-Extract] Detected MIME type: ${mimeType}`);
            }
        }

        const promptText = `You are a culinary assistant expert at extracting structured recipe data from an image of a dish.
                
Analyze the image to identify the dish and estimate quantities based on the serving size shown.
Make assumptions for steps and other ingredients which are not immediately obvious based on what the dish is.

${notes ? `CRITICAL USER INSTRUCTION / ADAPTATION NOTES:\nThe user has provided the following note to adapt the recipe (e.g. vegetarian): "${notes}".\nEnsure you apply this adaptation! Replace items based on this note.\n\n` : ''}

Extract the following information:
1. 'name': The recipe title (incorporating adaptations).
2. 'ingredients': Array of objects with:
   - 'Name': String (e.g., "Chicken Breast"). Do NOT include the amount or unit in this field.
   - 'Amount': String or Number (e.g., "500", "1.5", or "1/2"). This MUST be a numeric or fractional value only. Do NOT include unit strings like "g" or "cups" here.
   - 'AmountType': String. This MUST be one of the following exact keys: ${VALID_UNITS.join(', ')}.
   - 'Note': String (Optional extra info like "diced" or "room temperature").
3. 'instructions': Array of objects with:
   - 'Text': The step description. Each step MUST be self-contained and include the relevant ingredient quantities inline (e.g. "Fry 500g chicken for 5 minutes" instead of "Fry the chicken").
   - 'Note': String (Optional tip or step number).
4. 'time': How long it takes. Use one of: "short", "medium", "long".
5. 'genre': The cuisine type. Use one of: ${VALID_GENRES.join(', ')}.
6. 'mealTypes': Array of strings. Use one or more of: ${VALID_MEALS.join(', ')}.
7. 'servings': Number of servings (estimated from image).
8. 'carbType': The primary carbohydrate source. Use exactly one of: ${VALID_CARB_TYPES.join(', ')}.

STRICT RULES:
- The cooking steps MUST be returned under the 'instructions' key. NEVER use a different key such as 'method'.
- Use metric units (gram, ml) and tablespoons primarily. Avoid fluid ounces and ounces unless no other unit makes sense.
- If a unit is not in the list, use 'each' and put the unit in 'Note' or 'Name'.
- 'Amount' must be clean. If you see "320g", 'Amount' is "320" and 'AmountType' is "gram".
- Output MUST be a single valid JSON object. No markdown.`;

        console.log("[AI-Extract] Calling Gemini Vision API...");
        const responseText = await callGeminiVision(promptText, base64Image, mimeType, true);
        console.log("[AI-Extract] Gemini response received. Length:", responseText?.length || 0);
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
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

        // Post-processing cleanup for ingredients (unit resolution + cleanup)
        if (data.ingredients && Array.isArray(data.ingredients)) {
            data.ingredients = normalizeExtractedIngredients(data.ingredients);
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error calling AI for recipe extraction:", error);
        return res.status(500).json({ success: false, message: "Error processing request: " + error.message });
    }
}
