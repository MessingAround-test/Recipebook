// Pure helpers for keeping a timer's dependents in step with it. When a
// timer completes, restarts or is extended, everything scheduled behind it —
// dependency children and the "during" side phases anchored to its step —
// must move by the same delta or the waits drift away from their anchor.
// Kept free of React/localStorage so it can be unit-tested.

import type { CookingTimerSession } from './cookingSession'

export interface TimerLike {
    id: string
    carb?: boolean
    stepIndex?: number
    dependencies?: Array<{ timerId: string; offset?: number }>
}

export interface PhaseRef {
    timerId: string
    intoMinutes?: number
}

// The moment a session is (or was) planned to end. Active/overdue sessions
// carry their end time; completed ones record when they actually finished;
// paused/pending sessions count down from `remaining` with no fixed end.
export function scheduledEndOf(session: CookingTimerSession | null | undefined): number | null {
    if (!session) return null
    if (session.status === 'active' || session.status === 'overdue') return session.endTime ?? null
    if (session.status === 'completed') return session.completedAt ?? null
    return null
}

// How far the plan moved between two scheduled ends. A missing anchor on
// either side means there is nothing to compare against: no shift.
export function scheduleDelta(prevEnd: number | null | undefined, newEnd: number | null | undefined): number {
    if (prevEnd == null || newEnd == null) return 0
    return newEnd - prevEnd
}

// Applies `deltaMs` to one session: running ones slide their end time,
// paused ones adjust their stored remaining (they carry no end time), and
// completed/pending ones are untouched. A "during" phase whose moment has
// already passed rang as "start now" — it stays where it fired.
export function shiftSession(session: CookingTimerSession, deltaMs: number, now: number): CookingTimerSession {
    if (!session || !deltaMs) return session
    if (session.status === 'paused') {
        return { ...session, remaining: Math.max(0, (session.remaining || 0) + Math.trunc(deltaMs / 1000)) }
    }
    if ((session.status === 'active' || session.status === 'overdue') && session.endTime) {
        if (session.during && session.endTime <= now) return session
        return { ...session, endTime: session.endTime + deltaMs }
    }
    return session
}

// Every timer id that hangs off `sourceId`: dependency children (and their
// children, one delta down the chain) plus the "during" phases anchored to
// each visited timer's step. Carb phases are excluded the way the old
// per-step shift was (a carb timer owns its own schedule). Cycles are cut by
// the visited set; the source itself never appears in the result.
export function collectShiftTargets(
    sourceId: string,
    timers: TimerLike[],
    duringPhasesForStep: (stepIndex: number) => PhaseRef[]
): string[] {
    if (!sourceId) return []
    const visited = new Set<string>([sourceId])
    const targets: string[] = []
    const queue: string[] = [sourceId]
    while (queue.length > 0) {
        const id = queue.shift() as string
        const timer = timers.find(t => t.id === id)
        if (timer && !timer.carb && typeof timer.stepIndex === 'number') {
            for (const phase of duringPhasesForStep(timer.stepIndex) || []) {
                if (!phase?.timerId || visited.has(phase.timerId)) continue
                visited.add(phase.timerId)
                targets.push(phase.timerId)
                queue.push(phase.timerId)
            }
        }
        for (const t of timers) {
            if (visited.has(t.id)) continue
            if ((t.dependencies || []).some(d => d?.timerId === id)) {
                visited.add(t.id)
                targets.push(t.id)
                queue.push(t.id)
            }
        }
    }
    return targets
}

// The full shift to apply after a source timer's schedule moved by
// `deltaMs`: every target inherits the same delta (a chain moves as one
// block — each link's own offset was baked in where it was scheduled).
export function planShiftWave(
    sourceId: string,
    deltaMs: number,
    timers: TimerLike[],
    duringPhasesForStep: (stepIndex: number) => PhaseRef[]
): Array<{ id: string; deltaMs: number }> {
    if (!deltaMs) return []
    return collectShiftTargets(sourceId, timers, duringPhasesForStep).map(id => ({ id, deltaMs }))
}
