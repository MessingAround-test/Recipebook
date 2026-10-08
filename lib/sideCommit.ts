// Side-commit core shared by the recipe page (fresh picks + add-to-runner)
// and tests. Pure functions — no React, no db. Consumes lib/sideSchedule.
import {
    buildMainTimeline,
    buildAttentionGaps,
    scheduleSide,
    staggerSidePlans,
    STAGGER_MIN
} from './sideSchedule'

// ---------- Scheduling context (main dish, partial-aware) ----------

/** Minutes still on a running/pending main timer for a step (null when
 *  nothing gives us a better anchor than the step's full length). */
export function remainingMinutesForStep(
    stepIndex: number,
    docLike: any,
    session: any,
    now: number = Date.now()
): number | null {
    const timers = (docLike.cookingTimers || []).filter((t: any) => t.type === 'timer'
        && (typeof t.stepIndex === 'number' ? t.stepIndex : 0) === stepIndex)
    let best: number | null = null
    for (const t of timers) {
        const st = session?.timers?.[t.id]
        if (!st) continue
        if (st.status === 'active' && st.endTime) {
            const rem = Math.max(0, (st.endTime - now) / 60000)
            best = best === null ? Math.min(rem, t.duration) : Math.min(best, Math.min(rem, t.duration))
        } else if (st.status === 'paused') {
            best = best === null ? st.remaining / 60 : Math.max(best, Math.min(st.remaining / 60, t.duration))
        }
    }
    return best
}

/** Builds the scheduling context for a main recipe from an arbitrary
 *  position. `curStepIndex: null` = fresh cook (full timeline); otherwise
 *  the timeline starts mid-step using whatever main timer is still running
 *  on that step, so all slots are forward-searched from that point. Anchors
 *  stay in this partial coordinate system; the caller re-offsets them by
 *  `partialStart` to real step indices. */
export function buildSideContext(docLike: any, curStepIndex: number | null, session: any | null) {
    const instructions = docLike.instructions || []
    const recipeTimers = (docLike.cookingTimers || []).filter((t: any) => t.type === 'timer')
    const longestTimerAt = (i: number) => recipeTimers
        .filter((t: any) => typeof t.duration === 'number' && t.duration > 0
            && (typeof t.stepIndex === 'number' ? t.stepIndex : 0) === i)
        .reduce((m: number, t: any) => Math.max(m, t.duration), 0)
    const known: number[] = instructions
        .map((s: any) => (typeof s?.time === 'number' && s.time > 0 ? s.time : null))
        .filter((t): t is number => t !== null)
    const fallbackMin = known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : 10

    const partialStart = curStepIndex === null ? 0 : Math.max(0, curStepIndex)
    const partialSteps: any[] = []
    for (let i = partialStart; i < instructions.length; i++) {
        const s = instructions[i] || {}
        let t = (typeof s.time === 'number' && s.time >= 0) ? s.time : (longestTimerAt(i) || fallbackMin)
        // The current step is part-way done: its tail is whatever remains
        // on a still-running timer (floored at an instant step).
        if (curStepIndex !== null && i === partialStart && session) {
            const rem = remainingMinutesForStep(i, docLike, session)
            if (rem !== null) t = Math.min(Math.max(0.001, rem), t > 0 ? Math.max(t, rem) : rem)
        }
        partialSteps.push({ time: t, involvement: s.involvement, baseIndex: i })
    }
    const timeline = buildMainTimeline(partialSteps)
    // Attention gaps, forward-only: walk-away timers from the current step
    // onward, with the in-flight one trimmed to its remainder.
    const attention: any[] = recipeTimers
        .filter((t: any) => typeof t.stepIndex === 'number' && t.stepIndex >= partialStart)
        .map((t: any) => {
            let duration = t.duration
            if (curStepIndex !== null && t.stepIndex === partialStart && session) {
                const rem = remainingMinutesForStep(t.stepIndex, docLike, session)
                if (rem !== null) duration = Math.max(0.001, Math.min(rem, t.duration))
            }
            return { duration, involvement: t.involvement, stepIndex: t.stepIndex - partialStart }
        })
    const gaps = buildAttentionGaps(partialSteps, timeline, attention)
    return { partialSteps, timeline, gaps, partialStart, attention }
}

// ---------- Side recipe normalisation ----------

/** Flattens a suggestion-shaped recipe ({steps, prepWork, timers}) into the
 *  UnitInput list the scheduler consumes. Timer fallback for missing step
 *  times mirrors the main recipe's schedulingInstructions treatment. */
export function unitListForPseudo(pseudo: any) {
    const longestTimerAt = (si: number) => (pseudo.timers || [])
        .filter((t: any) => t.stepIndex === si && typeof t.duration === 'number' && t.duration > 0)
        .reduce((m: number, t: any) => Math.max(m, t.duration), 0)
    const known: number[] = (pseudo.steps || [])
        .map((s: any) => (typeof s?.time === 'number' && s.time > 0 ? s.time : null))
        .filter((t: any): t is number => t !== null)
    const fallbackMin = known.length > 0 ? known.reduce((a: number, b: number) => a + b, 0) / known.length : 10
    const units: any[] = (pseudo.prepWork || [])
        .filter((p: any) => !p.optional)
        .map((p: any, i: number) => ({
            kind: 'prep', index: i, minutes: Math.max(0, typeof p.timeEstimate === 'number' ? p.timeEstimate : 0)
        }))
        ;(pseudo.steps || []).forEach((s: any, i: number) => {
            let mins: number
            if (typeof s?.time === 'number' && s.time >= 0) mins = s.time
            else mins = longestTimerAt(i) || fallbackMin
            units.push({ kind: 'step', index: i, minutes: Math.max(0, mins) })
        })
    return units
}

export function serveTempForPseudo(pseudo: any) {
    return (['cold', 'reheatable', 'hot'].includes(pseudo?.serveTemp) ? pseudo.serveTemp : 'hot')
}

/** Side servings: scales with the cook's current servings setting by
 *  default (factor 1); the sheet's dropdown factor may override per pick. */
export function computeSideServings(
    pseudo: any,
    opts?: { factor?: number; mainServes?: number; fallbackServes?: number }
): number {
    const mainServes = opts?.mainServes && opts.mainServes > 0 ? opts.mainServes : 0
    const factor = Math.max(0.25, Math.min(4, Number(opts?.factor) || 1))
    const base = mainServes > 0 ? mainServes : (opts?.fallbackServes ?? pseudo?.servings ?? 0)
    return Math.max(0, Math.round(base * factor))
}

export const pseudoStepTexts = (p: any) => (p.steps || []).map((s: any) => ({
    index: s.index, text: s.Text, minutes: s.time ?? null
}))

export const unitTextFor = (p: any, u: any): string => {
    if (u.kind === 'reheat') return p.serveTemp === 'reheatable'
        ? `Reheat the ${p.name} (${u.minutes} min), serve hot.`
        : `Warm the ${p.name} and serve.`
    if (u.kind === 'prep') {
        const item = (p.prepWork || [])[u.index]
        return item ? `${item.action}` : 'Side prep'
    }
    const step = (p.steps || [])[u.index]
    return step?.Text || `Side step ${u.index + 1}`
}

/** Shorthand for "what comes next on this lane": proper wording for
 *  prep/reheat units instead of a nonsense "step N". */
export const sideUnitLabel = (u: any): string => {
    if (!u) return 'next'
    if (u.kind === 'reheat') return 'reheat & serve'
    if (u.kind === 'prep') return 'prep'
    return `step ${(u.index || 0) + 1}`
}

// ---------- Collision seeding ----------

/** Seeds the claimed-anchor map with `during` timers already out there:
 *  carb choice phases and (for a running cook) session side units. Keys
 *  are written in REAL step indices. */
export function claimExistingAnchors(
    carbChoiceLike: any,
    sessionSidePicks: any[] | undefined
): Map<string, boolean> {
    const claimed = new Map<string, boolean>()
    const claim = (anchorStep: any, into: any) => {
        if (typeof anchorStep !== 'number') return
        claimed.set(`${anchorStep}:${Number(into) || 0}`, true)
    }
    for (const p of ((carbChoiceLike?.phases || []) as any[]).filter((x: any) => x.during && x.timerId)) {
        claim(p.insertAfter, p.intoMinutes)
    }
    for (const sp of sessionSidePicks || []) {
        for (const u of sp.units || []) {
            if (u.during && u.timerId) claim(u.anchorStep, u.intoMinutes)
        }
    }
    return claimed
}

// ---------- Commit ----------

/** Commit: schedule one or more picks against a main context, create the
 *  session timers and return pick entries ready for flow insertion and
 *  session persistence. Sides are session-scoped like carb choices —
 *  nothing is written back to the recipe. `claimedKeys` seeds collision
 *  staggering with anchors already taken by a running cook's other
 *  (carb phase / existing side) timers; `mid` marks an add-to-runner commit
 *  (units anchored to the current step go live at commit time). Returns
 *  pick entries with REAL step indices via `partialStart`. */
export function buildSidePickEntries(
    picksToSchedule: any[],
    context: { partialSteps: any[]; timeline: any; gaps: any; partialStart: number; attention: any[] },
    opts?: { mid?: boolean; claimedKeys?: Map<string, boolean>; servesFor?: (p: any) => number }
): { picks: any[]; newTimers: any[] } {
    const { timeline, gaps, partialStart, partialSteps, attention } = context
    const servesFor = opts?.servesFor || (() => 0)
    const sideInputs = picksToSchedule.map(p => ({
        recipeId: String(p._id),
        name: p.name,
        serveTemp: serveTempForPseudo(p),
        reheatMinutes: p.serveTemp === 'reheatable' ? (p.reheatMinutes > 0 ? p.reheatMinutes : 5) : 0,
        units: unitListForPseudo(p)
    }))
    const plans = sideInputs.map(s => scheduleSide(timeline, gaps, partialSteps, s, attention))
    staggerSidePlans(plans, opts?.claimedKeys)
    // Mid-add overflow: a side LONGER than what remains of the cook cannot
    // be backward-slotted — the math clamps to the head of the partial
    // window, which would scatter side cards in front of the step the cook
    // is currently on. That's the run-killer: clamp every unit of such a
    // side to "start now, right after the current step", alarms walking in
    // a few minutes apart so the queue is startable one by one.
    if (opts?.mid === true) {
        for (const s of sideInputs) {
            const chainTotal = s.units.reduce((a, u) => a + (u.minutes || 0), 0)
                + (s.reheatMinutes || 0)
            const plan = plans.find((p: any) => p.recipeId === s.recipeId)
            if (!plan || chainTotal <= timeline.total) continue
            plan.mode = 'horizon'
            plan.note = chainTotal > 0
                ? `Too long to slot ahead of this cook — starts now and shows alongside the remaining steps.`
                : plan.note
            plan.hold = null
            plan.units.forEach((u: any, ui: number) => {
                u.anchorStep = 0
                u.during = true
                u.intoMinutes = Math.max(1, ui * STAGGER_MIN)
                u.anchorTimerIndex = null
                // Marks "minutes from NOW" for the live-at-commit timer rule
                u.__clampedNow = true
            })
        }
    }
    const stamp = Date.now().toString(36)
    const newTimers: any[] = []
    const picks = picksToSchedule.map((p, ri) => {
        const plan = plans[ri]
        const serves = servesFor(p)
        const units = plan.units.map((u, ui) => {
            const text = unitTextFor(p, u)
            const tid = u.minutes > 0 ? `side-${stamp}-r${ri}-u${ui}` : undefined
            if (tid) {
                newTimers.push({
                    id: tid,
                    name: `${p.name}: ${u.kind === 'reheat' ? 'Reheat & serve' : u.kind === 'prep' ? 'Prep' : `Step ${u.index + 1}`}`,
                    duration: Math.max(1, Math.round(u.minutes)),
                    side: true,
                    sideRecipeId: String(p._id),
                    stepIndex: partialStart + u.anchorStep,
                    during: !!u.during,
                    intoMinutes: u.intoMinutes || 0,
                    // Mid-cook additions anchored to the CURRENT step fire
                    // right now: their "into" window started when the step's
                    // timer did, so the timer goes live at commit.
                    liveAtCommit: opts?.mid === true && !!u.during && u.intoMinutes > 0 && u.anchorStep === 0
                })
            }
            return {
                ...u,
                anchorStep: partialStart + u.anchorStep,
                text,
                timerId: tid,
                serves
            }
        })
        return {
            recipeId: String(p._id),
            name: p.name,
            sideCategory: p.sideCategory || 'other',
            serveTemp: plan.serveTemp,
            serveTempSource: p.serveTempSource || undefined,
            mode: plan.mode,
            note: plan.note,
            hold: plan.hold,
            servings: serves,
            totalMinutes: plan.units.reduce((a, u) => a + u.minutes, 0),
            steps: pseudoStepTexts(p),
            ingredients: (p.ingredients || []).map((i: any) => ({ name: i.name, quantity: i.quantity, quantity_type: i.quantity_type })),
            prepWork: (p.prepWork || []).map((w: any) => ({ action: w.action, timeEstimate: w.timeEstimate })),
            units
        }
    })
    return { picks, newTimers }
}

// ---------- Runner flow reconstruction ----------

/** Rebuilds a running cook's flow list from its recipe doc + session
 *  (mirrors buildFlowItems' carb/side insertion rules in carbSideOps) so a
 *  remote page can map `currentFlow` to the step the cook actually sits on. */
export function buildRunnerFlowItems(doc: any, sidePicksLike: any[] | undefined, carbChoiceLike: any) {
    const items: any[] = []
    if ((doc.prepWork || []).length > 0) items.push({ kind: 'prep', stepIndex: -1 })
    const instructions = doc.instructions || []
    const sideUnits = (sidePicksLike || []).flatMap((sp: any, si: number) =>
        (sp.units || []).map((u: any, ui: number) => ({ sideIndex: si, unitIndex: ui, anchorStep: u.anchorStep, during: u.during, minutes: u.minutes })))
    const carbPhases = ((carbChoiceLike?.phases || []) as any[])
        ;(instructions as any[]).forEach((_, i) => {
            carbPhases.forEach((p, pi) => {
                if (typeof p?.insertAfter === 'number' && p.insertAfter === i && !p.during && p.minutes !== 0) {
                    items.push({ kind: 'carb', stepIndex: i, phaseIndex: pi })
                }
            })
            sideUnits.forEach(u => {
                if (u.anchorStep === i && !u.during && u.minutes > 0) items.push({ kind: 'side', stepIndex: i, sideIndex: u.sideIndex, unitIndex: u.unitIndex })
            })
            items.push({ kind: 'step', stepIndex: i })
            carbPhases.forEach((p, pi) => {
                const boundaryZero = p.minutes === 0
                if (typeof p?.insertAfter === 'number' && p.insertAfter === i && (p.during || boundaryZero)) {
                    items.push({ kind: 'carb', stepIndex: i, phaseIndex: pi })
                }
            })
            sideUnits.forEach(u => {
                if (u.anchorStep === i && (u.during || u.minutes === 0)) items.push({ kind: 'side', stepIndex: i, sideIndex: u.sideIndex, unitIndex: u.unitIndex })
            })
        })
    return items
}
