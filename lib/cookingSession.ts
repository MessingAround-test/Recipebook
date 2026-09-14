// Cooking-session model shared by the recipe page and the global cooking
// bubble. Kept free of DOM/React so it can be unit-tested: the recipe page
// persists one `timer-session-<recipeId>` entry per cooked recipe, and the
// bubble reads them from anywhere in the app.

export const SESSION_PREFIX = 'timer-session-'

export interface CookingTimerSession {
    endTime: number | null
    remaining: number
    status: string
    checkpointsHit?: string[]
    during?: boolean
    preAlertHit?: boolean
}

export interface TimerMeta {
    name?: string
    durationSec?: number
}

export interface CookingSessionData {
    v?: number
    timers?: Record<string, CookingTimerSession>
    currentFlow?: number
    doneFlow?: number[]
    carbChoice?: any
    customTimers?: any[]
    scaleFactor?: number
    cooking?: boolean
    recipeName?: string
    startedAt?: number
    timerMeta?: Record<string, TimerMeta>
}

export interface CookingSessionSummary {
    recipeId: string
    recipeName: string
    currentFlow: number
    doneFlow: number[]
    timers: Record<string, CookingTimerSession>
    timerMeta: Record<string, TimerMeta>
    startedAt: number | null
}

export interface UrgentTimer {
    id: string
    name: string
    remainingSec: number
    totalSec: number | null
    overdue: boolean
    paused: boolean
    status: string
}

const ACTIVE_STATUSES = ['active', 'overdue', 'paused']

export function isCookingActive(data: CookingSessionData | null | undefined): boolean {
    if (!data || typeof data !== 'object') return false
    // Explicit flag wins for sessions written since v6.
    if (data.cooking === true) return true
    if (data.cooking === false) return false
    // Legacy sessions (pre-v6) have no flag — infer from progress/timers.
    if (typeof data.currentFlow === 'number' && data.currentFlow > 0) return true
    if (Array.isArray(data.doneFlow) && data.doneFlow.length > 0) return true
    if (Array.isArray(data.customTimers) && data.customTimers.length > 0) return true
    const timers = data.timers || {}
    return Object.values(timers).some(s => s && ACTIVE_STATUSES.includes(s.status))
}

export function parseCookingSession(recipeId: string, raw: string | CookingSessionData | null | undefined): CookingSessionSummary | null {
    if (!recipeId) return null
    let data: CookingSessionData | null = null
    if (raw == null) return null
    if (typeof raw === 'string') {
        if (!raw.trim()) return null
        try {
            data = JSON.parse(raw)
        } catch {
            return null
        }
    } else {
        data = raw
    }
    if (!data || typeof data !== 'object') return null
    return {
        recipeId,
        recipeName: typeof data.recipeName === 'string' && data.recipeName.trim() ? data.recipeName.trim() : 'Cooking',
        currentFlow: typeof data.currentFlow === 'number' ? data.currentFlow : 0,
        doneFlow: Array.isArray(data.doneFlow) ? data.doneFlow : [],
        timers: data.timers && typeof data.timers === 'object' ? data.timers : {},
        timerMeta: data.timerMeta && typeof data.timerMeta === 'object' ? data.timerMeta : {},
        startedAt: typeof data.startedAt === 'number' ? data.startedAt : null
    }
}

// Builds summaries from `[key, raw]` pairs (e.g. Object.entries(localStorage)).
// Entries that aren't cooking sessions or aren't active are dropped. Sorted
// oldest-cook-first so bubble order stays stable as new sessions appear.
export function parseCookingSessions(entries: Array<[string, string | null | undefined]>): CookingSessionSummary[] {
    const out: CookingSessionSummary[] = []
    for (const [key, raw] of entries || []) {
        if (!key || !key.startsWith(SESSION_PREFIX)) continue
        const recipeId = key.slice(SESSION_PREFIX.length)
        if (!recipeId) continue
        let data: CookingSessionData | null = null
        try {
            data = typeof raw === 'string' ? JSON.parse(raw) : (raw as any)
        } catch {
            data = null
        }
        if (!isCookingActive(data)) continue
        const summary = parseCookingSession(recipeId, data)
        if (summary) out.push(summary)
    }
    return out.sort((a, b) => {
        const at = a.startedAt || 0
        const bt = b.startedAt || 0
        if (at !== bt) return at - bt
        return a.recipeId.localeCompare(b.recipeId)
    })
}

export function getRemainingSec(session: CookingTimerSession | null | undefined, now: number = Date.now()): number {
    if (!session) return 0
    if ((session.status === 'active' || session.status === 'overdue') && session.endTime) {
        return Math.ceil((session.endTime - now) / 1000)
    }
    return session.remaining
}

// Compact label for the small bubble: only the largest unit, no seconds once
// the timer is a minute or more long. Overdue timers read as 0s.
export function formatBubbleTime(remainingSec: number): string {
    if (remainingSec <= 0) return '0s'
    const secs = Math.floor(remainingSec)
    const hours = Math.floor(secs / 3600)
    if (hours > 0) return `${hours}h`
    const mins = Math.floor(secs / 60)
    if (mins > 0) return `${mins}m`
    return `${secs}s`
}

// The timer the bubble counts down: an overdue timer always wins, then the
// soonest-finishing running timer, then a paused one. Returns null if the cook
// has no timer that is currently "alive".
export function getUrgentTimer(summary: CookingSessionSummary | null | undefined, now: number = Date.now()): UrgentTimer | null {
    if (!summary) return null
    const candidates: UrgentTimer[] = []
    for (const [id, session] of Object.entries(summary.timers || {})) {
        if (!session || !ACTIVE_STATUSES.includes(session.status)) continue
        const meta = summary.timerMeta?.[id] || {}
        candidates.push({
            id,
            name: meta.name || (session.during ? 'Side dish' : 'Timer'),
            remainingSec: getRemainingSec(session, now),
            totalSec: typeof meta.durationSec === 'number' ? meta.durationSec : null,
            overdue: session.status === 'overdue',
            paused: session.status === 'paused',
            status: session.status
        })
    }
    if (candidates.length === 0) return null
    const rank = (t: UrgentTimer) => (t.overdue ? 0 : t.paused ? 2 : 1)
    candidates.sort((a, b) => {
        const r = rank(a) - rank(b)
        if (r !== 0) return r
        return a.remainingSec - b.remainingSec
    })
    return candidates[0]
}

export interface BubbleViewport {
    width: number
    height?: number
    safeAreaBottom?: number
}

const MOBILE_MAX_WIDTH = 768
const BUBBLE_SIZE = 56
const BUBBLE_GAP = 12
const MOBILE_NAV_HEIGHT = 72 // 4.5rem — matches the fixed bottom taskbar
const MOBILE_EDGE = 12
const DESKTOP_EDGE = 20

export function isMobileViewport(width: number): boolean {
    return width <= MOBILE_MAX_WIDTH
}

// Start position (distance from the right/bottom viewport edges) for the
// bubble at `index` when `count` are present. Bubbles stack upward on the
// right and clear the fixed bottom taskbar on phones.
export function getBubbleStartPosition(count: number, index: number, viewport: BubbleViewport): { right: number; bottom: number } {
    const safeIndex = Math.max(0, Math.floor(index || 0))
    const width = viewport?.width || (typeof window !== 'undefined' ? window.innerWidth : 1024)
    if (isMobileViewport(width)) {
        const safeArea = viewport?.safeAreaBottom || 0
        return {
            right: MOBILE_EDGE,
            bottom: MOBILE_NAV_HEIGHT + MOBILE_EDGE + safeIndex * (BUBBLE_SIZE + BUBBLE_GAP) + safeArea
        }
    }
    return {
        right: DESKTOP_EDGE,
        bottom: DESKTOP_EDGE + safeIndex * (BUBBLE_SIZE + BUBBLE_GAP)
    }
}

// Removes a recipe's stored session. Accepts any localStorage-like storage so
// it works in tests and on the server without touching `window` directly.
export function clearCookingSession(recipeId: string, storage?: Pick<Storage, 'removeItem'>): void {
    if (!recipeId) return
    const store = storage || (typeof window !== 'undefined' ? window.localStorage : undefined)
    if (!store) return
    try {
        store.removeItem(`${SESSION_PREFIX}${recipeId}`)
    } catch {}
}
