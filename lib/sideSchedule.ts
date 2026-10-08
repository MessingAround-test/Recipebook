// Side-dish scheduling engine. Pure math, no DOM/React/db: given the main
// recipe's step timeline (times + involvement) and one or more side recipes,
// decides where each side unit belongs in the cooking flow and how its
// timer should fire. The page turns units into session timers/cards.
//
// Model:
//  - The main's serve horizon = the end of its last step. Ending there is
//    the "hot" behaviour (also the fallback).
//  - Attention gaps = spans of the main's timeline where the cook is free
//    (steps/involvement 'none', or walk-away timers carving a window).
//    Cold/reheatable sides prefer those gaps: cold = EARLIEST gap that fits
//    the whole chain (make it early, done, hold it), reheatable = cook
//    units into the earliest fitting gap, plus a short reheat unit that
//    lands at the serve horizon.
//  - Everything else mirrors lib/carbSideOps: backward slotting, a 5-minute
//    boundary snap threshold, "during" anchors that fire `intoMinutes`
//    after the anchor step's main timer starts, zero-minute units riding
//    the last step.

export const DURING_THRESHOLD_MIN = 5
export const STAGGER_MIN = 3

export type ServeTemp = 'cold' | 'reheatable' | 'hot'
export type Involvement = 'none' | 'low' | 'active'

export interface MainStepTiming {
    time?: number | null
    involvement?: string | null
}

/** Cooking-timer record used only for gap carving: a walk-away timer
 *  frees the start of its step even when the step itself demands attention. */
export interface AttentionTimer {
    duration: number
    involvement?: string
    stepIndex?: number | null
}

export interface SideUnitInput {
    /** 'prep' = side's own prep-work card, 'step' = instruction step,
     *  'reheat' = synthetic warm-back unit the scheduler anchors itself. */
    kind: 'prep' | 'step' | 'reheat'
    index: number
    minutes: number
}

export interface SideInput {
    recipeId: string
    name: string
    serveTemp: ServeTemp
    reheatMinutes?: number
    units: SideUnitInput[]
}

export interface SideUnitPlan {
    kind: 'prep' | 'step' | 'reheat'
    index: number
    minutes: number
    /** 0-based instruction of the main this unit anchors to. */
    anchorStep: number
    during: boolean
    /** Minutes past the anchor step's (timer) start; 0 on a boundary insert. */
    intoMinutes: number
    /** True when the anchor step has a walk-away timer covering the unit's
     *  need — the timer auto-fires it. False (or below) = manual card. */
    anchorTimerIndex: number | null
}

export interface SidePlan {
    recipeId: string
    name: string
    serveTemp: ServeTemp
    mode: 'horizon' | 'gap'
    units: SideUnitPlan[]
    /** Idle minutes between the side chain's end and the main's serve
     *  horizon (cold/reheatable only). Drives the hold card. */
    hold: { minutes: number } | null
    /** Human note when a tradeoff was made (no gap fitted, etc.). */
    note?: string
}

/** Resolves step minutes: explicit 0 stays 0 (instant step); a MISSING time
 *  falls back to the average of the known ones (10 when there are none). */
export function resolveStepTimes(steps: Array<MainStepTiming | null | undefined>): number[] {
    const list = steps || []
    const times = list.map(s => (s && typeof s.time === 'number' && s.time >= 0 ? s.time : null))
    const known = times.filter((t): t is number => t !== null && t > 0)
    const fallback = known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : 10
    return times.map(t => (t === null ? fallback : t))
}

export interface MainTimeline {
    resolved: number[]
    /** Cumulative start minute of each step (starts[0] = 0). */
    starts: number[]
    total: number
}

export function buildMainTimeline(steps: Array<MainStepTiming | null | undefined>): MainTimeline {
    const resolved = resolveStepTimes(steps)
    const starts: number[] = []
    let acc = 0
    for (const t of resolved) {
        starts.push(acc)
        acc += t
    }
    return { resolved, starts, total: acc }
}

/** Attention gaps: maximal free runs [startMin, endMin) inside the main's
 *  cook window, at minute resolution. A minute is free when the step it
 *  belongs to is involvement 'none', or a walk-away timer sits on it. */
export function buildAttentionGaps(
    steps: Array<MainStepTiming | null | undefined>,
    timeline: MainTimeline,
    timers?: AttentionTimer[]
): Array<{ startMin: number; endMin: number; stepIndex: number; endStepIndex: number }> {
    const { resolved, starts, total } = timeline
    if (total <= 0) return []
    const free = new Array<boolean>(Math.ceil(total)).fill(false)
    const locateStep = (m: number): number => {
        let idx = 0
        for (let i = 0; i < starts.length; i++) if (starts[i] <= m) idx = i
        return idx
    }
    for (let m = 0; m < free.length; m++) {
        const i = locateStep(m)
        const inv = String(steps?.[i]?.involvement || '').toLowerCase()
        free[m] = inv === 'none'
    }
    // Walk-away timers carve their first `duration` minutes as free even
    // when the step is nominally hands-on (assumed to run from step start).
    for (const t of timers || []) {
        if (!t || String(t.involvement || '').toLowerCase() !== 'none') continue
        if (typeof t.duration !== 'number' || t.duration <= 0) continue
        const si = typeof t.stepIndex === 'number' ? Math.min(Math.max(0, t.stepIndex), resolved.length - 1) : 0
        const window = Math.min(t.duration, resolved[si])
        for (let m = starts[si]; m < starts[si] + window && m < free.length; m++) free[m] = true
    }
    const gaps: Array<{ startMin: number; endMin: number; stepIndex: number; endStepIndex: number }> = []
    let runStart = -1
    for (let m = 0; m <= free.length; m++) {
        const isFree = m < free.length && free[m]
        if (isFree && runStart < 0) runStart = m
        if (!isFree && runStart >= 0) {
            gaps.push({ startMin: runStart, endMin: m, stepIndex: locateStep(runStart), endStepIndex: locateStep(Math.min(m, total) - 1) })
            runStart = -1
        }
    }
    return gaps
}

/** Where does a unit that must START at `minute` belong? Largest step whose
 *  start minute <= the moment (minute is clamped to the cook window). */
export function locateMinute(timeline: MainTimeline, minute: number): { index: number; intoMinutes: number } {
    const { starts, total } = timeline
    if (starts.length === 0) return { index: 0, intoMinutes: 0 }
    const m = Math.max(0, Math.min(minute, total))
    let index = 0
    for (let i = 0; i < starts.length; i++) {
        if (starts[i] <= m) index = i
    }
    return { index, intoMinutes: Math.max(0, m - starts[index]) }
}

/** Whether the anchor step has ANY cooking timer on it - during-fires are
 *  keyed off a step's timer starting, so a step with no timer can never
 *  fire a "during" unit and the unit downgrades to a manual boundary card. */
function hasAnyTimerForStep(timers: AttentionTimer[] | undefined, stepIndex: number): boolean {
    if (!timers) return false
    return timers.some(t =>
        !!t && typeof t.duration === "number" && t.duration > 0
        && t.stepIndex === stepIndex)
}
/** Walk-away timer of the step, if any — the anchor that lets a gap unit be
 *  scheduled automatically ("fires when the main timer starts"). */
function findWaitTimerIndex(timers: AttentionTimer[] | undefined, stepIndex: number): number | null {
    if (!timers) return null
    for (let i = 0; i < timers.length; i++) {
        const t = timers[i]
        if (String(t?.involvement || '').toLowerCase() !== 'none') continue
        if (t.stepIndex === stepIndex) return i
    }
    return null
}

// ---------- Slot computation for a single side ----------

/**
 * Schedules one side recipe against the main timeline.
 *  - hot: every unit finishes at the serve horizon (classic backward walk,
 *    same semantics as computePhaseInsertPoints in carbSideOps).
 *  - cold: whole chain (plus zero-minute steps) into the EARLIEST attention
 *    gap that fits, ending at the gap's end; covered by a hold card after.
 *  - reheatable: cooking units into the earliest fitting gap + a synthetic
 *    reheat unit (reheatMinutes) at the serve horizon.
 * Nothing ever throws: when no gap fits, the plan degrades to the hot path
 * with an explanatory note.
 */
export function scheduleSide(
    timeline: MainTimeline,
    gaps: ReturnType<typeof buildAttentionGaps>,
    steps: Array<MainStepTiming | null | undefined>,
    side: SideInput,
    timers?: AttentionTimer[]
): SidePlan {
    const serveTemp = side.serveTemp || 'hot'
    const allUnits: SideUnitInput[] = (side.units || []).filter(u => u && typeof u.minutes === 'number' && u.minutes >= 0)
    const cookUnits = allUnits.filter(u => u.minutes > 0)
    const zeroUnits = allUnits.filter(u => u.minutes === 0)
    const reheatMin = serveTemp === 'reheatable' ? Math.max(0, Math.round(side.reheatMinutes || 5)) : 0

        const hot = () => {
        // Raw backward starts (unit j starts total - sum(dur[j..])), then
        // forward-pack the overflowed head: the LAST unit still finishes
        // with the horizon, earlier units slot forward from the cook's
        // start and are marked "during" so reaching the first step (or its
        // timer) triggers them - they never pile up in front of step 1.
        const chain = [...cookUnits.map(u => u.minutes), ...(serveTemp === 'reheatable' && reheatMin > 0 ? [reheatMin] : [])]
        const raw: number[] = []
        for (let j = 0; j < chain.length; j++) {
            raw.push(timeline.total - chain.slice(j).reduce((a, b) => a + b, 0))
        }
        const packed: Array<{ s: number; clamped: boolean }> = []
        for (let j = 0; j < chain.length; j++) {
            let s = raw[j]
            const clamped = s < 0
            if (clamped) s = 0
            if (j > 0) s = Math.max(s, packed[j - 1].s + chain[j - 1])
            packed.push({ s, clamped })
        }
        const units: SideUnitPlan[] = []
        const slotUnit = (u: SideUnitInput, j: number, kind: 'step' | 'prep' | 'reheat'): SideUnitPlan => {
            const loc = locateMinute(timeline, packed[j].s)
            const into = Math.max(0, loc.intoMinutes)
            return {
                kind,
                index: u.index,
                minutes: u.minutes,
                anchorStep: loc.index,
                // Clamped units fire as soon as their anchor step is reached;
                // natural mid-step slots need a timer on that step.
                during: (packed[j].clamped || into > 0) && (packed[j].clamped || hasAnyTimerForStep(timers, loc.index)),
                intoMinutes: into,
                anchorTimerIndex: into > 0 ? findWaitTimerIndex(timers, loc.index) : null
            }
        }
        for (let j = 0; j < cookUnits.length; j++) {
            units.push(slotUnit(cookUnits[j], j, cookUnits[j].kind))
        }
        // Zero-minute units (assemble/serve) ride the last step, after it.
        const lastIdx = Math.max(0, timeline.resolved.length - 1)
        for (const u of zeroUnits) {
            units.push({ kind: u.kind, index: u.index, minutes: 0, anchorStep: lastIdx, during: false, intoMinutes: 0, anchorTimerIndex: null })
        }
        if (serveTemp === 'reheatable' && reheatMin > 0) {
            units.push(slotUnit({ kind: 'reheat', index: -1, minutes: reheatMin }, cookUnits.length, 'reheat'))
        }
        return { units, hold: null as null | { minutes: number }, gapEnd: -1, note: undefined as string | undefined }
    }

    const gap = () => {
        const chainTotal = cookUnits.reduce((a, u) => a + u.minutes, 0)
        const fit = (gaps || []).find(g => (g.endMin - g.startMin) >= chainTotal && g.endMin <= timeline.total)
        if (!fit) return null
        const units: SideUnitPlan[] = []
        let cursor = fit.endMin - chainTotal
        for (const u of cookUnits) {
            const loc = locateMinute(timeline, cursor)
            const timerIdx = findWaitTimerIndex(timers, loc.index)
            units.push({
                kind: u.kind,
                index: u.index,
                minutes: u.minutes,
                anchorStep: loc.index,
                during: loc.intoMinutes > 0 && hasAnyTimerForStep(timers, loc.index),
                intoMinutes: loc.intoMinutes,
                anchorTimerIndex: timerIdx
            })
            cursor += u.minutes
        }
        for (const u of zeroUnits) {
            if (u.minutes === 0) {
                const loc = locateMinute(timeline, Math.max(0, Math.min(cursor, timeline.total - 0.001)))
                units.push({ kind: u.kind, index: u.index, minutes: 0, anchorStep: loc.index, during: false, intoMinutes: Math.max(0, loc.intoMinutes), anchorTimerIndex: null })
            }
        }
        const gapLen = Math.round(fit.endMin - fit.startMin)
        const holdMin = serveTemp === 'reheatable'
            ? Math.max(0, Math.round(timeline.total - reheatMin - fit.endMin))
            : Math.max(0, Math.round(timeline.total - fit.endMin))
        return {
            units,
            hold: holdMin > 0 ? { minutes: holdMin } : null,
            gapEnd: fit.endMin,
            note: chainTotal > 0
                ? `Done early — fit a ${gapLen} min break, ends ${Math.round(chainTotal)} min before it closes${holdMin > 0 ? `, hold ~${holdMin} min for the main` : ''}.`
                : undefined
        }
    }

    if (serveTemp !== 'hot') {
        const g = gap()
        if (g) {
            if (serveTemp === 'reheatable' && reheatMin > 0) {
                const slot = resolveCarbStyleSlot(timeline, reheatMin)
                g.units.push({
                    kind: 'reheat', index: -1, minutes: reheatMin,
                    anchorStep: slot.index,
                    during: slot.during,
                    intoMinutes: slot.intoMinutes,
                    anchorTimerIndex: slot.during ? findWaitTimerIndex(timers, slot.index) : null
                })
            }
            return {
                recipeId: side.recipeId,
                name: side.name,
                serveTemp,
                mode: 'gap',
                units: g.units,
                hold: g.hold,
                note: g.note
            }
        }
        const h = hot()
        return {
            recipeId: side.recipeId,
            name: side.name,
            serveTemp,
            mode: 'horizon',
            units: h.units,
            hold: null,
            note: cookUnits.length > 0 && cookUnits.reduce((a, u) => a + u.minutes, 0) > 0
                ? `No break long enough for ${Math.round(cookUnits.reduce((a, u) => a + u.minutes, 0))} min of ${side.name || 'side'} work — slotted at the end instead.`
                : undefined
        }
    }

    const h = hot()
    return {
        recipeId: side.recipeId,
        name: side.name,
        serveTemp,
        mode: 'horizon',
        units: h.units,
        hold: null,
        note: h.note
    }
}

function resolveCarbStyleSlot(timeline: MainTimeline, minutesFromEnd: number): { index: number; intoMinutes: number; during: boolean } {
    const { resolved } = timeline
    const n = resolved.length
    if (n === 0) return { index: 0, intoMinutes: 0, during: false }
    const need = minutesFromEnd > 0 ? minutesFromEnd : 0
    if (need === 0) return { index: n - 1, intoMinutes: 0, during: false }
    let acc = 0
    let index = 0
    let into = 0
    for (let i = n - 1; i >= 0; i--) {
        acc += resolved[i]
        if (acc >= need) {
            index = i
            into = acc - need
            break
        }
        if (i === 0) { index = 0; into = 0 }
    }
    if (into > 0 && into < DURING_THRESHOLD_MIN) into = 0
    return { index, intoMinutes: into, during: into > 0 }
}

/** backward slot for a chain that should START at `minute` (hot path): the
 *  unit begins `into` minutes into whichever step that minute falls in. */
function resolveCarbStyleSlotFromMinute(timeline: MainTimeline, minute: number): { index: number; intoMinutes: number; during: boolean } {
    const loc = locateMinute(timeline, Math.max(0, Math.min(minute, timeline.total)))
    let into = loc.intoMinutes
    if (into > 0 && into < DURING_THRESHOLD_MIN) into = 0
    return { index: loc.index, intoMinutes: into, during: into > 0 }
}

/** Schedules multiple sides. Heaviest first; any two "during" units sharing
 *  an anchor get staggered STAGGER_MIN minutes apart so alarms never ring
 *  together. `claimed` lets the caller pre-seed anchors already taken by the
 *  other recipes it runs alongside (eg existing picks mid-cook). */
export function scheduleSides(
    timeline: MainTimeline,
    gaps: ReturnType<typeof buildAttentionGaps>,
    steps: Array<MainStepTiming | null | undefined>,
    sides: SideInput[],
    timers?: AttentionTimer[]
): SidePlan[] {
    const plans = (sides || []).map(s => scheduleSide(timeline, gaps, steps, s, timers))
    return staggerSidePlans(plans)
}

/** Collision staggering shared by batch scheduling and mid-cook additions
 *  (where the caller seeds `claimed` with the anchors already in use). */
export function staggerSidePlans(
    plans: SidePlan[],
    claimed?: Map<string, boolean>
): SidePlan[] {
    const seen = claimed || new Map<string, boolean>()
    const ordered = [...plans].sort((a, b) =>
        b.units.reduce((x, u) => x + u.minutes, 0) - a.units.reduce((x, u) => x + u.minutes, 0))
    for (const plan of ordered) {
        for (const unit of plan.units) {
            if (!unit.during) continue
            let key = `${unit.anchorStep}:${unit.intoMinutes}`
            while (seen.get(key)) {
                unit.intoMinutes += STAGGER_MIN
                key = `${unit.anchorStep}:${unit.intoMinutes}`
            }
            seen.set(key, true)
        }
    }
    return plans
}

/** Live hold-card estimate: minutes left on the MAIN dish, from the flow
 *  position and whatever timer is currently eating the current step's
 *  remaining time. When a main timer runs, the countdown decreases with it;
 *  otherwise the static step-sum stands (`activeRemainingSec` null). */
export function estimateMainRemaining(
    timeline: MainTimeline,
    currentStepIndex: number,
    activeRemainingSec: number | null
): number {
    const { resolved, starts, total } = timeline
    if (starts.length === 0) return 0
    const si = Math.min(Math.max(0, currentStepIndex), starts.length - 1)
    const stepMins = resolved[si]
    let doneInStep: number
    if (activeRemainingSec !== null && activeRemainingSec !== undefined && stepMins > 0) {
        doneInStep = stepMins - Math.max(0, Math.min(stepMins, activeRemainingSec / 60))
    } else {
        doneInStep = 0
    }
    const elapsedTotal = starts[si] + doneInStep
    return Math.max(0, Math.round(total - elapsedTotal))
}

/** True when a plan's unit auto-fires off the anchor step's main timer
 *  (the existing scheduleDuringPhases mechanism). All other units render as
 *  manual cards the cook starts by hand - never late, may be early. */
export function isAutoUnit(unit: SideUnitPlan): boolean {
    return !!(unit.during && unit.intoMinutes > 0)
}

