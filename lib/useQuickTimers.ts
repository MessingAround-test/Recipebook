import { useCallback, useEffect, useRef, useState } from 'react'
import { getRemaining } from './quickTools'

// Quick timers live entirely in localStorage (absolute end times) so they keep
// counting while you navigate — reopening Quick Tools recomputes the remaining
// time from the stored end time. There is deliberately no global widget: alarms
// ring while this page is mounted.

export type QuickTimerStatus = 'pending' | 'active' | 'paused' | 'overdue' | 'completed'

export interface QuickTimer {
    id: string
    name: string
    durationSec: number
    remainingSec: number
    endTime: number | null
    status: QuickTimerStatus
    createdAt: number
}

export interface StopwatchState {
    running: boolean
    startedAt: number | null
    elapsedSec: number
    laps: number[]
}

const STORAGE_KEY = 'quick-timers-v1'

const DEFAULT_STOPWATCH: StopwatchState = { running: false, startedAt: null, elapsedSec: 0, laps: [] }

interface StoredState {
    v: number
    timers: QuickTimer[]
    stopwatch: StopwatchState
}

function loadState(): StoredState {
    const fallback: StoredState = { v: 1, timers: [], stopwatch: DEFAULT_STOPWATCH }
    if (typeof window === 'undefined') return fallback
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return fallback
        const parsed = JSON.parse(raw)
        const timers = Array.isArray(parsed?.timers) ? parsed.timers.filter((t: any) => t && t.id) : []
        const stopwatch = { ...DEFAULT_STOPWATCH, ...(parsed?.stopwatch || {}) }
        return { v: 1, timers, stopwatch }
    } catch {
        return fallback
    }
}

export function makeTimerId(): string {
    return `qt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function playAlarm() {
    if (typeof window === 'undefined') return
    try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext
        if (!Ctor) return
        const ctx = new Ctor()
        const playBeep = (freq: number, startTime: number) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = freq
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.3, startTime)
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3)
            osc.start(startTime)
            osc.stop(startTime + 0.3)
        }
        const now = ctx.currentTime
        playBeep(880, now)
        playBeep(880, now + 0.35)
        playBeep(1100, now + 0.7)
    } catch (e) {
        console.error('Audio alarm failed:', e)
    }
}

export function sendNotification(title: string, body: string) {
    try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' })
        }
    } catch (e) {
        console.error('Notification failed:', e)
    }
}

export function useQuickTimers() {
    const [timers, setTimers] = useState<QuickTimer[]>([])
    const [stopwatch, setStopwatch] = useState<StopwatchState>(DEFAULT_STOPWATCH)
    const [nowMs, setNowMs] = useState(() => Date.now())
    // `hydrated` (not a ref) gates persistence: in React StrictMode the mount
    // effect runs twice, and a ref would let the first pass persist the empty
    // initial state before the second pass reads storage — wiping saved timers.
    const [hydrated, setHydrated] = useState(false)

    const timersRef = useRef<QuickTimer[]>([])
    timersRef.current = timers
    const lastAlarmAtRef = useRef(0)

    // Load after mount (server renders empty) — same pattern as the recipe page.
    useEffect(() => {
        const loaded = loadState()
        setTimers(loaded.timers)
        setStopwatch(loaded.stopwatch)
        setHydrated(true)
    }, [])

    // Persist only once the loaded state has actually been rendered.
    useEffect(() => {
        if (!hydrated) return
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, timers, stopwatch }))
        } catch {}
    }, [hydrated, timers, stopwatch])

    useEffect(() => {
        try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                Notification.requestPermission()
            }
        } catch {}
    }, [])

    const engineActive =
        stopwatch.running || timers.some(t => t.status === 'active' || t.status === 'overdue')

    // 250ms tick: accurate to the second, cheap, and drives the progress bars.
    useEffect(() => {
        if (!engineActive) return
        const interval = setInterval(() => {
            const now = Date.now()
            setNowMs(now)
            const current = timersRef.current
            // Alarm side effects read the last committed snapshot; the state
            // transition itself uses a functional update so it can never
            // clobber a pause/resume/extend that landed during this tick.
            const newlyOverdue = current.filter(t => t.status === 'active' && t.endTime && t.endTime - now <= 0)
            setTimers(prev => {
                let changed = false
                const next = prev.map(t => {
                    if (t.status === 'active' && t.endTime && t.endTime - now <= 0) {
                        changed = true
                        return { ...t, status: 'overdue' as QuickTimerStatus }
                    }
                    return t
                })
                return changed ? next : prev
            })
            if (newlyOverdue.length > 0) {
                newlyOverdue.forEach(t => {
                    playAlarm()
                    sendNotification(t.name || 'Quick timer', `${t.name || 'Timer'} is done!`)
                })
                lastAlarmAtRef.current = now
            } else if (current.some(t => t.status === 'overdue') && now - lastAlarmAtRef.current >= 4000) {
                // Keep ringing every 4s while an overdue timer is unacknowledged
                playAlarm()
                lastAlarmAtRef.current = now
            }
        }, 250)
        return () => clearInterval(interval)
    }, [engineActive])

    const createTimer = useCallback((name: string, durationSec: number): string => {
        const sec = Math.max(1, Math.floor(durationSec))
        const id = makeTimerId()
        const timer: QuickTimer = {
            id,
            name: (name || '').trim() || 'Timer',
            durationSec: sec,
            remainingSec: sec,
            endTime: Date.now() + sec * 1000,
            status: 'active',
            createdAt: Date.now()
        }
        setTimers(prev => [timer, ...prev])
        return id
    }, [])

    const startTimer = useCallback((id: string) => {
        setTimers(prev => prev.map(t => {
            if (t.id !== id) return t
            const sec = t.remainingSec > 0 ? t.remainingSec : t.durationSec
            return { ...t, remainingSec: sec, endTime: Date.now() + sec * 1000, status: 'active' }
        }))
    }, [])

    const pauseTimer = useCallback((id: string) => {
        const now = Date.now()
        setTimers(prev => prev.map(t => {
            if (t.id !== id) return t
            if (t.status === 'active' && t.endTime) {
                const rem = Math.max(0, Math.ceil((t.endTime - now) / 1000))
                return { ...t, endTime: null, remainingSec: rem, status: 'paused' }
            }
            return t
        }))
    }, [])

    const resumeTimer = useCallback((id: string) => {
        setTimers(prev => prev.map(t => {
            if (t.id !== id || t.status !== 'paused') return t
            const sec = t.remainingSec > 0 ? t.remainingSec : 1
            return { ...t, endTime: Date.now() + sec * 1000, status: 'active' }
        }))
    }, [])

    const addSeconds = useCallback((id: string, delta: number) => {
        setTimers(prev => prev.map(t => {
            if (t.id !== id) return t
            if ((t.status === 'active' || t.status === 'overdue') && t.endTime) {
                const base = Math.max(Date.now(), t.endTime)
                return { ...t, endTime: base + delta * 1000, status: 'active' }
            }
            const rem = Math.max(1, (t.remainingSec || 0) + delta)
            return { ...t, remainingSec: rem, endTime: null, status: 'paused' }
        }))
    }, [])

    const completeTimer = useCallback((id: string) => {
        setTimers(prev => prev.map(t => (
            t.id === id ? { ...t, endTime: null, remainingSec: 0, status: 'completed' } : t
        )))
    }, [])

    const resetTimer = useCallback((id: string) => {
        setTimers(prev => prev.map(t => (
            t.id === id ? { ...t, endTime: null, remainingSec: t.durationSec, status: 'pending' } : t
        )))
    }, [])

    const removeTimer = useCallback((id: string) => {
        setTimers(prev => prev.filter(t => t.id !== id))
    }, [])

    const clearCompleted = useCallback(() => {
        setTimers(prev => prev.filter(t => t.status !== 'completed'))
    }, [])

    const startStopwatch = useCallback(() => {
        setStopwatch(prev => (prev.running ? prev : { ...prev, running: true, startedAt: Date.now() }))
    }, [])

    const pauseStopwatch = useCallback(() => {
        setStopwatch(prev => {
            if (!prev.running || !prev.startedAt) return prev
            const elapsed = prev.elapsedSec + (Date.now() - prev.startedAt) / 1000
            return { ...prev, running: false, startedAt: null, elapsedSec: elapsed }
        })
    }, [])

    const resetStopwatch = useCallback(() => {
        setStopwatch({ ...DEFAULT_STOPWATCH })
    }, [])

    const addLap = useCallback(() => {
        setStopwatch(prev => {
            const elapsed = prev.running && prev.startedAt
                ? prev.elapsedSec + (Date.now() - prev.startedAt) / 1000
                : prev.elapsedSec
            return { ...prev, laps: [elapsed, ...prev.laps] }
        })
    }, [])

    const stopwatchElapsed = stopwatch.running && stopwatch.startedAt
        ? stopwatch.elapsedSec + (nowMs - stopwatch.startedAt) / 1000
        : stopwatch.elapsedSec

    const sessionOf = (timer: QuickTimer) => ({
        endTime: timer.endTime,
        remainingSec: timer.remainingSec,
        status: timer.status
    })

    return {
        timers,
        nowMs,
        createTimer,
        startTimer,
        pauseTimer,
        resumeTimer,
        addSeconds,
        completeTimer,
        resetTimer,
        removeTimer,
        clearCompleted,
        stopwatch,
        stopwatchElapsed,
        startStopwatch,
        pauseStopwatch,
        resetStopwatch,
        addLap,
        getRemaining: (timer: QuickTimer, now: number = nowMs) => getRemaining(sessionOf(timer), now)
    }
}
