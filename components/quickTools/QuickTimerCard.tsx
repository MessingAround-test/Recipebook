import { Check, Pause, Play, RotateCcw, X } from 'lucide-react'
import type { QuickTimer } from '../../lib/useQuickTimers'
import { formatCountdown, formatDurationLabel, getProgress, getRemaining } from '../../lib/quickTools'

interface QuickTimerCardProps {
    timer: QuickTimer
    now: number
    onStart: (id: string) => void
    onPause: (id: string) => void
    onResume: (id: string) => void
    onAdd: (id: string, seconds: number) => void
    onComplete: (id: string) => void
    onReset: (id: string) => void
    onRemove: (id: string) => void
}

// Renders with the same .cooking-mgr-* classes as the recipe page so a quick
// timer looks and behaves exactly like a cooking-mode timer.
export default function QuickTimerCard({
    timer,
    now,
    onStart,
    onPause,
    onResume,
    onAdd,
    onComplete,
    onReset,
    onRemove
}: QuickTimerCardProps) {
    const session = { endTime: timer.endTime, remainingSec: timer.remainingSec, status: timer.status }
    const remaining = getRemaining(session, now)
    const progress = getProgress(timer.durationSec, session, now)
    const isOverdue = timer.status === 'overdue'
    const isLive = timer.status === 'active' || timer.status === 'paused' || isOverdue

    if (timer.status === 'completed') {
        return (
            <div className="cooking-mgr-card is-completed">
                <div className="cooking-mgr-head">
                    <span className="cooking-mgr-name is-done">{timer.name}</span>
                    <div className="cooking-mgr-head-actions">
                        <button className="cooking-mgr-link" onClick={() => onReset(timer.id)}>Restart</button>
                        <button className="cooking-mgr-link is-danger" onClick={() => onRemove(timer.id)} aria-label="Remove timer">✕</button>
                    </div>
                </div>
            </div>
        )
    }

    if (timer.status === 'pending') {
        return (
            <div className="cooking-mgr-card is-pending">
                <div className="cooking-mgr-head">
                    <span className="cooking-mgr-name">{timer.name}</span>
                    <button className="cooking-mgr-link is-danger" onClick={() => onRemove(timer.id)} aria-label="Remove timer">✕</button>
                </div>
                <button className="cooking-timer-btn is-full is-accent" onClick={() => onStart(timer.id)}>
                    <Play size={13} /> Start {formatDurationLabel(timer.durationSec / 60)}
                </button>
            </div>
        )
    }

    return (
        <div className={`cooking-mgr-card is-${timer.status}`}>
            <div className="cooking-mgr-head">
                <span className="cooking-mgr-name">{timer.name}</span>
                <div className="cooking-mgr-head-actions">
                    {isOverdue && <span className="cooking-timer-tag is-overdue">Overdue</span>}
                    {timer.status === 'paused' && <span className="cooking-timer-tag">Paused</span>}
                    <button className="cooking-mgr-link" onClick={() => onReset(timer.id)}>Reset</button>
                    <button className="cooking-mgr-link is-danger" onClick={() => onRemove(timer.id)} aria-label="Remove timer">✕</button>
                </div>
            </div>
            <div className={`cooking-mgr-countdown ${isOverdue ? 'is-overdue' : ''}`}>{formatCountdown(remaining)}</div>
            <div className="cooking-progress-wrap">
                <div className="cooking-progress-track">
                    <div className="cooking-progress-fill" style={{ width: `${progress}%` }} />
                </div>
            </div>
            {isOverdue ? (
                <div className="cooking-timer-actions">
                    <button className="cooking-timer-btn" onClick={() => onAdd(timer.id, 120)}>+2 min</button>
                    <button className="cooking-timer-btn" onClick={() => onAdd(timer.id, 300)}>+5 min</button>
                    <button className="cooking-timer-btn is-primary" onClick={() => onComplete(timer.id)}><Check size={13} /> Done</button>
                </div>
            ) : (
                <div className="cooking-timer-actions">
                    {timer.status === 'active' ? (
                        <button className="cooking-timer-btn" onClick={() => onPause(timer.id)}><Pause size={13} /> Pause</button>
                    ) : (
                        <button className="cooking-timer-btn" onClick={() => onResume(timer.id)}><Play size={13} /> Resume</button>
                    )}
                    <button className="cooking-timer-btn" onClick={() => onAdd(timer.id, 60)}>+1 min</button>
                    <button className="cooking-timer-btn is-primary" onClick={() => onComplete(timer.id)}><Check size={13} /> Done</button>
                </div>
            )}
        </div>
    )
}
