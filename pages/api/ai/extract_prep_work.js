import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';

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

        const messages = [
            {
                role: "system",
                content: `You are a culinary assistant. Given a recipe name, its ingredients (with any prep notes in parentheses), and the cooking instructions, analyze what needs to be done.

1. Extract ALL prep work that needs to be done BEFORE cooking starts. Look for:
   - Action verbs: slice, dice, chop, mince, grate, peel, wash, trim, halve, quarter, zest, julienne, seed, stem, core, shred, crumble, mash, crush, press, soak, drain, rinse, pat dry, separate, fold, whisk, beat, blend, combine, toss, massage, etc.
   - Notes already on ingredients (in parentheses) - these are explicit instructions, ALWAYS include them as prep work, even if similar words appear in the cooking instructions. Set "fromNote": true on every prep item that comes directly from an ingredient note
   - Room temperature items (e.g., "bring eggs to room temperature") - only if explicitly stated
   - Equipment prep (e.g., "preheat oven", "line baking sheet") - only if explicitly stated

2. OPTIONAL PREP WORK: When an ingredient specifies a pre-prepared state (e.g., "Grilled Eggplant", "Marinated Artichokes", "Roasted Peppers", "Smoked Salmon", "Pickled Onions"), include the prep work needed to make that ingredient from scratch, but mark it as optional. This is for when the user can't find the pre-prepared version in stores. Use "optional": true for these items. Examples:
   - "Grilled Eggplant Slices" → optional prep: "slice and grill eggplant" (because user might find pre-grilled)
   - "Marinated Artichokes" → optional prep: "marinate artichokes in olive oil and herbs" (because user might find pre-marinated)
   - "Cooked Rice" → optional prep: "cook rice" (because user might find pre-cooked)

CRITICAL: Do NOT include any prep work that is ALREADY covered by the cooking instructions. For example, if an instruction says "slice the onions and sauté", do NOT include "slice onions" in prep work - only include prep that happens BEFORE the instructions begin.

IMPORTANT: Do NOT make assumptions about ingredient state. Only include prep work if the ingredient name or notes explicitly state it. For example, "rice" could be raw or cooked - do not assume it needs cooking. "cooked rice" means it's already cooked. Only act on what is explicitly written. Pre-prepared ingredients (like "Grilled Eggplant") should be noted as optional alternatives.

UNITS: Always use metric/Celsius. Convert temperatures to Celsius (e.g., 400°F → 200°C). Use standard metric units: ml for liquids, g for weight, cm for measurements. Do not use imperial units.

2. Estimate time in minutes for EACH cooking instruction step. Consider:
   - The actual cooking/processing time, NOT just heating time (e.g., "fry the onions" means time to actually fry them until done, not just heating the oil)
   - Active cooking time (stirring, flipping, waiting for browning)
   - Waiting time (simmering, baking, resting)
   - Be realistic but conservative
   - For frying/sautéing: estimate time to cook the ingredient until properly done (e.g., onions until golden = ~5-8 min)
   - CRITICAL: Read ALL steps together before assigning times. If multiple frying steps use the same pan, do NOT double-count heating time. For example, "fry onions" then "fry garlic" in the same pan = only 1x heating time, plus the sequential cooking time for each. Steps that can happen in parallel (e.g., frying in one pan while boiling in another) should be estimated independently, but sequential steps sharing equipment should account for shared prep/heating time.

Output MUST be a single JSON object with:
- "prepWork": array of objects with "ingredient" (string or null for general tasks), "action" (string describing the prep), "timeEstimate" (number in minutes), "optional" (boolean, true for pre-prepared ingredient alternatives), and "fromNote" (boolean, true when the action comes directly from an ingredient note)
- "instructionTimes": array of objects with "step" (1-indexed number matching instruction order) and "timeEstimate" (number in minutes)

Example:
{
  "prepWork": [
    {"ingredient": "carrot", "action": "peel and slice into rounds", "timeEstimate": 3, "optional": false},
    {"ingredient": "garlic", "action": "mince", "timeEstimate": 2, "optional": false, "fromNote": true},
    {"ingredient": "eggplant", "action": "slice and grill eggplant", "timeEstimate": 10, "optional": true},
    {"ingredient": null, "action": "preheat oven to 200°C", "timeEstimate": 1, "optional": false}
  ],
  "instructionTimes": [
    {"step": 1, "timeEstimate": 10},
    {"step": 2, "timeEstimate": 15}
  ]
}

Be thorough but practical. Only include prep work that is actually necessary and not already in the instructions. Always mark pre-prepared ingredient alternatives as optional.`
            },
            {
                role: "user",
                content: `Recipe: "${recipeName}"${ingredients ? `\nIngredients: ${ingredients}` : ''}${instructions ? `\nInstructions: ${instructions}` : ''}`
            }
        ];

        const responseText = await callGroqChat(messages, true);
        const data = JSON.parse(responseText);

        const result = {};

        if (Array.isArray(data.prepWork)) {
            result.prepWork = data.prepWork
                .filter(item => item && item.action && typeof item.action === 'string')
                .map(item => ({
                    ingredient: item.ingredient || null,
                    action: item.action,
                    timeEstimate: typeof item.timeEstimate === 'number' ? Math.max(1, Math.round(item.timeEstimate)) : null,
                    isCustom: false,
                    optional: item.optional === true,
                    fromNote: item.fromNote === true
                }));
        }

        if (Array.isArray(data.instructionTimes)) {
            result.instructionTimes = data.instructionTimes
                .filter(item => item && typeof item.step === 'number' && typeof item.timeEstimate === 'number')
                .map(item => ({
                    step: item.step,
                    timeEstimate: Math.max(1, Math.round(item.timeEstimate))
                }));
        }

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error("Error calling AI for prep work extraction:", error);
        return res.status(500).json({ success: false, message: "Error processing request" });
    }
}
