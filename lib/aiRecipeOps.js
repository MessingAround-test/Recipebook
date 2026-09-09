/**
 * Shared prompt builders, parsers and post-processing helpers for the
 * recipe AI ops (prep-work extraction, timer extraction). Used by the
 * single-recipe AI endpoints (/api/ai/extract_prep_work, extract_timers)
 * and the admin bulk tool (/api/admin/bulkRecipeOps) so both behave
 * identically.
 */

// ---------- Prep work ----------

export function buildPrepWorkMessages(recipeName, ingredients, instructions) {
    return [
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

OUTPUT FORMAT:
Return a single JSON object with:
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
}

export function parsePrepWorkResult(data) {
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

    return result;
}

/** Formats ingredients ("Name (note)") for prep-work prompts. Notes may sit on
 *  either lowercase `note` (DB shape) or capital `Note` (editor shape). */
export function formatIngredientsWithNotes(ingredients) {
    return (ingredients || []).map(i =>
        `${i.Name}${i.note || i.Note ? ` (${i.note || i.Note})` : ''}`
    ).join(', ');
}

/** Drops AI prep items whose action words overlap with the instruction text
 *  (prep already covered by cooking steps). Note-derived items are explicit
 *  user instructions and are always kept. */
export function dedupePrepAgainstInstructions(items, instructions) {
    if (!Array.isArray(instructions) || instructions.length === 0) return items;
    const instructionLower = instructions.map(i => String(i?.Text || '')).join(' ').toLowerCase();
    if (!instructionLower.trim()) return items;
    return items.filter(item => {
        if (item.fromNote) return true;
        const actionLower = (item.action || '').toLowerCase();
        const verbs = actionLower.split(/\s+/).filter(w => w.length > 3);
        const overlapCount = verbs.filter(v => instructionLower.includes(v)).length;
        return overlapCount < Math.ceil(verbs.length / 2);
    });
}

/** Returns a new instructions array with AI-estimated times applied
 *  (step is 1-indexed). Leaves the array untouched when possible. */
export function applyInstructionTimes(instructions, instructionTimes) {
    if (!Array.isArray(instructionTimes) || instructionTimes.length === 0 || !Array.isArray(instructions)) return instructions;
    return instructions.map((inst, idx) => {
        const timeData = instructionTimes.find(t => t.step === idx + 1);
        return timeData ? { ...inst, time: timeData.timeEstimate } : inst;
    });
}

// ---------- Timer extraction ----------

export function buildTimerMessages(recipeName, ingredients, instructions) {
    return [
        {
            role: "system",
            content: `You are a culinary timer assistant. Given a recipe name, its ingredients, and the cooking instructions (with time estimates), analyze and create a cooking timer plan.

Your job is to create a minimal, high-signal timer plan: only steps where a timer genuinely helps the cook stay on track. Timers that restate what the cook is already watching are noise.

RULES:
1. Create a timer (type: "timer") ONLY for steps with a passive, unattended waiting period (baking, roasting, boiling, simmering, resting, marinating, proofing, chilling, steeping) whose duration is explicitly stated in the instruction text (e.g., "bake for 40 min", "simmer 20 minutes") AND is about 5 minutes or longer. Stated durations under about 5 minutes never get timers (e.g., "steam milk for 3 min", "sizzle for 30 seconds").
2. Exception to requiring a stated duration: if a passive wait has NO stated duration but is clearly long (about 15 minutes or more, e.g., "chill until set", "proof until doubled", "marinate overnight"), create a timer using your best estimate. Otherwise, never invent a duration to justify a timer.
3. Hands-on/attended steps NEVER get timers, even when a time is stated (e.g., "stir-fry for 2 minutes", "sauté for 5 min, stirring") - the cook is already watching them.
4. Steps with no meaningful duration (e.g., "heat the oil", "season to taste", "garnish") and steps driven by equipment that signals its own completion (espresso machine, steam wand, kettle, rice cooker, blender) never get timers.
5. Use "start" as the timerId for timers that begin at the start of cooking.
6. For sequential steps (e.g., "then roast cauliflower"), the later timer depends on the previous timer with offset 0.
7. For overlapping steps (e.g., "when potatoes have 15 min remaining, start rice"), the later timer depends on the earlier timer with a NEGATIVE offset (e.g., -15).
8. For multi-stage steps (e.g., "bake for 40 min, check at 20 min"), create a checkpoint (type: "checkpoint") that depends on the parent timer with offset equal to the checkpoint minute. The checkpoint has duration: 0 and parentTimerId set to the parent timer's ID.
9. For steps that depend on multiple conditions being met (e.g., "when both X and Y are done"), create a sync timer (duration: 0) with multiple dependencies.
10. Each timer/checkpoint gets a unique ID: "timer-1", "timer-2", etc. for timers, "ckpt-1", "ckpt-2", etc. for checkpoints.
11. Link each timer to its instruction step via stepIndex (1-indexed matching instruction order).
12. Calculate dependencies based on the CUMULATIVE time of preceding steps. If step 1 takes 10 min and step 2 takes 15 min, step 3 starts at offset 25 from start.

OUTPUT FORMAT:
Return a JSON object with:
- "timers": array of timer/checkpoint objects
- "instructionTimes": array of { step, timeEstimate } for updating step times

Each timer object:
{
  "id": "timer-1",
  "type": "timer",
  "name": "Bake Potatoes",
  "duration": 40,
  "dependencies": [{"timerId": "start", "offset": 0}],
  "stepIndex": 1,
  "notes": ""
}

Each checkpoint object:
{
  "id": "ckpt-1",
  "type": "checkpoint",
  "name": "Check potatoes",
  "duration": 0,
  "dependencies": [{"timerId": "timer-1", "offset": 20}],
  "parentTimerId": "timer-1",
  "stepIndex": 1,
  "notes": ""
}

EXAMPLES:

Example 1 - Simple sequential:
Instructions: "1. Bake potatoes for 40 min. 2. While potatoes bake, cook rice for 15 min."
→ timer-1: bake potatoes, duration 40, deps: [{timerId: "start", offset: 0}]
→ timer-2: cook rice, duration 15, deps: [{timerId: "start", offset: 0}] (parallel, both start at beginning)

Example 2 - Dependency with offset:
Instructions: "1. Cook potatoes for 60 min. 2. When 15 min remaining, start cooking rice for 15 min."
→ timer-1: cook potatoes, duration 60, deps: [{timerId: "start", offset: 0}]
→ timer-2: cook rice, duration 15, deps: [{timerId: "timer-1", offset: -15}]

Example 3 - Queue:
Instructions: "1. Roast potatoes for 60 min. 2. Then roast cauliflower for 30 min. 3. Then roast garlic for 20 min."
→ timer-1: roast potatoes, duration 60, deps: [{timerId: "start", offset: 0}]
→ timer-2: roast cauliflower, duration 30, deps: [{timerId: "timer-1", offset: 0}]
→ timer-3: roast garlic, duration 20, deps: [{timerId: "timer-2", offset: 0}]

Example 4 - Multi-stage with checkpoint:
Instructions: "Bake for 40 min, checking at 20 min."
→ timer-1: bake, duration 40, deps: [{timerId: "start", offset: 0}]
→ ckpt-1: check, type checkpoint, duration 0, deps: [{timerId: "timer-1", offset: 20}], parentTimerId: "timer-1"

Example 5 - Depend on checkpoint:
Instructions: "1. Bake potatoes for 40 min, checking at 20 min. 2. When you check the potatoes, start the rice."
→ timer-1: bake potatoes, duration 40, deps: [{timerId: "start", offset: 0}]
→ ckpt-1: check potatoes, type checkpoint, duration 0, deps: [{timerId: "timer-1", offset: 20}], parentTimerId: "timer-1"
→ timer-2: cook rice, duration 15, deps: [{timerId: "ckpt-1", offset: 0}]

Example 6 - When NOT to create timers:
Instructions: "1. Heat oil in a skillet. 2. Season the steak. 3. Rest the steak for 5 min."
→ timer-1: rest steak, duration 5, deps: [{timerId: "start", offset: 0}] (step 3 qualifies: passive, stated duration at the 5-min floor; steps 1-2 have no meaningful duration - no timers)

Example 7 - Short/hands-on/equipment-driven steps:
Instructions: "1. Pull espresso (2 min). 2. Steam oat milk (3 min). 3. Combine and serve."
→ (no timers - steps 1-2 are short, hands-on, equipment-driven; step 3 has no duration)

Be selective. A short plan of timers that matter is better than a noisy one. When in doubt, omit the timer. Never invent durations for timer purposes. A recipe with zero timers is a valid result. Use negative offsets for "start X min before Y completes". Use offset 0 for "start when Y completes".`
        },
        {
            role: "user",
            content: `Recipe: "${recipeName}"${ingredients ? `\nIngredients: ${ingredients}` : ''}${instructions ? `\nInstructions: ${instructions}` : ''}`
        }
    ];
}

export function parseTimerResult(data) {
    const result = {};

    if (Array.isArray(data.timers)) {
        result.timers = data.timers
            .filter(item => item && item.name && typeof item.name === 'string')
            .map(item => ({
                id: item.id || `timer-${Math.random().toString(36).slice(2, 8)}`,
                type: item.type === 'checkpoint' ? 'checkpoint' : 'timer',
                name: item.name,
                duration: typeof item.duration === 'number' ? Math.max(0, Math.round(item.duration)) : 0,
                dependencies: Array.isArray(item.dependencies)
                    ? item.dependencies.map(d => ({
                        timerId: d.timerId || 'start',
                        offset: typeof d.offset === 'number' ? d.offset : 0
                    }))
                    : [{ timerId: 'start', offset: 0 }],
                parentTimerId: item.parentTimerId || undefined,
                order: typeof item.order === 'number' ? item.order : 0,
                stepIndex: typeof item.stepIndex === 'number' ? Math.max(0, item.stepIndex - 1) : undefined,
                notes: item.notes || ''
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

    return result;
}

// ---------- Shared ----------

/** Parses an AI response into JSON with a lenient fallback for markdown fences. */
export function parseAiJson(responseText) {
    try {
        return JSON.parse(responseText);
    } catch {
        const match = responseText.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error("Failed to parse AI response as JSON");
    }
}

/** Fingerprint of ingredient name::note pairs — used to detect note changes
 *  and trigger prep re-extraction (must match the client's format). */
export function computePrepNotesHash(ingredients) {
    return (ingredients || [])
        .map(i => `${String(i.Name || '').trim()}::${String(i.note || '').trim()}`)
        .join('|');
}
