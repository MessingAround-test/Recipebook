import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';
import { buildPrepWorkMessages, parsePrepWorkResult, parseAiJson } from '../../../lib/aiRecipeOps';

/** Normalizes instructions into the numbered string the prompt expects.
 *  Accepts a raw array of step texts / { Text } items, or an already-built
 *  string. Numbered lines let the AI map 'step' to the printed index instead
 *  of counting steps itself. */
const normalizeInstructions = (instructions) => {
    if (Array.isArray(instructions)) {
        return instructions
            .map((i, idx) => {
                const text = String(typeof i === 'string' ? i : i?.Text || i?.instruction || '').trim();
                return text ? `${idx + 1}. ${text}` : '';
            })
            .filter(Boolean)
            .join('\n');
    }
    return typeof instructions === 'string' ? instructions : '';
}

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        // POST body so very long instruction lists never hit the 414 URL-size
        // limit; GET remains a fallback for older clients.
        let recipeName
        let ingredients
        let instructions
        if (req.method === 'POST') {
            ({ recipeName, ingredients, instructions } = req.body || {})
        } else {
            recipeName = req.query.recipeName;
            ingredients = req.query.ingredients;
            instructions = req.query.instructions;
        }

        if (!recipeName) {
            return res.status(400).json({ success: false, message: "Missing recipeName" });
        }

        const messages = buildPrepWorkMessages(recipeName, ingredients, normalizeInstructions(instructions));

        const responseText = await callGroqChat(messages, true);
        const data = parseAiJson(responseText);

        return res.status(200).json({ success: true, data: parsePrepWorkResult(data) });
    } catch (error) {
        console.error("Error calling AI for prep work extraction:", error);
        return res.status(500).json({ success: false, message: "Error processing request" });
    }
}
