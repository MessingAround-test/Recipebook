import React, { useState, useEffect, useMemo } from 'react';
import { calculateWeightProjection, DailyIntakeTargets } from '../lib/dailyIntake';
import { FiChevronLeft, FiChevronRight, FiCalendar, FiTrendingDown, FiTrendingUp, FiTarget, FiActivity } from 'react-icons/fi';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const PERIOD_CONFIG = {
    week:  { label: '7 Days', days: 7 },
    month: { label: '30 Days', days: 30 },
    year:  { label: '1 Year', days: 365 },
};

export default function WeightTrendsView() {
    const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [loading, setLoading] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [targets, setTargets] = useState<any>(null);
    const [dailyLogs, setDailyLogs] = useState<any[]>([]);

    const startDate = useMemo(() => {
        const d = new Date(endDate);
        d.setDate(d.getDate() - (PERIOD_CONFIG[period].days - 1));
        return d;
    }, [endDate, period]);

    const getLocalDateString = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    useEffect(() => {
        const token = localStorage.getItem('Token');
        if (!token) return;
        fetch('/api/dailyIntake', { headers: { edgetoken: token } })
            .then(r => r.json())
            .then(data => { 
                if (data.success) {
                    setTargets(data.targets);
                    setUserProfile(data.profile);
                }
            });
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const token = localStorage.getItem('Token');
            const startStr = getLocalDateString(startDate);
            const endStr = getLocalDateString(endDate);
            try {
                const res = await fetch(`/api/dailyLog/range?startDate=${startStr}&endDate=${endStr}`, { headers: { edgetoken: token || '' } });
                const data = await res.json();
                if (data.success) {
                    setDailyLogs(data.logs || []);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [startDate, endDate]);

    const chartData = useMemo(() => {
        if (!userProfile || !targets) return null;

        const initialWeight = userProfile.weight_kg;
        const targetWeight = userProfile.target_weight_kg;
        const weeklyGoalRate = userProfile.weekly_goal_kg || 0;
        
        const labels: string[] = [];
        const actualData: (number | null)[] = [];
        const projectedData: number[] = [];
        
        const logsByDate = dailyLogs.reduce((acc, log) => {
            acc[log.date] = log;
            return acc;
        }, {} as any);

        let cumulativeDeficit = 0;
        const iter = new Date(startDate);
        while (iter <= endDate) {
            const dStr = getLocalDateString(iter);
            labels.push(iter.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }));
            
            const log = logsByDate[dStr];
            const intake = (log?.items || []).reduce((acc: number, item: any) => acc + (item.nutrients?.energy_kcal || 0), 0);
            const exercise = log?.exercise_kcal || 0;
            const weightEntry = log?.weight_kg || null;
            
            if (intake > 0) {
                const dailyDeficit = (targets.energy_kcal + exercise) - intake;
                cumulativeDeficit += dailyDeficit;
            }
            
            projectedData.push(Number(calculateWeightProjection(initialWeight, cumulativeDeficit).toFixed(2)));
            actualData.push(weightEntry);
            
            iter.setDate(iter.getDate() + 1);
        }

        const currentProjected = projectedData[projectedData.length - 1];
        const weightToGoal = targetWeight ? targetWeight - currentProjected : 0;
        const dailyAdjustment = targetWeight ? ((weeklyGoalRate / 7) * 7700 - (cumulativeDeficit / Math.max(dailyLogs.length, 1))) : 0;
        const estWeeks = (weeklyGoalRate !== 0 && weightToGoal !== 0) ? Math.abs(weightToGoal / weeklyGoalRate) : 0;

        return {
            labels,
            datasets: [
                {
                    label: 'Projected Weight',
                    data: projectedData,
                    borderColor: 'rgba(16, 185, 129, 1)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: true,
                },
                {
                    label: 'Actual Weight',
                    data: actualData,
                    borderColor: 'rgba(245, 158, 11, 1)',
                    backgroundColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 0,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    showLine: false, // Scatter-like for actual weigh-ins
                },
                {
                    label: 'Target Weight',
                    data: labels.map(() => targetWeight),
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderDash: [5, 5],
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                }
            ],
            summary: {
                currentProjected,
                weightToGoal,
                dailyAdjustment,
                estWeeks,
                targetWeight,
                initialWeight,
                cumulativeDeficit
            }
        };
    }, [dailyLogs, userProfile, targets, startDate, endDate]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: { size: 12, weight: 'bold' as const },
                bodyFont: { size: 11 },
                padding: 12,
                cornerRadius: 8,
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 9 } }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 9 } }
            }
        },
    };

    return (
        <div className="space-y-6">
            {/* Header / Periods */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-white/5 shadow-inner">
                    {(['week', 'month', 'year'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${period === p ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            {PERIOD_CONFIG[p].label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-0.5 border border-white/5">
                    <button onClick={() => setEndDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground"><FiChevronLeft size={14} /></button>
                    <div className="px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - {endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                    <button onClick={() => setEndDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground"><FiChevronRight size={14} /></button>
                </div>
            </div>

            {chartData && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Projection Card */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="glass-card border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden h-full flex flex-col justify-between">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                {chartData.summary.weightToGoal <= 0 ? <FiTrendingDown size={120} /> : <FiTrendingUp size={120} />}
                            </div>
                            
                            <div className="relative z-10">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">Current Projection</div>
                                <h3 className="text-3xl font-black mb-1">
                                    {chartData.summary.currentProjected.toFixed(1)} <span className="text-sm font-bold text-muted-foreground">kg</span>
                                </h3>
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="text-[10px] font-bold text-muted-foreground">Initial: {chartData.summary.initialWeight}kg</span>
                                    <div className="w-1 h-1 rounded-full bg-white/20" />
                                    <span className={`text-[10px] font-black ${chartData.summary.currentProjected < chartData.summary.initialWeight ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {chartData.summary.currentProjected < chartData.summary.initialWeight ? '-' : '+'}
                                        {Math.abs(chartData.summary.currentProjected - chartData.summary.initialWeight).toFixed(1)}kg
                                    </span>
                                </div>

                                {chartData.summary.targetWeight > 0 && (
                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-4">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            <span>Progress to {chartData.summary.targetWeight}kg</span>
                                            <span className="text-white">{Math.abs(chartData.summary.weightToGoal).toFixed(1)}kg left</span>
                                        </div>
                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                            {(() => {
                                                const totalNeeded = Math.abs(chartData.summary.initialWeight - chartData.summary.targetWeight);
                                                const current = Math.abs(chartData.summary.initialWeight - chartData.summary.currentProjected);
                                                const progress = totalNeeded > 0 ? (current / totalNeeded) * 100 : 0;
                                                return <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${Math.min(progress, 100)}%` }} />;
                                            })()}
                                        </div>
                                        
                                        <div className="space-y-2 pt-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Target Adjustment</span>
                                                <span className={`text-[11px] font-black ${chartData.summary.dailyAdjustment >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    Eat {Math.abs(Math.round(chartData.summary.dailyAdjustment))} kcal {chartData.summary.dailyAdjustment >= 0 ? 'more' : 'less'}
                                                </span>
                                            </div>
                                            {chartData.summary.estWeeks > 0 && (
                                                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Est. Completion</span>
                                                    <span className="text-[11px] font-black text-white">{Math.ceil(chartData.summary.estWeeks)} weeks</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex items-center gap-3 relative z-10">
                                <div className="p-2 rounded-lg bg-white/5 flex items-center gap-2">
                                    <FiActivity className="text-emerald-500" size={14} />
                                    <span className="text-[10px] font-bold text-white">{Math.round(chartData.summary.cumulativeDeficit).toLocaleString()} kcal deficit</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: The Graph */}
                    <div className="lg:col-span-2 glass-card border-white/5 bg-black/20 p-6 min-h-[400px] flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-white">Weight Trend</h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Actual vs Projected</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-1 bg-emerald-500 rounded-full" />
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Projected</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Actual</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex-1 w-full min-h-[300px]">
                            <Line data={chartData} options={chartOptions} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
