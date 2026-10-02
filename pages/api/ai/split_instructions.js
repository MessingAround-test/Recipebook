import { verifyToken } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai'
import { findGiantInstructionIndexes, buildSplitGiantStepsMessages, applyStepSplits, parseSplitGiantStepsResult, parseAiJson } from '../../../lib/aiRecipeOps'

/**
 * Splits giant "block" instruction steps into granular steps via AI — but only
 * the flagged monster blocks; everything else passes through untouched. The
 * result preserves each replaced step's sectionName (JSON-LD HowToSection
 * grouping) and renumbers with global stepNumber. Every instruction item
 * should carry `instruction` (optionally `Text` / `sectionName`).
 * Expects ?instructions=<JSON array> and returns
 * { success, data: { instructions }, splitCount }.
 */
export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, data: null, message: 'Not supported request' })
    }

    let instructions
    try {
        instructions = JSON.parse(req.query.instructions || '')
    } catch {
        return res.status(400).json({ success: false, data: null, message: 'instructions must be a JSON array' })
    }
    if (!Array.isArray(instructions) || instructions.length === 0) {
        return res.status(400).json({ success: false, data: null, message: 'instructions must be a non-empty JSON array' })
    }

    const giant = findGiantInstructionIndexes(instructions)
    if (giant.length === 0) {
        return res.status(200).json({ success: true, data: { instructions }, splitCount: 0, message: 'No giant steps detected' })
    }

    try {
        const giantTexts = giant.map(i => instructions[i].instruction || instructions[i].Text)
        const responseText = await callGroqChat(buildSplitGiantStepsMessages(giantTexts), true)
        const splits = parseSplitGiantStepsResult(parseAiJson(responseText), giant.length)
        if (!splits) {
            return res.status(200).json({ success: true, data: { instructions }, splitCount: 0, message: 'AI returned no usable splits' })
        }
        const merged = applyStepSplits(instructions, splits, giant.map(i => instructions[i]))
        const finalInstructions = merged.map((s, i) => ({ ...s, stepNumber: i + 1 }))
        return res.status(200).json({
            success: true,
            data: { instructions: finalInstructions },
            splitCount: giant.length,
            message: ''
        })
    } catch (error) {
        console.error('[ai/split_instructions] Failed:', error)
        return res.status(500).json({ success: false, data: null, message: 'Error processing request' })
    }
}
