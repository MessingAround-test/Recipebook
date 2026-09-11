/**
 * Shared logic for the carb side-dish feature: prompt builders, result
 * parsing, insert-point math, timing resolution and recommendations.
 * Isomorphic (no DOM/node deps) so the client cooking modal can reuse
 * exactly the same math and parsers as the server analysis pipeline.
 */

// ---------- Seed catalog ----------

/** Default carb catalog contents — lazily seeded on first /api/carbTypes read.
 *  Each side is a sequence of phases (boil water -> cook -> fluff); phases
 *  with minutes: 0 are timer-less "do at the end" cards. Rice carries
 *  variants (white/brown): 5 min boil + 15/20 min cooking => the first phase
 *  lands 20/25 min before the end of the recipe, fluff rides the tail.
 *
 *  Serve quantities: `perServe` maps token names in instructions to cups per
 *  person (eg rice White: 1/4 cup rice + 1/2 cup water per serve). At cook
 *  time {qty:<field>} tokens are filled for the recipe's serving count. */
export const SEED_CARB_TYPES = [
    {
        name: 'Rice',
        order: 10,
        isSystem: true,
        aliases: ['jasmine rice', 'basmati rice', 'white rice', 'brown rice', 'long grain rice', 'steamed rice'],
        defaultStepText: 'Wash {qty:rice} of rice until the water runs clear. Measure out {qty:water} of water, bring it to the boil ({prep} min) and add the rice. Simmer covered for {cook} min without lifting the lid. Fluff with a fork before serving — serves {serves}.',
        variants: [
            {
                name: 'White', cookMinutes: 15, prepMinutes: 5,
                perServe: { rice: 0.25, water: 0.5 },
                phases: [
                    { name: 'Boil water', minutes: 5, instruction: 'Wash {qty:rice} of rice until the rinse water runs clear. Measure out {qty:water} of water and get it boiling, ready to add the rice.' },
                    { name: 'Add rice, simmer', minutes: 15, instruction: 'Add the rice, stir once, cover and reduce to a gentle simmer — no peeking. Simmer for 15 min.' },
                    { name: 'Fluff & rest', minutes: 0, instruction: 'Kill the heat and fluff the rice with a fork, covered, ready to serve — serves {serves}.' }
                ]
            },
            {
                name: 'Brown', cookMinutes: 20, prepMinutes: 5,
                perServe: { rice: 0.25, water: 0.5 },
                phases: [
                    { name: 'Boil water', minutes: 5, instruction: 'Wash {qty:rice} of rice until the rinse water runs clear. Measure out {qty:water} of water and get it boiling, ready to add the rice.' },
                    { name: 'Add rice, simmer', minutes: 20, instruction: 'Add the rice, stir once, cover and reduce to a gentle simmer — no peeking. Simmer for 20 min.' },
                    { name: 'Fluff & rest', minutes: 0, instruction: 'Kill the heat and fluff the rice with a fork, covered, ready to serve — serves {serves}.' }
                ]
            }
        ]
    },
    {
        name: 'Couscous',
        order: 20,
        isSystem: true,
        aliases: ['pearl couscous', 'giant couscous'],
        timing: { cookMinutes: 5, prepMinutes: 2 },
        perServe: { couscous: 0.3333, water: 0.5 },
        phases: [
            { name: 'Boil water', minutes: 3, instruction: 'Measure out {qty:water} of water in a jug and get it boiling for the couscous.' },
            { name: 'Steam covered', minutes: 5, instruction: 'Measure out {qty:couscous} of couscous, pour the boiling water over it in a bowl, cover and let it steam for 5 min.' },
            { name: 'Fluff', minutes: 0, instruction: 'Fluff the couscous with a fork and season to taste, ready to serve — serves {serves}.' }
        ],
        defaultStepText: 'Bring a pot of water to the boil, pour over the couscous in a bowl, cover and let it steam for 5 min. Fluff with a fork before serving.'
    },
    {
        name: 'Potato',
        order: 30,
        isSystem: true,
        aliases: ['roasted potatoes', 'mashed potatoes', 'new potatoes', 'boiled potatoes'],
        timing: { cookMinutes: 25, prepMinutes: 5 },
        perServe: { potato: 1 },
        phases: [
            { name: 'Get potatoes on', minutes: 5, instruction: 'Dice enough potatoes for {serves} serves (about {qty:potato}) and put them in a pot of cold, salted water.' },
            { name: 'Boil', minutes: 25, instruction: 'Keep the potatoes at a steady boil until fork-tender, then drain and mash or roast.' }
        ],
        defaultStepText: 'Dice the potatoes and boil in salted water for 20-25 min until fork-tender. Drain, then mash or roast while the main dish finishes.'
    },
    {
        name: 'Quinoa',
        order: 40,
        isSystem: true,
        aliases: [],
        timing: { cookMinutes: 15, prepMinutes: 5 },
        perServe: { quinoa: 0.25, water: 0.5 },
        phases: [
            { name: 'Rinse & boil', minutes: 5, instruction: 'Rinse {qty:quinoa} of quinoa. Measure out {qty:water} of water — about 2x the quinoa volume — and get it boiling.' },
            { name: 'Simmer', minutes: 15, instruction: 'Add the quinoa, cover and simmer for about 15 min until the water is absorbed.' },
            { name: 'Rest & fluff', minutes: 0, instruction: 'Take it off the heat, let it rest covered a moment, then fluff with a fork.' }
        ],
        defaultStepText: 'Rinse the quinoa, then simmer covered in 2x its volume of water for about 15 min until the water is absorbed. Rest covered for 5 min, then fluff with a fork.'
    },
    {
        name: 'Pasta/Noodles',
        order: 50,
        isSystem: true,
        aliases: ['noodles', 'spaghetti', 'fettuccine', 'ramen', 'udon', 'egg noodles', 'rice noodles'],
        timing: { cookMinutes: 10, prepMinutes: 5 },
        perServe: { noodles: 0.875 },
        phases: [
            { name: 'Boil pot', minutes: 5, instruction: 'Measure out {qty:noodles} of dry noodles, then bring a large pot of well-salted water to the boil. Use plenty of salt.' },
            { name: 'Cook noodles', minutes: 10, instruction: 'Cook the noodles for 10 min until just tender. Reserve a splash of pasta water, drain and toss in.' }
        ],
        defaultStepText: 'Bring a large pot of salted water to the boil and cook noodles for 10 min until just tender. Reserve a splash of pasta water, drain and toss in.'
    },
    {
        name: 'Bread/Wraps',
        order: 60,
        isSystem: true,
        aliases: ['naan', 'flatbread', 'tortillas', 'pita', 'roti', 'chapati'],
        timing: { cookMinutes: 5, prepMinutes: 2 },
        perServe: { bread: 1 },
        phases: [
            { name: 'Warm & wrap', minutes: 5, instruction: 'Warm enough bread/wraps for {serves} in a dry pan or wrapped in foil in the oven. Pile into a bread basket before serving.' }
        ],
        defaultStepText: 'Warm the bread/wraps in a dry pan or wrapped in foil in the oven during the last few minutes of cooking. Pile into a bread basket before serving.'
    }
]

// ---------- Timing resolution ----------

/** Normalised timing for a carb type + optional variant name. Returns
 *  { phases: [{name, minutes, instruction}], cookMinutes, prepMinutes,
 *    totalMinutes, perServe, label, variant }. Phases without minutes
 *  default to 0 (timer-less card). System types always get their seed phase
 *  sequence overlaid, so a stale pre-phase catalog doc in the DB can never
 *  produce blank/"Get it started" cards — the seed canonical shape wins for
 *  system entries while admin-created types keep their own data. */
export function resolveCarbTiming(carbType, variantName) {
    if (!carbType) return null
    const overlaid = overlaySeedForSystemType(carbType)
    const variants = overlaid.variants || []
    let variant = null
    if (variantName && variants.length > 0) {
        variant = variants.find(v => v.name === variantName) || null
    }
    if (!variant && variants.length > 0) variant = variants[0]
    const source = variant || {}
    let phases = (source.phases || overlaid.phases || []).map(p => normalizePhase(p))

    if (phases.length === 0) {
        const timing = overlaid.timing || {}
        const prepMinutes = source.prepMinutes ?? timing.prepMinutes ?? 0
        const cookMinutes = source.cookMinutes ?? timing.cookMinutes ?? 15
        if (prepMinutes > 0) phases.push({ name: 'Get it started', minutes: prepMinutes, instruction: '' })
        phases.push({ name: 'Cook', minutes: cookMinutes, instruction: '' })
    }
    phases = phases.map(p => normalizePhase(p))

    const totalMinutes = phases.reduce((a, p) => a + p.minutes, 0)
    const timed = phases.filter(p => p.minutes > 0)
    const cookMinutes = timed.length > 1 ? timed[timed.length - 1].minutes : (source.cookMinutes ?? overlaid.timing?.cookMinutes ?? totalMinutes)
    const prepMinutes = timed.length > 1 ? timed[0].minutes : 0
    return {
        phases,
        cookMinutes,
        prepMinutes,
        totalMinutes,
        perServe: variant?.perServe || overlaid.perServe || undefined,
        variant: variant ? variant.name : undefined,
        label: variants.length > 0 && variant ? `${overlaid.name} (${variant.name})` : overlaid.name
    }
}

/** Seed data is canonical for system carb types: if a stored (possibly
 *  legacy) catalog doc lacks the phase sequence or serve ratios that the
 *  seed defines, they are overlaid in-memory. Admin-created types are
 *  returned untouched. */
function overlaySeedForSystemType(carbType) {
    if (!carbType || carbType.isSystem !== true) return carbType
    const seed = SEED_CARB_TYPES.find(s => s.name === carbType.name)
    if (!seed) return carbType

    const merged = { ...carbType }
    if (!Array.isArray(merged.phases) || merged.phases.length === 0) merged.phases = seed.phases ? seed.phases.map(p => ({ ...p })) : undefined
    if (!merged.perServe && seed.perServe) merged.perServe = { ...seed.perServe }

    // Variant phases + per-serve ratios
    const seedVariants = seed.variants || []
    if (seedVariants.length > 0) {
        const existing = Array.isArray(merged.variants) ? merged.variants : []
        merged.variants = seedVariants.map(sv => {
            const existingVariant = merged.variants.find(v => v.name === sv.name) || {}
            return {
                ...existingVariant,
                name: sv.name,
                cookMinutes: existingVariant?.cookMinutes ?? sv.cookMinutes,
                prepMinutes: existingVariant?.prepMinutes ?? sv.prepMinutes,
                perServe: existingVariant?.perServe && Object.keys(existingVariant.perServe || {}).length > 0 ? existingVariant.perServe : { ...(sv.perServe || seed.perServe || {}) },
                phases: (existingVariant?.phases || []).length > 0 ? existingVariant.phases : sv.phases.map(p => ({ ...p }))
            }
        })
    }
    if (!merged.defaultStepText && seed.defaultStepText) merged.defaultStepText = seed.defaultStepText
    return merged
}

// ---------- Serve quantity templating ----------

// Fractions used by per-serve cup ratios (1/4 cup rice, 1/2 cup water…)
const FRACTIONS = { 0.125: '⅛', 0.25: '¼', 0.375: '⅜', 0.5: '½', 0.75: '¾', 0.6667: '⅔', 0.3333: '⅓' }

/** Formats a qty for a phase instruction: whole numbers as-is, common
 *  fractions become ¼/½/¾, else one decimal. */
export function formatQty(value) {
    const r = Math.round((Number(value) || 0) * 16) / 16
    const whole = Math.floor(r)
    const rest = r - whole
    const fracKey = Object.keys(FRACTIONS).find(k => Math.abs(rest - Number(k)) < 0.02)
    if (fracKey) {
        if (whole === 0) return FRACTIONS[fracKey]
        return `${whole}${FRACTIONS[fracKey]}`
    }
    return String(Number.isInteger(r) ? r : r.toFixed(1))
}

/** Unit word for a qty token, pluralized: 1 cup / 2 cups, 1 medium / 3 med. */
const QTY_UNITS = {
    rice: ['cup', 'cups'],
    water: ['cup', 'cups'],
    couscous: ['cup', 'cups'],
    quinoa: ['cup', 'cups'],
    noodles: ['cup', 'cups'],
    potato: ['medium', 'medium'],
    bread: ['piece', 'pieces']
}

/** Fills a phase/template instruction for a cook:
 *  {qty:<field>}  -> cups per serve x servings + unit (eg "½ cup")
 *  {serves}       -> serving count (default 2 when unknown)
 *  {cook}/{prep}/{minutes} — legacy template tokens. */
export function fillCarbPhaseText(text, timing, servings) {
    if (!text) return ''
    const per = timing?.perServe || {}
    const serves = Math.max(1, Math.round(Number(servings) || 2))
    return String(text)
        .replace(/\{qty:(\w+)\}/g, (_m, field) => {
            const perServe = per[field]
            if (typeof perServe !== 'number') return String(serves)
            const n = perServe * serves
            const unit = QTY_UNITS[field]
            if (!unit) return formatQty(n)
            // Sub-1 fractions keep the singular unit ("½ cup")
            const unitWord = n === 1 ? unit[0] : (n > 1 ? unit[1] : unit[0])
            return `${formatQty(n)} ${unitWord}`.trim()
        })
        .replace(/\{serves\}/g, String(serves))
        .replace(/\{cook\}/g, String(timing?.cookMinutes ?? 15))
        .replace(/\{prep\}/g, String(timing?.prepMinutes ?? 5))
        .replace(/\{minutes\}/g, String(timing?.totalMinutes ?? 20))
}

function normalizePhase(phase) {
    const name = String(phase?.name || '').trim() || 'Side step'
    return {
        name,
        minutes: Math.max(0, Math.round(Number(phase?.minutes) || 0)),
        instruction: String(phase?.instruction || '').trim()
    }
}

/** Validates a variant name against a carb type. */
export function resolveVariant(carbType, variantName) {
    if (!carbType || !carbType.variants || carbType.variants.length === 0) return undefined
    if (!variantName) return carbType.variants[0].name
    const found = carbType.variants.find(v => v.name.toLowerCase() === String(variantName).toLowerCase())
    return found ? found.name : carbType.variants[0].name
}

/** Finds a catalog carb type by name or alias. */
export function findCarbType(catalog, name) {
    if (!name) return null
    const wanted = String(name).trim().toLowerCase()
    let match = null
    for (const entry of catalog || []) {
        const entryName = String(entry.name || '').trim().toLowerCase()
        if (entryName === wanted) return entry
        for (const alias of enumerateAliases(entry)) {
            if (alias === wanted) return entry
            // Alias contained as whole phrase
            if (alias.length > 3 && (alias.includes(wanted) || wanted.includes(alias))) match = match || entry
        }
    }
    return match
}

function enumerateAliases(entry) {
    return (entry.aliases || []).map(a => String(a || '').trim().toLowerCase()).filter(Boolean)
}

/** Pure heuristic fallback for the already-in detection (used when the AI
 *  detection call fails). A step "cooks the carb" when it mentions the carb
 *  name/alias as a word AND contains a cooking verb for it. Merely
 *  referencing ("rice noodles", "bread crumbs") doesn't count. */
export function findCarbMentionInInstructions(carbType, instructions) {
    const need = (carbType) => [String(carbType.name).toLowerCase(), ...enumerateAliases(carbType)]
    const cookVerbs = ['boil', 'simmer', 'steam', 'roast', 'bake', 'fry', 'sauté', 'saute', 'cook', 'grill', 'warm', 'reheat', 'toast', 'blanch', 'freshly cooked', 'cooked']
    if (!carbType || !Array.isArray(instructions)) return -1
    const needles = need(carbType)
    for (let i = 0; i < instructions.length; i++) {
        const lower = String(instructions[i]?.Text || '').toLowerCase()
        if (!lower.trim()) continue
        const mentions = needles.some(n => n.length > 2 && lowerIncludesWord(lower, n))
        if (mentions && cookVerbs.some(v => lower.includes(v))) return i
    }
    return -1
}

function lowerIncludesWord(lower, needle) {
    if (!lower.includes(needle)) return false
    const idx = lower.indexOf(needle)
    const before = idx > 0 ? lower[idx - 1] : ' '
    const after = lower[idx + needle.length] || ' '
    return !/[a-z]/.test(before) && !/[a-z]/.test(after)
}

// ---------- Insert point math ----------

// If inserting BEFORE the landed step would start the phase fewer than this
// many minutes early, treat it as a boundary insert; otherwise the phase
// belongs DURING that step, `intoMinutes` minutes after it starts.
const DURING_THRESHOLD_MIN = 5

/** Core backward walk: where does a step that must START `minutesFromEnd`
 *  before the recipe's last step finishes belong?
 *  Returns `{ index, intoMinutes }` — `index` is the 0-based instruction the
 *  slot anchors to ("insert before it" convention) and `intoMinutes` is how
 *  far past that step's start the true slot lies. `intoMinutes: 0` means the
 *  slot lands exactly on the step boundary (plain "before" insert); a small
 *  overshoot (< DURING_THRESHOLD_MIN) is snapped back to the boundary too.
 *  Eg a 25-min slot in a recipe whose tail is [.., 90, 15] lands 80 minutes
 *  into the 90-min step. */
export function resolveCarbSlot(instructions, minutesFromEnd) {
    const steps = instructions || []
    const n = steps.length
    if (n === 0) return { index: 0, intoMinutes: 0 }
    const need = (typeof minutesFromEnd === 'number' && minutesFromEnd > 0) ? minutesFromEnd : 0
    if (need === 0) return { index: n - 1, intoMinutes: 0 } // rides the very last step
    // Explicit time: 0 marks a genuinely instant ("no minute") step and stays
    // 0; only MISSING times fall back to the average of the known ones.
    const times = steps.map(s => {
        if (!s || typeof s.time !== 'number' || s.time < 0) return null
        return s.time
    })
    const known = times.filter(t => typeof t === 'number' && t > 0)
    const fallback = known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : 10
    const resolved = times.map(t => (typeof t === 'number' ? t : fallback))

    let acc = 0
    let index = 0
    let intoMinutes = 0
    for (let i = n - 1; i >= 0; i--) {
        acc += resolved[i]
        if (acc >= need) {
            index = i
            intoMinutes = acc - need
            break
        }
        // Reached the start of the recipe and still below the slot time —
        // start at the beginning so it still finishes with the last step.
        if (i === 0) { index = 0; intoMinutes = 0 }
    }
    if (intoMinutes > 0 && intoMinutes < DURING_THRESHOLD_MIN) intoMinutes = 0
    return { index, intoMinutes }
}

/** Deterministic backward walk over instruction step times.
 *  Returns the 0-based instruction index the carb step should be inserted
 *  BEFORE, so the carb's total time (prep + cook) runs parallel to the tail
 *  of the recipe and finishes with the last step.
 *  Eg white rice (20 min total) in a recipe whose last two steps span 25 min
 *  => insert before the second-to-last step (starts 20 min before the end).
 *  `hintIndex` (0-based, from a previous AI analysis) is only accepted when
 *  it agrees within one step — actual timings always win. */
export function computeCarbInsertPoint(instructions, totalMinutes, hintIndex) {
    const steps = instructions || []
    const n = steps.length
    if (n === 0) return 0
    const total = (typeof totalMinutes === 'number' && totalMinutes > 0) ? totalMinutes : 20
    const slot = resolveCarbSlot(steps, total)

    if (typeof hintIndex === 'number' && hintIndex >= 0 && hintIndex <= n && Math.abs(hintIndex - slot.index) <= 1) {
        return hintIndex
    }
    return slot.index
}

/** Multi-phase insert points. `phases` are in cooking order (consecutive in
 *  time); phase i starts when sum(minutes of phases >= i) remain before the
 *  end. Eg white rice [boil 5, cook 15, fluff 0]: boil lands 20 min before
 *  the end, "add rice" 15 min before, fluff rides the last step.
 *  Returns a new phases array, each carrying `insertAfter` (0-based timing
 *  anchor) plus `during`/`intoMinutes` when the slot lands mid-step (the
 *  phase starts `intoMinutes` minutes after that step begins). */
export function computePhaseInsertPoints(instructions, phases) {
    const list = Array.isArray(phases) ? phases : []
    if (list.length === 0) return []
    return list.map((p, i) => {
        const own = list.slice(i).reduce((a, q) => a + q.minutes, 0)
        const slot = resolveCarbSlot(instructions, own)
        return {
            ...p,
            insertAfter: slot.index,
            during: slot.intoMinutes > 0,
            intoMinutes: slot.intoMinutes
        }
    })
}

// ---------- AI: already-in detection (the only AI use) ----------

/** Tiny detection-only prompt with TWO decisions:
 *  (a) "alreadyInInstructions": does the recipe already cook ANY known carb
 *      (from the catalog) as a serving side within its own steps?
 *      (=> we never inject)
 *  (b) "needsCarbSide": would this recipe go well with a carb side at all?
 *      (=> drives the auto-populated "Serve with a carb side" flag)
 *  Everything else (phases, timings, slotting) is deterministic catalog
 *  math — we deliberately ask the AI for nothing else. */
export function buildCarbDetectMessages(recipeName, carbCatalog, instructions) {
    const list = (carbCatalog || [])
        .filter(c => c && c.active !== false)
        .map(c => `- ${c.name}${(c.aliases || []).length ? ` (aliases: ${c.aliases.join(', ')})` : ''}`)
        .join('\n')
    const instructionList = (instructions || [])
        .map((i, idx) => `${idx + 1}. ${i.Text}${i.time ? ` (${i.time} min)` : ''}`)
        .join('\n')

    return [
        {
            role: "system",
            content: `You are a recipe analyst. Answer TWO questions about whether a recipe involves serving a carb side:

(a) "alreadyInInstructions": does the recipe ALREADY include a step that cooks/prepares a carb side for serving? If yes, also name which one ("carbType" from the catalog below) and the step.
(b) "needsCarbSide": would this recipe go well with a carb side at all? Signals: soups, stews, curries, stir-fries, braises and saucy dishes usually suit rice/bread/noodles; dishes that already ARE a carb dish (pasta bake, fried rice, risotto, burger, sandwich, pizza), desserts and most salads/breakfasts usually do NOT.

KNOWN CARB TYPES:
${list}

RULES:
- Cooking the carb within the recipe counts for (a): boiling, simmering, roasting, steaming, frying, warming bread, using a rice cooker, etc. Merely referencing a carb does NOT count.
- A carb served as an integral part of the main dish (pasta in a pasta bake) is NOT a side; a carb cooked separately for serving IS.
- (b) is true when the dish is commonly served alongside a carb, even a different one than already in the steps — answer "needsCarbSide": true but "alreadyInInstructions": false in that case.

OUTPUT: a single JSON object, nothing else:
{"needsCarbSide": true|false, "alreadyInInstructions": true|false, "carbType": "<name from the catalog, or null>", "matchedStepIndex": <1-indexed step or null>, "reason": "<one short sentence explaining both decisions>"}`
        },
        {
            role: "user",
            content: `Recipe: "${recipeName}"
Instructions:
${instructionList}`
        }
    ]
}

/** Validates + normalises the AI detection result. */
export function parseCarbDetectResult(data, carbCatalog) {
    if (!data || typeof data !== 'object') return { ok: false, error: 'no data' }
    let detectedType
    if (Array.isArray(carbCatalog) && typeof data.carbType === 'string' && data.carbType.trim()) {
        const match = findCarbType(carbCatalog, data.carbType)
        detectedType = match?.name
    }
    return {
        ok: true,
        needsCarbSide: data.needsCarbSide !== false && data.needsCarbSide !== 'false',
        alreadyInInstructions: data.alreadyInInstructions === true,
        carbType: detectedType,
        matchedStepIndex: typeof data.matchedStepIndex === 'number' && data.matchedStepIndex >= 1
            ? data.matchedStepIndex - 1
            : undefined,
        reason: typeof data.reason === 'string' ? data.reason.trim() : ''
    }
}

// ---------- UX: recommendation ----------

/** Picks the default carb option for the Start Cooking modal from the user's
 *  recently used carb choices (most recent first). Entries look like
 *  { type: 'Rice', variant: 'Brown', at: 123456 }.
 *  Prefers: the recipe's own configured type, then the newest history entry.
 *  Entries are matched against the active catalog so stale/deleted entries
 *  are skipped. Returns a catalog entry or null when nothing to recommend. */
export function recommendCarbOption(catalog, history, recipeType) {
    const byName = (t) => findCarbType(catalog, t)
    if (recipeType && byName(recipeType)) return byName(recipeType)
    for (const entry of (history || [])) {
        if (!entry || !entry.type) continue
        const match = byName(entry.type)
        if (match) return match
    }
    return (catalog || [])[0] || null
}

// ---------- Flow layout ----------

/**
 * @typedef {{ kind: 'prep' | 'step' | 'carb', stepIndex: number, flowIndex: number, phaseIndex?: number }} FlowItem
 */

/** The cooking flow: an optional prep run-through first (only when the recipe
 *  has prep work), then the instruction steps. Timers attach to their step as
 *  a poke-out tab underneath the card instead of being flow items.
 *  Carb side: each phase of the chosen side (boil water, cook, fluff…) is
 *  injected at the instruction step where its timer should start, so every
 *  phase lines up to finish with the recipe's last step. Boundary slots sit
 *  just before their step; slots that land mid-step ("during" phases) sit
 *  just after it, since they only begin partway through that step.
 *  Zero-minute phases (the timer-less "ready to serve" card — fluff) anchor
 *  to the end of the recipe, so they render after their step too.
 *  @param {any[]} instructions
 *  @param {any[]} prepWork
 *  @param {any} carbChoice
 *  @returns {FlowItem[]} */
export function buildFlowItems(instructions, prepWork, carbChoice) {
    /** @type {FlowItem[]} */
    const items = []
    if ((prepWork || []).length > 0) {
        items.push({ kind: 'prep', stepIndex: -1, flowIndex: items.length })
    }
    const carbPhases = Array.isArray(carbChoice?.phases)
        ? carbChoice.phases
        : (carbChoice && typeof carbChoice.insertAfter === 'number'
            ? [{ insertAfter: carbChoice.insertAfter }] : [])
    ;(instructions || []).forEach((_, i) => {
        carbPhases.forEach((p, pi) => {
            if (typeof p?.insertAfter === 'number' && p.insertAfter === i && !p.during && p.minutes !== 0) {
                items.push({ kind: 'carb', stepIndex: i, phaseIndex: pi, flowIndex: items.length })
            }
        })
        items.push({ kind: 'step', stepIndex: i, flowIndex: items.length })
        carbPhases.forEach((p, pi) => {
            const boundaryZero = p.minutes === 0
            if (typeof p?.insertAfter === 'number' && p.insertAfter === i && (p.during || boundaryZero)) {
                items.push({ kind: 'carb', stepIndex: i, phaseIndex: pi, flowIndex: items.length })
            }
        })
    })
    return items
}

