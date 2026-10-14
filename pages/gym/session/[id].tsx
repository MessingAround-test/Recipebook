// Active workout runner: START flow for a plan or quick-start selection.
// Per-set logging (reps / failure / timed), last-time reference, rest timer
// and a history slide-over per exercise. Sets save server-side as you go, so
// the session is resumable.
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Layout } from '../../../components/Layout';
import { FiArrowLeft, FiCheck, FiX, FiClock, FiTrendingUp } from 'react-icons/fi';
import SetLogger from '../../../components/gym/SetLogger';
import RestTimer from '../../../components/gym/RestTimer';
import { useRestTimer } from '../../../lib/useRestTimer';
import { formatSetDisplay, formatDurationSec, totalVolume, totalTimedSeconds, RepMode } from '../../../lib/gym';

const authHeaders = () => ({
    'Content-Type': 'application/json',
    edgetoken: localStorage.getItem('Token') || '',
});

function useElapsed(startedAt: string | null): number {
    const [, force] = useState(0);
    useEffect(() => {
        if (!startedAt) return;
        const t = setInterval(() => force(n => n + 1), 1000);
        return () => clearInterval(t);
    }, [startedAt]);
    if (!startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

export default function GymSessionPage() {
    const router = useRouter();
    const { id } = router.query;
    const sessionId = typeof id === 'string' ? id : '';

    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [exIndex, setExIndex] = useState(0);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [exerciseHistory, setExerciseHistory] = useState<any[]>([]);
    const restTimer = useRestTimer();
    const elapsed = useElapsed(session?.started_at || null);

    const load = useCallback(async () => {
        if (!sessionId) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/workoutSessions/${sessionId}`, { headers: authHeaders() });
            const data = await res.json();
            if (!data.success) { setError(data.message || 'Session not found'); return; }
            if (data.session.status !== 'active') {
                router.replace(`/gym/history/${sessionId}`);
                return;
            }
            setSession(data.session);
        } catch (e: any) {
            setError(e.message || 'Failed to load session');
        } finally {
            setLoading(false);
        }
    }, [sessionId, router]);

    useEffect(() => { load(); }, [load]);

    const put = async (body: any): Promise<any> => {
        setBusy(true);
        try {
            const res = await fetch(`/api/workoutSessions/${sessionId}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
            const data = await res.json();
            if (!data.success) { alert(data.message || 'Update failed'); return null; }
            setSession(data.session);
            return data.session;
        } finally {
            setBusy(false);
        }
    };

    const handleLogSet = async (payload: any) => {
        const updated = await put({ action: 'logSet', exercise_index: exIndex, set: payload });
        if (updated) {
            restTimer.start(90);
            // If that was the last set, jump to the next exercise with sets remaining.
            const ex = updated.exercises[exIndex];
            if (ex && ex.sets.length >= ex.target_sets) {
                const nextIdx = updated.exercises.findIndex((e: any, i: number) => i > exIndex && e.sets.length < e.target_sets);
                if (nextIdx >= 0) setExIndex(nextIdx);
            }
        }
    };

    const handleRemoveSet = async (setNumber: number) => {
        await put({ action: 'removeSet', exercise_index: exIndex, set_number: setNumber });
    };

    const handleUpdateTarget = async (patch: any) => {
        await put({ action: 'updateExercise', exercise_index: exIndex, patch });
    };

    const handleFinish = async () => {
        if (!confirm('Finish this workout? Logged sets are saved to history.')) return;
        const updated = await put({ action: 'complete' });
        if (updated) router.push('/gym?view=history');
    };

    const handleAbandon = async () => {
        if (!confirm('Abandon this workout? It will not appear in history.')) return;
        const updated = await put({ action: 'abandon' });
        if (updated) router.push('/gym');
    };

    const openExerciseHistory = async () => {
        const ex = session?.exercises?.[exIndex];
        if (!ex) return;
        setHistoryOpen(true);
        setExerciseHistory([]);
        const token = localStorage.getItem('Token');
        const res = await fetch(`/api/workoutSessions?exerciseId=${ex.exercise_id}&status=completed&limit=5`, { headers: { edgetoken: token || '' } });
        const data = await res.json();
        if (data.success) setExerciseHistory(data.sessions || []);
    };

    if (loading) {
        return (
            <Layout title="Workout" description="Active session">
                <div className="flex items-center justify-center py-32">
                    <div className="w-8 h-8 border-2 border-olive/30 border-t-olive rounded-full animate-spin" />
                </div>
            </Layout>
        );
    }

    if (error || !session) {
        return (
            <Layout title="Workout" description="Active session">
                <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-md mx-auto mt-12">
                    <p className="text-sm font-bold text-berry mb-4">{error || 'Session not found'}</p>
                    <button onClick={() => router.push('/gym')} className="px-6 py-2.5 rounded-xl bg-olive text-primary-foreground text-[10px] font-black uppercase tracking-widest">Back to gym</button>
                </div>
            </Layout>
        );
    }

    const exercises = session.exercises || [];
    const current = exercises[Math.min(exIndex, exercises.length - 1)];
    const totalSets = exercises.reduce((a: number, e: any) => a + e.sets.length, 0);
    const vol = totalVolume(exercises.flatMap((e: any) => e.sets));
    const timed = totalTimedSeconds(exercises.flatMap((e: any) => e.sets));
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');

    return (
        <Layout title={session.plan_name_snapshot || 'Workout'} description="Active session">
            <div className="pb-28 md:pb-10 max-w-3xl mx-auto gym-page">
                {/* Sticky header */}
                <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md -mx-4 px-4 py-3 mb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/gym')} className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground"><FiArrowLeft size={18} /></button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-sm font-black text-foreground truncate">{session.plan_name_snapshot || 'Quick workout'}</h1>
                            <div className="flex flex-wrap items-center gap-x-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                <span className="tabular-nums flex items-center gap-1"><FiClock size={10} /> {mm}:{ss}</span>
                                <span>{session.date}</span>
                                <span>{totalSets} sets</span>
                                {vol > 0 && <span className="text-olive">{vol.toLocaleString()} kg vol</span>}
                                {timed > 0 && <span className="text-water">{formatDurationSec(timed)}</span>}
                            </div>
                        </div>
                        <button onClick={handleFinish} disabled={busy} className="px-5 py-2.5 rounded-xl bg-olive text-primary-foreground text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40 hover:bg-olive/85 transition-colors">
                            <FiCheck size={14} /> Finish
                        </button>
                        <button onClick={handleAbandon} disabled={busy} className="p-2.5 rounded-xl bg-foreground/5 hover:bg-berry/10 text-muted-foreground hover:text-berry disabled:opacity-40"><FiX size={16} /></button>
                    </div>
                </div>

                {/* Exercise chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
                    {exercises.map((ex: any, i: number) => {
                        const done = ex.sets.length >= ex.target_sets;
                        return (
                            <button
                                key={i}
                                onClick={() => setExIndex(i)}
                                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${i === exIndex ? 'bg-olive text-primary-foreground border-olive' : done ? 'bg-olive/10 text-olive border-olive/30' : 'bg-foreground/5 text-muted-foreground border-transparent hover:bg-foreground/10'}`}
                            >
                                {ex.name_snapshot}
                                <span className="ml-1.5 opacity-70">{ex.sets.length}/{ex.target_sets}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Current exercise */}
                {current && (
                    <SetLogger
                        exercise={current}
                        exerciseIndex={exIndex}
                        totalExercises={exercises.length}
                        busy={busy}
                        onLogSet={handleLogSet}
                        onRemoveSet={handleRemoveSet}
                        onUpdateTarget={handleUpdateTarget}
                        onPrev={() => setExIndex(i => Math.max(0, i - 1))}
                        onNext={() => setExIndex(i => Math.min(exercises.length - 1, i + 1))}
                        onFinish={handleFinish}
                        onOpenHistory={openExerciseHistory}
                    />
                )}

                {/* Rest timer */}
                <div className="mt-4">
                    <RestTimer timer={restTimer} />
                </div>

                <button onClick={handleAbandon} className="mt-6 w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-berry transition-colors py-2">
                    Abandon workout
                </button>
            </div>

            {/* History slide-over */}
            {historyOpen && current && (
                <div className="fixed inset-0 z-40 flex justify-end">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
                    <div className="relative w-full md:max-w-md bg-card border-l border-border h-full overflow-y-auto p-5 md:p-6 animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2"><FiTrendingUp size={14} className="text-olive" /> {current.name_snapshot}</h3>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Recent sessions</p>
                            </div>
                            <button onClick={() => setHistoryOpen(false)} className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground"><FiX size={16} /></button>
                        </div>
                        {!exerciseHistory.length ? (
                            <p className="text-sm text-muted-foreground">No completed sessions for this exercise yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {exerciseHistory.map((s: any) => {
                                    const ex = (s.exercises || []).find((e: any) => String(e.exercise_id) === String(current.exercise_id));
                                    const sets = ex?.sets || [];
                                    return (
                                        <button
                                            key={s._id}
                                            onClick={() => router.push(`/gym/history/${s._id}`)}
                                            className="w-full text-left bg-foreground/[0.03] border border-border rounded-2xl p-4 hover:border-olive/40 transition-colors"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.date}</span>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-olive">View →</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {sets.filter((x: any) => x.actual_reps || x.actual_duration_sec).map((x: any, i: number) => (
                                                    <span key={i} className={`px-2 py-0.5 rounded-md bg-foreground/5 text-[11px] font-bold tabular-nums ${x.is_failure ? 'text-butter' : 'text-foreground'}`}>
                                                        {formatSetDisplay(x)}
                                                    </span>
                                                ))}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Layout>
    );
}
