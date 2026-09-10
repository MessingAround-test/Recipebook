import dbConnect from './dbConnect';
import Recipe from '../models/Recipe';
import CarbType from '../models/CarbType';
import { callGroqChat } from './ai';
import {
    buildCarbDetectMessages,
    parseCarbDetectResult,
    findCarbMentionInInstructions
} from './carbSideOps';
import { parseAiJson } from './aiRecipeOps';

/** One-shot carb side analysis for a recipe.
 *
 *  Runs on ANY recipe (not just ones pre-marked) and answers everything the
 *  editor's "Serve with a carb side?" needs automatically:
 *   - needsCarbSide (AI decision; drives the checkbox)
 *   - alreadyInInstructions (a carb side already exists in the steps =>
 *     recipe's own timing wins, nothing is injected)
 *  Phase lists and insert points are deliberately NOT persisted — they are
 *  computed at the last moment (Start Cooking) from the finish time and
 *  live step time estimates. AI is the single source of the decision, with
 *  a pure-text heuristic fallback for bulk runs. */
export async function analyzeCarbSideForRecipe(recipe, { force = false } = {}) {
    if (!recipe) throw new Error('Recipe not found')
    if (recipe.carbSide?.state === 'analyzed' && !force) {
        return { skipped: true, carbSide: recipe.carbSide }
    }

    await dbConnect()
    await CarbType.seedIfNeeded()
    const catalog = await CarbType.find({ active: { $ne: false } }).sort({ order: 1 }).lean()

    // The one AI use: detect (a) whether the recipe already cooks ANY catalog
    // carb as a served side and (b) whether the dish wants one at all.
    const detection = await detectCarbAlreadyIn(recipe, catalog)

    // needs: user mark wins when provided; AI decides for unmarked recipes
    const userMark = recipe.carbSide?.needs === true
        || recipe.carbSide?.customName?.trim()
    const needs = userMark === true
        ? true
        : (typeof recipe.carbSide?.needs === 'boolean' && !userMark ? recipe.carbSide.needs : detection.needsCarbSide)
        || detection.alreadyInInstructions

    const note = detection.alreadyInInstructions
        ? `${detection.carbType || 'A carb side'} is already handled in ${detection.reason || (typeof detection.matchedStepIndex === 'number' ? `step ${detection.matchedStepIndex + 1}` : 'the recipe steps')} — no side phases will be injected.`
        : needs !== true
            ? `AI: this dish doesn't call for a carb side${detection.reason ? ` — ${detection.reason}` : ''}.`
            : 'No carb side exists — phases are computed when you Start Cooking, slotted backwards from the finish time.'

    const carbSide = {
        needs: needs === true,
        state: 'analyzed',
        type: recipe.carbSide?.customName?.trim() || recipe.carbSide?.type || detection.carbType || '',
        customName: recipe.carbSide?.customName,
        analysis: {
            alreadyInInstructions: detection.alreadyInInstructions,
            matchedStepIndex: detection.matchedStepIndex,
            note
        },
        analyzedAt: new Date(),
        analysisModel: detection.model
    }

    await Recipe.updateOne({ _id: recipe._id }, { $set: { carbSide } })
    return { skipped: false, carbSide }
}

/** AI detection with a pure-text heuristic fallback. Checks for ANY catalog
 *  carb, or for the recipe's chosen one first when configured. */
async function detectCarbAlreadyIn(recipe, catalog) {
    try {
        const messages = buildCarbDetectMessages(
            recipe.name,
            catalog,
            recipe.instructions || []
        )
        const responseText = await callGroqChat(messages, true)
        const parsed = parseCarbDetectResult(parseAiJson(responseText), catalog)
        if (!parsed.ok) throw new Error('unparsable detection response')
        return parsed
    } catch (aiError) {
        console.error('carb already-in detection failed, using heuristic fallback:', aiError)
        for (const carbType of catalog || []) {
            const foundIdx = findCarbMentionInInstructions(carbType, recipe.instructions || [])
            if (isFound(foundIdx)) {
                return {
                    alreadyInInstructions: true,
                    carbType: carbType.name,
                    matchedStepIndex: foundIdx,
                    reason: 'matched by text search',
                    model: 'heuristic'
                }
            }
        }
        return { alreadyInInstructions: false, carbType: undefined, matchedStepIndex: undefined, reason: '', model: 'heuristic' }
    }
}

const isFound = (idx) => typeof idx === 'number' && idx >= 0


