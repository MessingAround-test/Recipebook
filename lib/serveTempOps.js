// ---------- Message builder (pure, no DOM/db) ----------

/** One classification decision per recipe: is this dish served cold, does it
 *  come back after a reheat, or does it have to land hot at the serve moment?
 *  When "reheatable", also suggest a short reheat duration. */
export function buildServeTempMessages(recipe) {
    const ingredientList = (recipe.ingredients || [])
        .map(i => `- ${i?.Name ?? ''}`)
        .filter(Boolean)
        .join('\n')
    const instructionList = (recipe.instructions || [])
        .map((i, idx) => `${idx + 1}. ${i?.Text ?? ''}${typeof i?.time === 'number' ? ` (${i.time} min)` : ''}`)
        .join('\n')

    return [
        {
            role: 'system',
            content: `You are a recipe analyst. Decide how a recipe is served so a cooking scheduler knows whether it can be prepared early and held, or must be timed to the exact serve moment:

- "cold": served at room temperature or chilled (salads, coleslaws, salsas, dips, chilled desserts). Making it early changes nothing about quality.
- "reheatable": served hot but tolerates a hold + reheat without heavy quality loss (soups, stews, curries, braises, casseroles, rice, braised greens, baked pasta).
- "hot": served straight from the pan, quality collapses on hold or reheat (steaks, roast slices, fried food, pancakes, eggs, delicate fish).

If you answer "reheatable", also give "reheatMinutes": a SHORT warm-back duration (2-15). Only give it when the recipe doesn't already include its own reheat-style step.

OUTPUT: a single JSON object, nothing else:
{"serveTemp": "cold"|"reheatable"|"hot", "reheatMinutes": <number or null>, "reason": "<one short sentence>"}`
        },
        {
            role: 'user',
            content: `Recipe: "${recipe.name}"
Ingredients:
${ingredientList || '(none listed)'}
Instructions:
${instructionList || '(none)'}`
        }
    ]
}

export function parseServeTempResult(data) {
    const raw = data && typeof data === 'object' ? data : {}
    let serveTemp = typeof raw.serveTemp === 'string' ? raw.serveTemp.trim().toLowerCase() : ''
    if (!['cold', 'reheatable', 'hot'].includes(serveTemp)) serveTemp = ''
    let reheatMinutes = Number(raw.reheatMinutes)
    if (!Number.isFinite(reheatMinutes) || reheatMinutes <= 0) reheatMinutes = serveTemp === 'reheatable' ? 5 : 0
    reheatMinutes = Math.min(15, Math.max(2, Math.round(reheatMinutes)))
    return {
        ok: serveTemp !== '',
        serveTemp,
        reheatMinutes,
        reason: typeof raw.reason === 'string' ? raw.reason.trim() : ''
    }
}

/** Pure heuristic fallback: name/ingredients signals, no AI. */
export function heuristicServeTemp(recipe) {
    const hay = [
        recipe?.name || '',
        ...(Array.isArray(recipe?.mealTypes) ? recipe.mealTypes : []),
        recipe?.genre || '',
        ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients.map(i => i?.Name || '') : [])
    ].join(' ').toLowerCase()

    const has = (list) => list.some(word => hay.includes(word))
    const coldSignals = ['salad', 'coleslaw', 'slaw', 'salsa', 'dip', 'cold', 'chilled', 'pickl', 'smörgås', 'tabbouleh', 'gazpacho']
    const reheatSignals = ['soup', 'stew', 'braise', 'curry', 'chili', 'chilli', 'casserole', 'ragu', 'dahl', 'dal', 'chowder', 'broth', 'goulash', 'bean', 'lentil']

    if (has(coldSignals)) return { serveTemp: 'cold', reheatMinutes: 0 }
    if (has(reheatSignals)) return { serveTemp: 'reheatable', reheatMinutes: 5 }
    return { serveTemp: 'hot', reheatMinutes: 0 }
}

