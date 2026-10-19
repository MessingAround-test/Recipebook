// Progress tab: pick an exercise and chart its progression over time — top
// weight, estimated 1RM, volume, or (for timed work) duration metrics. Only
// exercises with logged records are listed; duration metrics/cards are hidden
// when the exercise has no timed data.
import React, { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { FiTrendingUp, FiAward, FiActivity } from 'react-icons/fi';
import { formatDurationSec } from '../../lib/gym';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface ExerciseDoc { _id: string; name: string; muscle_group?: string; }

type Metric = 'top_weight_kg' | 'best_e1rm' | 'volume_kg' | 'top_duration_sec' | 'total_duration_sec';

const METRIC_LABELS: Record<Metric, string> = {
    top_weight_kg: 'Top weight',
    best_e1rm: 'Est. 1RM',
    volume_kg: 'Volume',
    top_duration_sec: 'Longest set',
    total_duration_sec: 'Total time',
};

const DURATION_METRICS: Metric[] = ['top_duration_sec', 'total_duration_sec'];

const isDurationMetric = (m: Metric) => m === 'top_duration_sec' || m === 'total_duration_sec';

export default function GymProgressView({ exercises }: { exercises: ExerciseDoc[] }) {
    const [exerciseId, setExerciseId] = useState('');
    const [metric, setMetric] = useState<Metric>('top_weight_kg');
    const [points, setPoints] = useState<any[]>([]);
    const [prs, setPrs] = useState<any>(null);
    const [exercise, setExercise] = useState<ExerciseDoc | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recordedIds, setRecordedIds] = useState<string[] | null>(null);

    // Which exercises actually have logged records (incl. custom ones).
    useEffect(() => {
        const token = localStorage.getItem('Token');
        fetch('/api/workoutStats?withData=1', { headers: { edgetoken: token || '' } })
            .then(r => r.json())
            .then(data => { if (data.success) setRecordedIds(data.exerciseIds || []); })
            .catch(() => setRecordedIds([]));
    }, []);

    const recordedExercises = useMemo(() => {
        if (recordedIds == null) return exercises;
        const set = new Set(recordedIds);
        return exercises.filter(e => set.has(e._id));
    }, [exercises, recordedIds]);

    const hasTimed = points.some(p => p.top_duration_sec > 0);
    const hasWeightData = points.some(p => p.top_weight_kg > 0 || p.best_e1rm > 0);

    // Default selection: first exercise with records.
    useEffect(() => {
        if (!exerciseId && recordedExercises.length) setExerciseId(recordedExercises[0]._id);
    }, [recordedExercises, exerciseId]);

    useEffect(() => {
        if (!exerciseId) return;
        setLoading(true);
        setError('');
        const token = localStorage.getItem('Token');
        fetch(`/api/workoutStats?exerciseId=${exerciseId}`, { headers: { edgetoken: token || '' } })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setPoints(data.points || []);
                    setPrs(data.prs || null);
                    setExercise(data.exercise || null);
                    // Sensible default metric for purely timed exercises; hide
                    // duration metrics when there's no timed data to chart.
                    const pts = data.points || [];
                    const timed = pts.some((p: any) => p.top_duration_sec > 0);
                    const weighted = pts.some((p: any) => p.top_weight_kg > 0);
                    if (timed && !weighted) setMetric('top_duration_sec');
                    else setMetric(m => (isDurationMetric(m) && !timed ? 'top_weight_kg' : m));
                } else {
                    setError(data.message || 'Failed to load stats');
                }
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [exerciseId]);

    const visibleMetrics = (Object.keys(METRIC_LABELS) as Metric[]).filter(m =>
        !isDurationMetric(m) || hasTimed
    );

    const chartData = useMemo(() => ({
        labels: points.map(p => {
            const [y, m, d] = p.date.split('-').map(Number);
            return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
        }),
        datasets: [{
            label: METRIC_LABELS[metric],
            data: points.map(p => p[metric]),
            borderColor: 'rgba(124, 143, 79, 1)',
            backgroundColor: 'rgba(124, 143, 79, 0.12)',
            borderWidth: 3,
            pointRadius: 3,
            pointHoverRadius: 6,
            tension: 0.35,
            fill: true,
        }],
    }), [points, metric]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.85)',
                titleFont: { size: 12, weight: 'bold' as const },
                bodyFont: { size: 11 },
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (item: any) => {
                        const v = item.parsed.y;
                        return isDurationMetric(metric) ? formatDurationSec(v) : `${v} kg`;
                    },
                },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 } } },
            y: {
                beginAtZero: false,
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    color: 'rgba(255,255,255,0.4)',
                    font: { size: 9 },
                    callback: (v: any) => isDurationMetric(metric) ? formatDurationSec(v) : v,
                },
            },
        },
    };

    if (!exercises.length) {
        return <p className="text-sm text-muted-foreground bg-card border border-border rounded-2xl p-6 text-center">No exercises yet — start a workout first.</p>;
    }

    if (recordedIds != null && !recordedExercises.length) {
        return <p className="text-sm text-muted-foreground bg-card border border-border rounded-2xl p-6 text-center">No completed workouts with logged sets yet — finish a workout to see progress.</p>;
    }

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
                <select value={exerciseId} onChange={e => setExerciseId(e.target.value)} className="bg-card border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-foreground min-w-[220px]">
                    {recordedExercises.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                </select>
                <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-border">
                    {visibleMetrics.map(m => (
                        <button key={m} onClick={() => setMetric(m)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${metric === m ? 'bg-olive text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            {METRIC_LABELS[m]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary cards */}
            {prs && (
                <div className={`grid gap-3 ${hasTimed ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    <div className="bg-foreground/5 border border-border rounded-2xl p-4">
                        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><FiAward size={11} /> Top weight</div>
                        <div className="text-2xl font-black text-olive">{hasWeightData && prs.top_weight_kg > 0 ? `${prs.top_weight_kg} kg` : '—'}</div>
                    </div>
                    <div className="bg-foreground/5 border border-border rounded-2xl p-4">
                        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><FiTrendingUp size={11} /> Best est. 1RM</div>
                        <div className="text-2xl font-black">{prs.best_e1rm > 0 ? `${prs.best_e1rm} kg` : '—'}</div>
                    </div>
                    {hasTimed && (
                        <div className="bg-foreground/5 border border-border rounded-2xl p-4">
                            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Longest set</div>
                            <div className="text-2xl font-black text-water">{prs.top_duration_sec > 0 ? formatDurationSec(prs.top_duration_sec) : '—'}</div>
                        </div>
                    )}
                    <div className="bg-foreground/5 border border-border rounded-2xl p-4">
                        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><FiActivity size={11} /> Sessions</div>
                        <div className="text-2xl font-black">{points.length}</div>
                    </div>
                </div>
            )}

            {/* Chart */}
            <div className="glass-card border-border bg-black/20 p-6 min-h-[380px] flex flex-col">
                <div className="mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground">{exercise?.name || 'Exercise'} — {METRIC_LABELS[metric]}</h3>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Completed sessions over time</p>
                </div>
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-7 h-7 border-2 border-olive/30 border-t-olive rounded-full animate-spin" />
                    </div>
                ) : error ? (
                    <p className="text-sm text-berry">{error}</p>
                ) : !points.length ? (
                    <p className="text-sm text-muted-foreground">No completed sets for this exercise yet.</p>
                ) : (
                    <div className="flex-1 w-full min-h-[280px]">
                        <Line data={chartData as any} options={chartOptions as any} />
                    </div>
                )}
            </div>
        </div>
    );
}
