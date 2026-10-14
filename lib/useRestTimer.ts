// Rest-between-sets timer for the gym session runner. Countdown based on an
// absolute end time (same approach as the cooking timers) and rings the shared
// kitchen alarm when it hits zero. State is component-local — the session page
// owns it, so nothing leaks into localStorage.
import { useState, useRef, useEffect, useCallback } from 'react';
import { playAlarm, sendNotification } from './alarm';

export interface RestTimerApi {
    running: boolean;
    remaining: number;
    duration: number;
    finished: boolean;
    start: (seconds: number) => void;
    pause: () => void;
    resume: () => void;
    addSeconds: (seconds: number) => void;
    reset: () => void;
    dismiss: () => void;
}

export function useRestTimer(): RestTimerApi {
    const [running, setRunning] = useState(false);
    const [remaining, setRemaining] = useState(0);
    const [duration, setDuration] = useState(0);
    const [finished, setFinished] = useState(false);
    const endRef = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearTick = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const tick = useCallback(() => {
        if (endRef.current == null) return;
        const rem = Math.ceil((endRef.current - Date.now()) / 1000);
        if (rem <= 0) {
            setRemaining(0);
            setRunning(false);
            setFinished(true);
            endRef.current = null;
            clearTick();
            playAlarm();
            sendNotification('Rest over', 'Next set time — back to it!');
        } else {
            setRemaining(rem);
        }
    }, []);

    const start = useCallback((seconds: number) => {
        clearTick();
        const secs = Math.max(1, Math.floor(seconds));
        endRef.current = Date.now() + secs * 1000;
        setDuration(secs);
        setRemaining(secs);
        setRunning(true);
        setFinished(false);
        timerRef.current = setInterval(tick, 400);
    }, [tick]);

    const pause = useCallback(() => {
        if (endRef.current == null) return;
        clearTick();
        setRemaining(Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000)));
        setRunning(false);
    }, []);

    const resume = useCallback(() => {
        if (endRef.current == null || running) return;
        timerRef.current = setInterval(tick, 400);
        setRunning(true);
    }, [running, tick]);

    const addSeconds = useCallback((seconds: number) => {
        if (endRef.current == null) return;
        endRef.current += seconds * 1000;
        setDuration(d => Math.max(0, d + seconds));
        setRemaining(Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000)));
        setFinished(false);
    }, []);

    const reset = useCallback(() => {
        clearTick();
        endRef.current = null;
        setRunning(false);
        setRemaining(0);
        setDuration(0);
        setFinished(false);
    }, []);

    const dismiss = reset;

    useEffect(() => clearTick, []);

    return { running, remaining, duration, finished, start, pause, resume, addSeconds, reset, dismiss };
}
