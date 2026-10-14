// Work timer for 'timed' sets inside the session runner. Countdown from the
// planned duration, or a free count-up stopwatch when no duration is planned.
// On countdown zero the shared alarm rings and the user taps LOG SET to
// confirm (they can also stop early or add time).
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiPlay, FiPause, FiPlus, FiRotateCcw } from 'react-icons/fi';
import { playAlarm } from '../../lib/alarm';
import { formatDurationSec } from '../../lib/gym';

interface Props {
    /** Planned seconds; null/0 → free stopwatch (count up). */
    plannedSec: number | null | undefined;
    /** Called when the user confirms the set with the elapsed whole seconds. */
    onLog: (elapsedSec: number) => void;
    busy?: boolean;
}

export default function SetTimer({ plannedSec, onLog, busy }: Props) {
    const hasPlan = plannedSec != null && Number(plannedSec) > 0;
    const plan = hasPlan ? Math.floor(Number(plannedSec)) : 0;

    const [running, setRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [done, setDone] = useState(false);
    const [planSec, setPlanSec] = useState(plan);
    const startRef = useRef<number | null>(null);
    const elapsedBaseRef = useRef(0);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reset when the planned target changes (new set / new exercise).
    useEffect(() => {
        stopAll();
        setPlanSec(plan);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plannedSec, plan]);

    const stopAll = () => {
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
        startRef.current = null;
    };

    const currentElapsed = () => {
        if (startRef.current == null) return elapsedBaseRef.current;
        return elapsedBaseRef.current + Math.floor((Date.now() - startRef.current) / 1000);
    };

    const fireIfExpired = useCallback((secs: number) => {
        if (hasPlan && secs >= planSec && planSec > 0) {
            stopAll();
            elapsedBaseRef.current = planSec;
            setElapsed(planSec);
            setRunning(false);
            setDone(true);
            playAlarm();
            return true;
        }
        return false;
    }, [hasPlan, planSec]);

    const tick = useCallback(() => {
        const secs = currentElapsed();
        setElapsed(secs);
        fireIfExpired(secs);
    }, [fireIfExpired]);

    const start = () => {
        elapsedBaseRef.current = elapsed;
        startRef.current = Date.now();
        setRunning(true);
        setDone(false);
        tickRef.current = setInterval(tick, 250);
    };

    const pause = () => {
        const secs = currentElapsed();
        stopAll();
        elapsedBaseRef.current = secs;
        setElapsed(secs);
        setRunning(false);
    };

    const add15 = () => {
        if (!hasPlan) return;
        setPlanSec(p => p + 15);
        setDone(false);
    };

    const reset = () => {
        stopAll();
        elapsedBaseRef.current = 0;
        setElapsed(0);
        setRunning(false);
        setDone(false);
        setPlanSec(plan);
    };

    useEffect(() => stopAll, []);

    const remaining = hasPlan ? Math.max(0, planSec - elapsed) : 0;
    const shown = hasPlan ? remaining : elapsed;
    const pct = hasPlan && planSec > 0 ? Math.min(100, (elapsed / planSec) * 100) : 0;

    return (
        <div className={`border rounded-2xl p-4 ${done ? 'bg-butter/10 border-butter/40' : running ? 'bg-water/[0.06] border-water/30' : 'bg-foreground/[0.03] border-border'}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className={`text-3xl font-black tabular-nums ${done ? 'text-butter' : 'text-foreground'}`}>
                        {formatDurationSec(shown)}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        {done ? 'Time!' : hasPlan ? (running ? 'counting down' : elapsed > 0 ? 'paused' : `plan ${formatDurationSec(planSec)}`) : (running ? 'stopwatch' : 'stopwatch ready')}
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {!running && !done && (
                        <button onClick={start} className="px-4 py-2 rounded-lg bg-water text-primary-foreground text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-water/85 transition-colors">
                            <FiPlay size={13} /> {elapsed > 0 ? 'Resume' : 'Start set'}
                        </button>
                    )}
                    {running && (
                        <button onClick={pause} className="px-4 py-2 rounded-lg bg-foreground/5 text-muted-foreground text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-foreground/10 transition-colors">
                            <FiPause size={13} /> Pause
                        </button>
                    )}
                    {hasPlan && (running || done || elapsed > 0) && (
                        <button onClick={add15} className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-muted-foreground transition-colors" title="+15s"><FiPlus size={14} /></button>
                    )}
                    {(elapsed > 0 || done) && (
                        <button onClick={reset} className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-muted-foreground transition-colors" title="Reset"><FiRotateCcw size={14} /></button>
                    )}
                    <button
                        onClick={() => onLog(Math.max(1, currentElapsed()))}
                        disabled={busy || elapsed < 1}
                        className="px-4 py-2 rounded-lg bg-olive text-primary-foreground text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-olive/85 transition-colors"
                    >
                        Log set
                    </button>
                </div>
            </div>
            {hasPlan && (
                <div className="mt-3 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${done ? 'bg-butter' : 'bg-water'}`} style={{ width: `${pct}%` }} />
                </div>
            )}
        </div>
    );
}
