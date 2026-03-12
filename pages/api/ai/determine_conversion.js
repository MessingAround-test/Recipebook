import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';

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
                content: `You are a nutrition and measurement expert. Your task is to estimate the average weight in grams for exactly one "each" (singular unit) of a given ingredient.
        
Guidelines:
1. Return a JSON object with a single key "grams_per_each" and the numerical value.
2. Provide a realistic average estimate for common grocery items.
3. If the item is already a weight (e.g., '500g rice'), return 1 (as the unit is already grams). 
4. If it's a liquid, provide the weight in grams (assuming density of water 1g/ml if unknown).
5. Strictly NO conversational filler or markdown. Provide ONLY the JSON object. Output format: {"grams_per_each": number}`
            },
            {
                role: "user",
                content: `Ingredient Name: '${ingredient_name}'`
            }
        ];

        const responseText = await callGroqChat(messages, true);
        let parsedData;

        try {
            parsedData = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse Groq response:", responseText);
            throw new Error("Invalid JSON response from AI");
        }

        if (typeof parsedData.grams_per_each !== 'number') {
            console.warn("AI did not return a number for grams_per_each");
            parsedData = { grams_per_each: 0 };
        }

        return res.status(200).json({ success: true, data: parsedData })
    } catch (error) {
        console.error("Error calling Groq API for conversion:", error);
        return res.status(500).json({ success: false, message: "Error processing request" })
    }
}
