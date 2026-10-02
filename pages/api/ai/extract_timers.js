import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';
import { buildTimerMessages, parseTimerResult, parseAiJson } from '../../../lib/aiRecipeOps';

/** Normalizes instructions into the numbered string the prompt expects.
 *  Accepts a raw array of step texts / { Text } items, or already-built text. */
const normalizeInstructions = (instructions) => {
    if (Array.isArray(instructions)) {
        return instructions
            .map((i, idx) => {
                const text = String(typeof i === 'string' ? i : i?.Text || i?.instruction || '').trim();
                if (!text) return '';
                const dur = typeof i === 'object' && i?.time ? ` (${i.time} min)` : '';
                return `${idx + 1}. ${text}${dur}`;
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

    const instructionsStr = normalizeInstructions(instructions);

    const messages = buildTimerMessages(recipeName, ingredients, instructionsStr);

    try {
        const responseText = await callGroqChat(messages, true);
        const data = parseAiJson(responseText);

        return res.status(200).json({ success: true, data: parseTimerResult(data) });
    } catch (error) {
        console.error("Error calling AI for timer extraction:", error);
        return res.status(500).json({ success: false, message: "Error processing request" });
    }
}
