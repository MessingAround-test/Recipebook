import { Flag, Pause, Play, RotateCcw } from 'lucide-react'
import { formatClock } from '../../lib/quickTools'
import type { StopwatchState } from '../../lib/useQuickTimers'

interface StopwatchProps {
    stopwatch: StopwatchState
    elapsed: number
    onStart: () => void
    onPause: () => void
    onReset: () => void
    onLap: () => void
}

export default function Stopwatch({ stopwatch, elapsed, onStart, onPause, onReset, onLap }: StopwatchProps) {
    const total = stopwatch.laps.length

    return (
        <div className="flex flex-col gap-5">
            <div className="text-center py-4">
                <div className="cooking-countdown" style={{ fontSize: '3.4rem', margin: 0 }}>{formatClock(elapsed)}</div>
                <div className="cooking-countdown-sub">Stopwatch</div>
            </div>

            <div className="flex gap-2">
                {stopwatch.running ? (
                    <button className="cooking-timer-btn is-primary" onClick={onPause}><Pause size={14} /> Pause</button>
                ) : (
                    <button className="cooking-timer-btn is-primary" onClick={onStart}><Play size={14} /> {elapsed > 0 ? 'Resume' : 'Start'}</button>
                )}
                <button className="cooking-timer-btn" onClick={onLap} disabled={!stopwatch.running}>
                    <Flag size={14} /> Lap
                </button>
                <button className="cooking-timer-btn" onClick={onReset} disabled={elapsed === 0 && total === 0}>
                    <RotateCcw size={14} /> Reset
                </button>
            </div>

            {total > 0 && (
                <div className="flex flex-col gap-1.5">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Laps</div>
                    {stopwatch.laps.map((lap, i) => {
                        const split = lap - (stopwatch.laps[i + 1] || 0)
                        return (
                            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-border">
                                <span className="text-[11px] font-bold text-muted-foreground">Lap {total - i}</span>
                                <span className="flex items-center gap-3 text-sm font-semibold tabular-nums">
                                    <span className="text-[11px] text-muted-foreground">+{formatClock(split)}</span>
                                    {formatClock(lap)}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
