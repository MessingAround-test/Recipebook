// Gym hub — the weight-training space opened from Health → Exercise.
// Tabs: Workouts (start/resume), Plans (create/edit), History, Progress.
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { Dumbbell } from 'lucide-react';
import GymWorkoutsView from '../components/gym/GymWorkoutsView';
import GymPlansView from '../components/gym/GymPlansView';
import GymHistoryView from '../components/gym/GymHistoryView';
import GymProgressView from '../components/gym/GymProgressView';
import pageShell from '../styles/PageShell.module.css';

type ViewMode = 'workouts' | 'plans' | 'history' | 'progress';
const VALID_VIEWS: ViewMode[] = ['workouts', 'plans', 'history', 'progress'];

const TABS: [ViewMode, string][] = [
    ['workouts', 'workouts'],
    ['plans', 'plans'],
    ['history', 'history'],
    ['progress', 'progress'],
];

const authHeaders = () => ({
    'Content-Type': 'application/json',
    edgetoken: localStorage.getItem('Token') || '',
});

export default function GymPage() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<ViewMode>('workouts');
    const [plans, setPlans] = useState<any[]>([]);
    const [exercises, setExercises] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [lastPerformed, setLastPerformed] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [loadError, setLoadError] = useState('');

    // ?view= deep link (same pattern as dailyTracker)
    useEffect(() => {
        if (!router.isReady) return;
        const v = router.query.view as string;
        if (v && (VALID_VIEWS as string[]).includes(v)) setViewMode(v as ViewMode);
    }, [router.isReady, router.query.view]);

    const setView = (mode: ViewMode) => {
        setViewMode(mode);
        router.replace({ pathname: '/gym', query: mode !== 'workouts' ? { view: mode } : {} }, undefined, { shallow: true });
    };

    const refresh = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [plansRes, exRes, sessRes] = await Promise.all([
                fetch('/api/workoutPlans', { headers: authHeaders() }),
                fetch('/api/exercises', { headers: authHeaders() }),
                fetch('/api/workoutSessions?limit=100', { headers: authHeaders() }),
            ]);
            const [plansData, exData, sessData] = await Promise.all([plansRes.json(), exRes.json(), sessRes.json()]);
            if (!plansData.success) throw new Error(plansData.message || 'Failed to load plans');
            setPlans(plansData.plans || []);
            setExercises(exData.exercises || []);
            setSessions(sessData.sessions || []);

            const lp: Record<string, string> = {};
            (plansData.lastPerformed || []).forEach((row: any) => { lp[String(row._id)] = row.last_date; });
            setLastPerformed(lp);
        } catch (e: any) {
            setLoadError(e.message || 'Failed to load gym data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const startSession = async (payload: any): Promise<string | null> => {
        setBusy(true);
        try {
            const res = await fetch('/api/workoutSessions', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
            const data = await res.json();
            if (!data.success) { alert(data.message || 'Could not start workout'); return null; }
            return data.session._id;
        } finally {
            setBusy(false);
        }
    };

    const handleStartPlan = async (planId: string, date: string) => {
        const id = await startSession({ plan_id: planId, date });
        if (id) router.push(`/gym/session/${id}`);
    };

    const handleQuickStart = async (exerciseIds: string[], date: string) => {
        const id = await startSession({ exercise_ids: exerciseIds, date });
        if (id) router.push(`/gym/session/${id}`);
    };

    const handleCreateExercise = async (name: string) => {
        const res = await fetch('/api/exercises', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name }) });
        const data = await res.json();
        if (!data.success) { alert(data.message || 'Could not create exercise'); return null; }
        setExercises(prev => [...prev, data.exercise].sort((a, b) => a.name.localeCompare(b.name)));
        return data.exercise;
    };

    const handleSavePlan = async (payload: { id?: string; name: string; description: string; items: any[] }): Promise<boolean> => {
        setBusy(true);
        try {
            const res = await fetch(payload.id ? `/api/workoutPlans/${payload.id}` : '/api/workoutPlans', {
                method: payload.id ? 'PUT' : 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ name: payload.name, description: payload.description, items: payload.items }),
            });
            const data = await res.json();
            if (!data.success) { alert(data.message || 'Could not save plan'); return false; }
            await refresh();
            return true;
        } finally {
            setBusy(false);
        }
    };

    const handleDeletePlan = async (id: string) => {
        setBusy(true);
        try {
            const res = await fetch(`/api/workoutPlans/${id}`, { method: 'DELETE', headers: authHeaders() });
            const data = await res.json();
            if (!data.success) { alert(data.message || 'Could not delete plan'); return; }
            await refresh();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Layout title="Gym" description="Workout plans, logging & progress">
            <div className={`pb-24 md:pb-8 gym-page ${pageShell.shell}`}>
                <PageHeader
                    title="Gym"
                    subtitle="Plans · Logging · Progress"
                    icon={<Dumbbell size={18} />}
                    accent="olive"
                    className="mb-4"
                />

                {/* Tabs */}
                <div className="flex gap-1 bg-foreground/[0.05] p-1 rounded-xl border border-border mb-6 overflow-x-auto">
                    {TABS.map(([mode, label]) => (
                        <button
                            key={mode}
                            onClick={() => setView(mode)}
                            className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-h-[40px] ${viewMode === mode ? 'bg-olive text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-8 h-8 border-2 border-olive/30 border-t-olive rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading...</p>
                        </div>
                    </div>
                ) : loadError ? (
                    <div className="bg-card border border-border rounded-3xl p-8 text-center">
                        <p className="text-sm font-bold text-berry mb-4">{loadError}</p>
                        <button onClick={refresh} className="px-6 py-2.5 rounded-xl bg-olive text-primary-foreground text-[10px] font-black uppercase tracking-widest">Retry</button>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {viewMode === 'workouts' && (
                            <GymWorkoutsView
                                plans={plans}
                                sessions={sessions}
                                exercises={exercises}
                                lastPerformed={lastPerformed}
                                busy={busy}
                                onStartPlan={handleStartPlan}
                                onQuickStart={handleQuickStart}
                                onCreateExercise={handleCreateExercise}
                            />
                        )}
                        {viewMode === 'plans' && (
                            <GymPlansView
                                plans={plans}
                                exercises={exercises}
                                busy={busy}
                                onSavePlan={handleSavePlan}
                                onDeletePlan={handleDeletePlan}
                                onCreateExercise={handleCreateExercise}
                            />
                        )}
                        {viewMode === 'history' && <GymHistoryView sessions={sessions} />}
                        {viewMode === 'progress' && <GymProgressView exercises={exercises} />}
                    </div>
                )}
            </div>
        </Layout>
    );
}
