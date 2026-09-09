import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';
import { buildPrepWorkMessages, parsePrepWorkResult, parseAiJson } from '../../../lib/aiRecipeOps';

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        const recipeName = req.query.recipeName;
        const ingredients = req.query.ingredients;
        const instructions = req.query.instructions;

        if (!recipeName) {
            return res.status(400).json({ success: false, message: "Missing recipeName" });
        }

        const messages = buildPrepWorkMessages(recipeName, ingredients, instructions);

        const responseText = await callGroqChat(messages, true);
        const data = parseAiJson(responseText);

        return res.status(200).json({ success: true, data: parsePrepWorkResult(data) });
    } catch (error) {
        console.error("Error calling AI for prep work extraction:", error);
        return res.status(500).json({ success: false, message: "Error processing request" });
    }
}
