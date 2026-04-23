import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';

const NUTRIENT_KEYS = [
    'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g', 'energy_kcal',
    'vitamin_a_ug', 'vitamin_b1_mg', 'vitamin_b2_mg', 'vitamin_b3_mg',
    'vitamin_b6_mg', 'vitamin_b12_ug', 'vitamin_c_mg', 'vitamin_d_ug',
    'vitamin_e_mg', 'vitamin_k_ug',
    'calcium_mg', 'iron_mg', 'magnesium_mg', 'phosphorus_mg',
    'potassium_mg', 'sodium_mg', 'zinc_mg',
];

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        const { ingredient_name } = req.query;

        if (!ingredient_name) {
            return res.status(400).json({ message: "Missing ingredient name" });
        }

        const messages = [
            {
                role: "system",
                content: `You are a nutrition and measurement expert. Your task is to estimate the average weight and nutritional values for a given ingredient.

Guidelines:
1. Return a FLAT JSON object with these exact keys (all values must be numbers, use 0 if unknown):
   - "grams_per_each": average weight in grams for one singular unit/each. If already a weight (e.g. '500g rice'), return 1. If liquid, assume 1g/ml.
   - "protein_g": Protein per 100g in grams
   - "fat_g": Total fat per 100g in grams
   - "carbohydrates_g": Total carbohydrates per 100g in grams
   - "fiber_g": Dietary fiber per 100g in grams
   - "energy_kcal": Energy content per 100g in kilocalories
   - "vitamin_a_ug": Vitamin A per 100g in micrograms
   - "vitamin_b1_mg": Vitamin B1 (Thiamine) per 100g in milligrams
   - "vitamin_b2_mg": Vitamin B2 (Riboflavin) per 100g in milligrams
   - "vitamin_b3_mg": Vitamin B3 (Niacin) per 100g in milligrams
   - "vitamin_b6_mg": Vitamin B6 per 100g in milligrams
   - "vitamin_b12_ug": Vitamin B12 per 100g in micrograms
   - "vitamin_c_mg": Vitamin C per 100g in milligrams
   - "vitamin_d_ug": Vitamin D per 100g in micrograms
   - "vitamin_e_mg": Vitamin E per 100g in milligrams
   - "vitamin_k_ug": Vitamin K per 100g in micrograms
   - "calcium_mg": Calcium per 100g in milligrams
   - "iron_mg": Iron per 100g in milligrams
   - "magnesium_mg": Magnesium per 100g in milligrams
   - "phosphorus_mg": Phosphorus per 100g in milligrams
   - "potassium_mg": Potassium per 100g in milligrams
   - "sodium_mg": Sodium per 100g in milligrams
   - "zinc_mg": Zinc per 100g in milligrams
2. Provide realistic average estimates for common grocery items.
3. Strictly NO conversational filler or markdown. Provide ONLY the JSON object.`
            },
            {
                role: "user",
                content: `Ingredient Name: '${ingredient_name}'`
            }
        ];

        const responseText = await callGroqChat(messages, true);
        console.log(`Groq response for [${ingredient_name}]:`, responseText);
        let parsedData;

        try {
            parsedData = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse Groq response:", responseText);
            throw new Error("Invalid JSON response from AI");
        }

        if (typeof parsedData.grams_per_each !== 'number') {
            console.warn("AI did not return a number for grams_per_each");
            parsedData.grams_per_each = 0;
        }

        // Ensure every nutrient key is a number, default to 0
        for (const key of NUTRIENT_KEYS) {
            const val = Number(parsedData[key]);
            parsedData[key] = isNaN(val) ? 0 : val;
        }

        return res.status(200).json({ success: true, data: parsedData })
    } catch (error) {
        console.error("Error calling Groq API for conversion:", error);
        return res.status(500).json({ success: false, message: "Error processing request" })
    }
}
