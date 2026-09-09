import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';
import { quantity_unit_conversions } from "../../../lib/conversion";
import { normalizeExtractedIngredients, normalizePrepWords } from '../../../lib/recipeNormalize';

const VALID_UNITS = Object.keys(quantity_unit_conversions);

/**
 * Takes the raw ingredient rows produced by the recipe-site parsers
 * ({ name, quantity, quantity_unit }) and asks the AI to split the core
 * ingredient from its prep work ("chopped garlic" -> garlic + note
 * "chopped"), returning clean saveable rows. Used only during recipe
 * creation; if it fails the caller falls back to the raw parse.
 */
export default async function handler(req, res) {
    logAPI(req)
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        const { ingredients } = req.body;

        if (!Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ success: false, message: "Missing ingredients" });
        }

        // Cap the list so a huge page can't blow the token budget
        const capped = ingredients.slice(0, 60);

        const messages = [
            {
                role: "system",
                content: `You are a culinary assistant that cleans up ingredient lists parsed from recipe websites.

For every ingredient, return a JSON object with:
- 'name': The core ingredient name with only prep work removed (e.g. "chopped garlic" -> "garlic", "boneless chicken breast fillets" -> "chicken breast").
- 'quantity': The numeric amount (number or fraction string like "1/2"). If none was given, use 1.
- 'quantity_unit': One of the valid units: ${VALID_UNITS.join(', ')}.
- 'note': The prep work removed from the name, plus other preparation details (e.g. "chopped", "finely diced", "at room temperature", "plus extra for frying"). Empty string if none.

PREP WORK (move to 'note') means physical preparation actions: chopped, diced, minced, sliced, grated, crushed, pounded, peeled, halved, quartered, trimmed, drained, rinsed, soaked, softened — and states like "at room temperature" or "plus extra for frying".

NOT prep work (must stay in the 'name') — variety, grade or type descriptors that are part of what the ingredient IS: "extra virgin" (olive oil), "white wine" (vinegar), "spring" (onions), "baby" (spinach), "sea" (salt), "plain" (flour), "full-fat" (milk), "sweet" (potato), "cherry" (tomatoes). These words must never be moved to the note or dropped.

STRICT RULES:
- Never merge or drop ingredients; return exactly one object per input, in the same order.
- When unsure whether a word is prep work or part of the ingredient name, leave it in the name.
- 'quantity' must be numeric/fraction only — no unit text.
- If the input unit is unknown, choose the closest valid unit.
- Output MUST be a single valid JSON object of shape { "ingredients": [...] }. No markdown.`
            },
            {
                role: "user",
                content: `Ingredients to format:\n${JSON.stringify(capped.map(i => ({ name: i.name, quantity: i.quantity, quantity_unit: i.quantity_unit })))}`
            }
        ];

        const responseText = await callGroqChat(messages, true);
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

        const formatted = Array.isArray(data?.ingredients) ? data.ingredients : null;
        if (!formatted || formatted.length === 0) {
            throw new Error("AI returned no ingredients");
        }

        // Per-item safety: any row the AI mangled (missing name or invalid
        // unit) falls back to the raw parsed row at that position
        const merged = capped.map((raw, i) => {
            const row = formatted[i];
            if (!row || !String(row.name || '').trim()) return raw;
            const unit = String(row.quantity_unit || '').trim().toLowerCase();
            if (!quantity_unit_conversions[unit]) return raw;
            return {
                name: String(row.name).trim(),
                quantity: row.quantity ?? raw.quantity,
                quantity_unit: unit,
                note: String(row.note || '').trim()
            };
        });

        // Same deterministic cleanup the AI extraction endpoints use
        const cleaned = normalizePrepWords(normalizeExtractedIngredients(
            merged.map(i => ({ Name: i.name, Amount: i.quantity, AmountType: i.quantity_unit, Note: i.note || undefined }))
        ));

        return res.status(200).json({ success: true, data: { ingredients: cleaned } });
    } catch (error) {
        console.error("Error formatting ingredients:", error);
        return res.status(500).json({ success: false, message: "Error processing request: " + error.message });
    }
}
