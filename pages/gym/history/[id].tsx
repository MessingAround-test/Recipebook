// Session detail from History: planned vs achieved per exercise, PR badges,
// totals and an editable session date (for fixing back-dated logs).
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Layout } from '../../../components/Layout';
import { PageHeader } from '../../../components/PageHeader';
import { FiArrowLeft, FiSave, FiTrash2, FiCalendar, FiAward } from 'react-icons/fi';
import {
    formatPlanTarget, formatSetDisplay, formatDurationSec, totalVolume, totalTimedSeconds,
    estimateE1RM, topWeight, bestE1RM, topDuration, todayLocalISO, validateSessionDate
} from '../../../lib/gym';
import pageShell from '../../../styles/PageShell.module.css';

const authHeaders = () => ({
    'Content-Type': 'application/json',
    edgetoken: localStorage.getItem('Token') || '',
});

export default function GymSessionHistoryPage() {
    const router = useRouter();
    const { id } = router.query;
    const sessionId = typeof id === 'string' ? id : '';

    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dateDraft, setDateDraft] = useState('');
    const [savingDate, setSavingDate] = useState(false);
    const [dateMsg, setDateMsg] = useState('');

    const load = useCallback(async () => {
        if (!sessionId) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/workoutSessions/${sessionId}`, { headers: authHeaders() });
            const data = await res.json();
            if (!data.success) { setError(data.message || 'Session not found'); return; }
            if (data.session.status === 'active') { router.replace(`/gym/session/${sessionId}`); return; }
            setSession(data.session);
            setDateDraft(data.session.date);
        } catch (e: any) {
            setError(e.message || 'Failed to load session');
        } finally {
            setLoading(false);
        }
    }, [sessionId, router]);

    useEffect(() => { load(); }, [load]);

    const saveDate = async () => {
        const err = validateSessionDate(dateDraft);
        if (err) { setDateMsg(err); return; }
        setSavingDate(true);
        setDateMsg('');
        try {
            const res = await fetch(`/api/workoutSessions/${sessionId}`, {
                method: 'PUT', headers: authHeaders(), body: JSON.stringify({ date: dateDraft })
            });
            const data = await res.json();
            if (!data.success) { setDateMsg(data.message || 'Failed to update date'); return; }
            setSession(data.session);
            setDateMsg('Date updated');
        } finally {
            setSavingDate(false);
        }
    };

    const deleteSession = async () => {
        if (!confirm('Delete this session permanently?')) return;
        const res = await fetch(`/api/workoutSessions/${sessionId}`, { method: 'DELETE', headers: authHeaders() });
        const data = await res.json();
        if (data.success) router.push('/gym?view=history');
        else alert(data.message || 'Delete failed');
    };

    if (loading) {
        return (
            <Layout title="Session" description="Workout detail">
                <div className="flex items-center justify-center py-32">
                    <div className="w-8 h-8 border-2 border-olive/30 border-t-olive rounded-full animate-spin" />
                </div>
            </Layout>
        );
    }

    if (error || !session) {
        return (
            <Layout title="Session" description="Workout detail">
                <div className="bg-card border border-border rounded-3xl p-8 text-center max-w-md mx-auto mt-12">
                    <p className="text-sm font-bold text-berry mb-4">{error || 'Session not found'}</p>
                    <button onClick={() => router.push('/gym?view=history')} className="px-6 py-2.5 rounded-xl bg-olive text-primary-foreground text-[10px] font-black uppercase tracking-widest">Back to history</button>
                </div>
            </Layout>
        );
    }

    const allSets = (session.exercises || []).flatMap((e: any) => e.sets || []);
    const vol = totalVolume(allSets);
    const timed = totalTimedSeconds(allSets);
    const durationMin = session.started_at && session.completed_at
        ? Math.max(1, Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000))
        : null;

    return (
        <Layout title={session.plan_name_snapshot || 'Session'} description="Workout detail">
            <div className={`pb-24 md:pb-8 gym-page ${pageShell.shell} max-w-3xl mx-auto`}>
                <PageHeader
                    title={session.plan_name_snapshot || 'Quick workout'}
                    subtitle={`${session.date} · ${session.status}`}
                    icon={<FiCalendar size={18} />}
                    accent="olive"
                    actions={
                        <button onClick={() => router.push('/gym?view=history')} className="px-4 py-2 rounded-xl bg-foreground/5 text-muted-foreground text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-foreground/10">
                            <FiArrowLeft size={13} /> History
                        </button>
                    }
                />

                {/* Date editor + totals */}
                <div className="bg-card border border-border rounded-3xl p-5 shadow-sm mb-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Session date</label>
                            <input
                                type="date" value={dateDraft} max={todayLocalISO()}
                                onChange={e => { setDateDraft(e.target.value); setDateMsg(''); }}
                                className="bg-input border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-foreground"
                            />
                        </div>
                        {dateDraft !== session.date && (
                            <button onClick={saveDate} disabled={savingDate} className="px-5 py-2.5 rounded-xl bg-olive text-primary-foreground text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40">
                                <FiSave size={13} /> {savingDate ? 'Saving...' : 'Save date'}
                            </button>
                        )}
                        {dateMsg && <span className={`text-[10px] font-black uppercase tracking-widest ${dateMsg === 'Date updated' ? 'text-olive' : 'text-berry'}`}>{dateMsg}</span>}
                        <div className="ml-auto flex items-center gap-4 text-right">
                            <div>
                                <div className="text-xl font-black text-foreground">{vol > 0 ? `${vol.toLocaleString()} kg` : '—'}</div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Volume</div>
                            </div>
                            {timed > 0 && (
                                <div>
                                    <div className="text-xl font-black text-water">{formatDurationSec(timed)}</div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Timed</div>
                                </div>
                            )}
                            {durationMin != null && (
                                <div>
                                    <div className="text-xl font-black">{durationMin} min</div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Duration</div>
                                </div>
                            )}
                            {!!session.estimated_kcal && (
                                <div>
                                    <div className="text-xl font-black text-butter">~{session.estimated_kcal}</div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Est. kcal</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Per-exercise planned vs achieved */}
                <div className="space-y-3">
                    {(session.exercises || []).map((ex: any, i: number) => {
                        const doneSets = (ex.sets || []).filter((s: any) => s.actual_reps || s.actual_duration_sec);
                        const tw = topWeight(doneSets);
                        const be = bestE1RM(doneSets);
                        const td = topDuration(doneSets);
                        return (
                            <div key={i} className="bg-card border border-border rounded-3xl p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <h3 className="text-base font-black text-foreground">{ex.name_snapshot}</h3>
                                        <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-olive/10 text-olive text-[9px] font-black uppercase tracking-widest">Planned: {formatPlanTarget(ex)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {be > 0 && <span className="px-2 py-1 rounded-lg bg-butter/10 text-butter text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><FiAward size={11} /> {be} kg e1RM</span>}
                                        {td > 0 && <span className="px-2 py-1 rounded-lg bg-water/10 text-water text-[9px] font-black uppercase tracking-widest">{formatDurationSec(td)}</span>}
                                        {tw > 0 && <span className="px-2 py-1 rounded-lg bg-foreground/5 text-muted-foreground text-[9px] font-black uppercase tracking-widest">top {tw} kg</span>}
                                    </div>
                                </div>
                                {doneSets.length === 0 ? (
                                    <p className="text-xs text-muted-foreground font-bold">No sets logged for this exercise.</p>
                                ) : (
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                                <th className="text-left py-1.5">Set</th>
                                                <th className="text-left py-1.5">Planned</th>
                                                <th className="text-left py-1.5">Achieved</th>
                                                <th className="text-right py-1.5">e1RM</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...ex.sets].sort((a: any, b: any) => a.set_number - b.set_number).map((s: any) => {
                                                const planned = s.planned_duration_sec
                                                    ? formatDurationSec(s.planned_duration_sec)
                                                    : s.planned_reps ? `${s.planned_reps} reps` : formatPlanTarget(ex).split(' × ').slice(1).join(' × ') || '—';
                                                const e1 = s.actual_reps && s.actual_weight_kg ? estimateE1RM(s.actual_weight_kg, s.actual_reps) : 0;
                                                const achieved = formatSetDisplay(s);
                                                const met = s.planned_reps != null && s.actual_reps != null && s.actual_reps >= s.planned_reps && !s.is_failure;
                                                return (
                                                    <tr key={s.set_number} className="border-t border-border/50">
                                                        <td className="py-2 font-black tabular-nums text-muted-foreground">{s.set_number}</td>
                                                        <td className="py-2 font-bold text-muted-foreground">{planned}</td>
                                                        <td className={`py-2 font-bold tabular-nums ${s.is_failure ? 'text-butter' : met ? 'text-olive' : 'text-foreground'}`}>
                                                            {achieved} {met && '✓'} {s.is_failure && '⚠'}
                                                        </td>
                                                        <td className="py-2 text-right tabular-nums text-muted-foreground">{e1 > 0 ? `${e1} kg` : '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={deleteSession} className="px-5 py-2.5 rounded-xl bg-foreground/5 text-muted-foreground text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-berry/10 hover:text-berry transition-colors">
                        <FiTrash2 size={13} /> Delete session
                    </button>
                </div>
            </div>
        </Layout>
    );
}
