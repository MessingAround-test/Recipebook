import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';

export default async function handler(req, res) {
    logAPI(req)
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        const { nutrientLabel } = req.body;

        if (!nutrientLabel) {
            return res.status(400).json({ success: false, message: "Missing nutrientLabel" });
        }

        const User = require('../../../models/User').default;
        const user = await User.findById(decoded.id) || await User.findOne({ id: decoded.id });
        const preference = user?.dietary_preference || 'none';

        const messages = [
            {
                role: "system",
                content: `You are a nutrition expert. Suggest 10 ingredients that are exceptionally high in ${nutrientLabel}.
                Focus on whole foods like fresh produce, nuts, seeds, etc.
                
                IMPORTANT: The user has a dietary preference of "${preference}".
                - If "vegetarian": Do NOT suggest any meat or poultry. Seafood is also discouraged.
                - If "vegan": Do NOT suggest any animal products (no meat, poultry, seafood, dairy, or eggs).
                - If "pescetarian": Do NOT suggest any meat or poultry. Seafood is allowed.
                
                CRITICAL: Return ONLY a simple JSON array of strings (e.g. ["Item 1", "Item 2"]). 
                Do NOT return an object with a key. Do NOT return any markdown or extra text.`
            },
            {
                role: "user",
                content: `Suggest ingredients high in ${nutrientLabel}.`
            }
        ];

        const responseText = await callGroqChat(messages, true);
        let rawData;
        try {
            rawData = JSON.parse(responseText);
        } catch (e) {
            const match = responseText.match(/\[.*\]/s) || responseText.match(/\{.*\}/s);
            if (match) {
                rawData = JSON.parse(match[0]);
            } else {
                throw new Error("Failed to parse AI response as JSON");
            }
        }

        // Handle case where AI returns { "someKey": ["item1", "item2"] }
        let data = [];
        if (Array.isArray(rawData)) {
            data = rawData;
        } else if (typeof rawData === 'object' && rawData !== null) {
            // Find the first array in the object
            const firstArrayKey = Object.keys(rawData).find(key => Array.isArray(rawData[key]));
            if (firstArrayKey) {
                data = rawData[firstArrayKey];
            }
        }

        // Final safety check: ensure it's an array of strings
        if (!Array.isArray(data)) data = [];
        data = data.filter(item => typeof item === 'string');

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error calling AI for ingredient suggestions:", error);
        return res.status(500).json({ success: false, message: "Error processing request: " + error.message });
    }
}
