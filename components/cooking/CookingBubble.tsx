import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import { ChefHat, Pause, Trash2 } from 'lucide-react'
import {
    SESSION_PREFIX,
    clearCookingSession,
    formatBubbleTime,
    getBubbleStartPosition,
    getUrgentTimer,
    parseCookingSessions,
    type CookingSessionSummary
} from '../../lib/cookingSession'
import { formatCountdown } from '../../lib/quickTools'
import { playAlarm, sendNotification } from '../../lib/alarm'

const BUBBLE_SIZE = 56
const TAP_SLOP = 8
const DISMISS_MARGIN = 150
const REREAD_MS = 1000
const OVERDUE_RERING_MS = 4000
const POS_KEY = 'cook-bubble-pos-v1'

interface Point {
    x: number
    y: number
}

interface DragState {
    id: string
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
    inZone: boolean
}

function readSessions(): CookingSessionSummary[] {
    if (typeof window === 'undefined') return []
    try {
        const entries: Array<[string, string]> = []
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i)
            if (!key || !key.startsWith(SESSION_PREFIX)) continue
            entries.push([key, window.localStorage.getItem(key) || ''])
        }
        return parseCookingSessions(entries)
    } catch {
        return []
    }
}

function getSafeAreaBottom(): number {
    if (typeof document === 'undefined') return 0
    try {
        const probe = document.createElement('div')
        probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;pointer-events:none;height:env(safe-area-inset-bottom);'
        document.body.appendChild(probe)
        const h = probe.getBoundingClientRect().height || 0
        document.body.removeChild(probe)
        return h
    } catch {
        return 0
    }
}

function loadPositions(): Record<string, Point> {
    if (typeof window === 'undefined') return {}
    try {
        const raw = window.localStorage.getItem(POS_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

function savePositions(positions: Record<string, Point>) {
    try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(positions))
    } catch {}
}

function markOverdue(recipeId: string, timerId: string): boolean {
    if (typeof window === 'undefined') return false
    const key = `${SESSION_PREFIX}${recipeId}`
    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return false
        const data = JSON.parse(raw)
        const session = data?.timers?.[timerId]
        if (!session || session.status !== 'active') return false
        data.timers[timerId] = { ...session, status: 'overdue' }
        window.localStorage.setItem(key, JSON.stringify(data))
        return true
    } catch {
        return false
    }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export default function CookingBubble() {
    const router = useRouter()
    const onRecipePage = router.pathname === '/recipes/[id]'
    const routerId = router.query.id
    const currentRecipeId = typeof routerId === 'string' ? routerId : Array.isArray(routerId) ? routerId[0] : undefined
    // On a recipe's own page its cooking view owns the timers — suppress only
    // that recipe's bubble (other in-progress cooks still surface and ring).
    const suppressedId = onRecipePage ? currentRecipeId : undefined

    const [mounted, setMounted] = useState(false)
    const [sessions, setSessions] = useState<CookingSessionSummary[]>([])
    const [nowMs, setNowMs] = useState(() => Date.now())
    const [positions, setPositions] = useState<Record<string, Point>>({})
    const [drag, setDrag] = useState<DragState | null>(null)
    const [viewport, setViewport] = useState({ width: 1024, height: 768 })
    const [safeAreaBottom, setSafeAreaBottom] = useState(0)

    const positionsRef = useRef(positions)
    positionsRef.current = positions
    const sessionsRef = useRef(sessions)
    sessionsRef.current = sessions
    const lastAlarmAtRef = useRef(0)

    useEffect(() => {
        setMounted(true)
        setSafeAreaBottom(getSafeAreaBottom())
    }, [])

    // Track viewport so initial positions and clamping stay correct on resize.
    useEffect(() => {
        const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
        update()
        window.addEventListener('resize', update)
        window.addEventListener('orientationchange', update)
        return () => {
            window.removeEventListener('resize', update)
            window.removeEventListener('orientationchange', update)
        }
    }, [])

    // Poll localStorage: drives the countdown, catches sessions started on the
    // recipe page, and survives cross-tab changes via the storage event.
    useEffect(() => {
        if (!mounted) return
        const refresh = () => {
            setNowMs(Date.now())
            setSessions(readSessions())
        }
        refresh()
        const interval = setInterval(refresh, REREAD_MS)
        window.addEventListener('storage', refresh)
        document.addEventListener('visibilitychange', refresh)
        return () => {
            clearInterval(interval)
            window.removeEventListener('storage', refresh)
            document.removeEventListener('visibilitychange', refresh)
        }
    }, [mounted])

    // Global alarm engine — only when the recipe page isn't mounted (it runs
    // its own engine there, and would otherwise double-ring).
    useEffect(() => {
        if (!mounted) return
        const interval = setInterval(() => {
            const now = Date.now()
            const current = sessionsRef.current
            let rangThisTick = false
            let hasOverdue = false
            for (const session of current) {
                if (session.recipeId === suppressedId) continue
                for (const [timerId, live] of Object.entries(session.timers)) {
                    if (!live || live.status !== 'active' || !live.endTime) continue
                    if (live.endTime - now <= 0) {
                        if (markOverdue(session.recipeId, timerId)) {
                            const meta = session.timerMeta?.[timerId]
                            playAlarm()
                            sendNotification(session.recipeName || 'Cooking timer', `${meta?.name || 'Timer'} is done!`)
                            rangThisTick = true
                        }
                    }
                }
                if (Object.values(session.timers).some(s => s && s.status === 'overdue')) hasOverdue = true
            }
            if (rangThisTick) {
                lastAlarmAtRef.current = now
            } else if (hasOverdue && now - lastAlarmAtRef.current >= OVERDUE_RERING_MS) {
                playAlarm()
                lastAlarmAtRef.current = now
            }
        }, REREAD_MS)
        return () => clearInterval(interval)
    }, [mounted, suppressedId])

    const dismissZone = useCallback((x: number, y: number) => {
        const cx = x + BUBBLE_SIZE / 2
        const vw = window.innerWidth
        const vh = window.innerHeight
        const withinX = Math.abs(cx - vw / 2) < vw * 0.22
        const withinY = y + BUBBLE_SIZE / 2 > vh - DISMISS_MARGIN
        return withinX && withinY
    }, [])

    const initialPosition = useCallback((index: number): Point => {
        const vw = window.innerWidth
        const vh = window.innerHeight
        const { right, bottom } = getBubbleStartPosition(sessions.length, index, {
            width: vw,
            height: vh,
            safeAreaBottom
        })
        return { x: Math.max(0, vw - right - BUBBLE_SIZE), y: Math.max(0, vh - bottom - BUBBLE_SIZE) }
    }, [sessions.length, safeAreaBottom])

    // Seed positions for any session we haven't placed yet (persisted first).
    useEffect(() => {
        if (!mounted || sessions.length === 0) return
        const stored = loadPositions()
        setPositions(prev => {
            let changed = false
            const next = { ...prev }
            sessions.forEach((session, index) => {
                if (next[session.recipeId]) return
                const saved = stored[session.recipeId]
                next[session.recipeId] = saved && typeof saved.x === 'number' && typeof saved.y === 'number'
                    ? { x: clamp(saved.x, 0, window.innerWidth - BUBBLE_SIZE), y: clamp(saved.y, 0, window.innerHeight - BUBBLE_SIZE) }
                    : initialPosition(index)
                changed = true
            })
            return changed ? next : prev
        })
    }, [mounted, sessions, initialPosition])

    // Keep bubbles on screen when the viewport changes (unless mid-drag).
    useEffect(() => {
        if (drag) return
        setPositions(prev => {
            let changed = false
            const next: Record<string, Point> = {}
            for (const [id, pos] of Object.entries(prev)) {
                const nx = clamp(pos.x, 0, viewport.width - BUBBLE_SIZE)
                const ny = clamp(pos.y, 0, viewport.height - BUBBLE_SIZE)
                next[id] = nx === pos.x && ny === pos.y ? pos : { x: nx, y: ny }
                if (next[id] !== pos) changed = true
            }
            return changed ? next : prev
        })
    }, [viewport.width, viewport.height, drag])

    const navigate = useCallback((recipeId: string) => {
        router.push(`/recipes/${recipeId}?cook=1`)
    }, [router])

    const onPointerDown = (e: React.PointerEvent, session: CookingSessionSummary) => {
        if (e.button !== undefined && e.button !== 0) return
        const pos = positionsRef.current[session.recipeId]
        if (!pos) return
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
        setDrag({
            id: session.recipeId,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            originX: pos.x,
            originY: pos.y,
            moved: false,
            inZone: false
        })
    }

    const onPointerMove = (e: React.PointerEvent) => {
        if (!drag || e.pointerId !== drag.pointerId) return
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        const moved = drag.moved || Math.abs(dx) + Math.abs(dy) > TAP_SLOP
        const nx = clamp(drag.originX + dx, 0, window.innerWidth - BUBBLE_SIZE)
        const ny = clamp(drag.originY + dy, 0, window.innerHeight - BUBBLE_SIZE)
        const inZone = dismissZone(nx, ny)
        setDrag({ ...drag, moved, inZone })
        setPositions(prev => ({ ...prev, [drag.id]: { x: nx, y: ny } }))
    }

    const endDrag = (e: React.PointerEvent, cancelled: boolean) => {
        if (!drag || e.pointerId !== drag.pointerId) return
        const current = drag
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
        setDrag(null)
        if (!current.moved) {
            navigate(current.id)
            return
        }
        if (!cancelled && current.inZone) {
            clearCookingSession(current.id)
            setSessions(prev => prev.filter(s => s.recipeId !== current.id))
            setPositions(prev => {
                const next = { ...prev }
                delete next[current.id]
                savePositions(next)
                return next
            })
            return
        }
        // Snap to the nearest horizontal edge, keeping the current height.
        setPositions(prev => {
            const pos = prev[current.id]
            if (!pos) return prev
            const margin = 12
            const mid = window.innerWidth / 2
            const snappedX = pos.x + BUBBLE_SIZE / 2 < mid ? margin : window.innerWidth - BUBBLE_SIZE - margin
            const next = { ...prev, [current.id]: { x: snappedX, y: pos.y } }
            savePositions(next)
            return next
        })
    }

    const visibleSessions = suppressedId ? sessions.filter(s => s.recipeId !== suppressedId) : sessions

    if (!mounted || visibleSessions.length === 0) return null

    const safeArea = safeAreaBottom

    return createPortal(
        <>
            {drag?.moved && (
                <div
                    className={`cook-bubble-dismiss ${drag.inZone ? 'is-armed' : ''}`}
                    style={{ bottom: `calc(24px + ${safeArea}px)` }}
                    aria-hidden="true"
                >
                    <Trash2 size={18} />
                    <span className="cook-bubble-dismiss-text">Drop to finish</span>
                </div>
            )}
            {visibleSessions.map((session) => {
                const pos = positions[session.recipeId]
                if (!pos) return null
                const urgent = getUrgentTimer(session, nowMs)
                const overdue = !!urgent?.overdue
                const paused = !!urgent?.paused
                const total = urgent?.totalSec
                const remaining = urgent?.remainingSec ?? 0
                const progress = total && total > 0
                    ? Math.min(100, Math.max(0, ((total - Math.max(0, remaining)) / total) * 100))
                    : 0
                const circumference = 2 * Math.PI * 26
                const dashOffset = circumference * (1 - progress / 100)
                const isDragging = drag?.id === session.recipeId && drag.moved
                const label = urgent
                    ? `${session.recipeName}: ${urgent.name} — ${overdue ? 'overdue' : paused ? 'paused' : formatCountdown(remaining) + ' left'}`
                    : `${session.recipeName} — resume cooking`
                return (
                    <div
                        key={session.recipeId}
                        role="button"
                        tabIndex={0}
                        aria-label={label}
                        title={label}
                        className={`cook-bubble ${overdue ? 'is-overdue' : ''} ${paused ? 'is-paused' : ''} ${!urgent ? 'is-idle' : ''} ${isDragging ? 'is-dragging' : ''}`}
                        style={{ left: pos.x, top: pos.y, width: BUBBLE_SIZE, height: BUBBLE_SIZE }}
                        onPointerDown={(e) => onPointerDown(e, session)}
                        onPointerMove={onPointerMove}
                        onPointerUp={(e) => endDrag(e, false)}
                        onPointerCancel={(e) => endDrag(e, true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                navigate(session.recipeId)
                            }
                        }}
                    >
                        <svg className="cook-bubble-ring" viewBox="0 0 56 56" aria-hidden="true">
                            <circle className="cook-bubble-ring-track" cx="28" cy="28" r="26" />
                            <circle
                                className="cook-bubble-ring-fill"
                                cx="28"
                                cy="28"
                                r="26"
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                            />
                        </svg>
                        <span className="cook-bubble-core">
                            {urgent ? (
                                paused
                                    ? <Pause size={18} fill="currentColor" />
                                    : <span className="cook-bubble-time">{formatBubbleTime(remaining)}</span>
                            ) : (
                                <ChefHat size={22} />
                            )}
                        </span>
                        <span className="cook-bubble-label">
                            {session.recipeName}{urgent ? ` · ${urgent.name}` : ''}
                        </span>
                    </div>
                )
            })}
        </>,
        document.body
    )
}
