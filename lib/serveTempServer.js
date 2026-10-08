import dbConnect from './dbConnect';
import Recipe from '../models/Recipe';
import { callGroqChat } from './ai';
import { parseAiJson } from './aiRecipeOps';
import { buildServeTempMessages, parseServeTempResult, heuristicServeTemp } from './serveTempOps';

// Pure builders/heuristics live in serveTempOps (importable client-side).
export { buildServeTempMessages, parseServeTempResult, heuristicServeTemp };

// ---------- Server pipeline ----------

/** One-shot serving-temperature analysis for a recipe. User-set values always
 *  win; AI analysis happens once and is persisted like the carb analysis. */
export async function analyzeServeTempForRecipe(recipe, { force = false } = {}) {
    if (!recipe) throw new Error('Recipe not found')

    const source = recipe.serveTempSource
    const alreadyAnalyzed = (source === 'ai' || source === 'heuristic') && recipe.serveTemp
    if (alreadyAnalyzed && !force) {
        return { skipped: true, serveTemp: recipe.serveTemp, reheatMinutes: recipe.reheatMinutes, source }
    }

    await dbConnect()
    let analyzed
    try {
        const responseText = await callGroqChat(buildServeTempMessages(recipe), true)
        const parsed = parseServeTempResult(parseAiJson(responseText))
        if (!parsed.ok) throw new Error('unparsable serve-temp response')
        analyzed = {
            serveTemp: parsed.serveTemp,
            reheatMinutes: parsed.serveTemp === 'reheatable' ? parsed.reheatMinutes : recipe.reheatMinutes || 0,
            source: 'ai',
            reason: parsed.reason
        }
    } catch (aiError) {
        console.error('serve-temp analysis failed, using heuristic fallback:', aiError)
        const fb = heuristicServeTemp(recipe)
        analyzed = {
            serveTemp: fb.serveTemp,
            reheatMinutes: fb.serveTemp === 'reheatable' ? (fb.reheatMinutes || 5) : (recipe.reheatMinutes || 0),
            source: 'heuristic',
            reason: 'matched by keyword search'
        }
    }

    // Never overwrite a user decision except on an explicit force re-run of a
    // user value... which we also respect: user marks only disappear from the
    // editor, never from analysis.
    if (source === 'user' && !force) {
        return { skipped: true, serveTemp: recipe.serveTemp, reheatMinutes: recipe.reheatMinutes, source }
    }

    await Recipe.updateOne(
        { _id: recipe._id },
        { $set: { serveTemp: analyzed.serveTemp, reheatMinutes: analyzed.reheatMinutes, serveTempSource: analyzed.source } }
    )
    return { skipped: false, ...analyzed }
}
