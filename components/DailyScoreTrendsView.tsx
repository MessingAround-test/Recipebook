import React, { useState, useEffect, useMemo } from 'react';
import { FiChevronLeft, FiChevronRight, FiTrendingUp, FiMeh, FiSmile, FiFrown } from 'react-icons/fi';
import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
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
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const PERIOD_CONFIG = {
    week: { label: '7 Days', days: 7 },
    month: { label: '30 Days', days: 30 },
    year: { label: '1 Year', days: 365 },
};

export default function DailyScoreTrendsView() {
    const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [loading, setLoading] = useState(false);
    const [days, setDays] = useState<any[]>([]);

    const startDate = useMemo(() => {
        const d = new Date(endDate);
        d.setDate(d.getDate() - (PERIOD_CONFIG[period].days - 1));
        return d;
    }, [endDate, period]);

    const getLocalDateString = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    useEffect(() => {
        setLoading(true);
        const token = localStorage.getItem('Token');
        const startStr = getLocalDateString(startDate);
        const endStr = getLocalDateString(endDate);
        fetch(`/api/trends?startDate=${startStr}&endDate=${endStr}`, { headers: { edgetoken: token || '' } })
            .then(r => r.json())
            .then(data => { if (data.success) setDays(data.days || []); })
            .catch(e => console.error("Failed to load score trends", e))
            .finally(() => setLoading(false));
    }, [startDate, endDate]);

    const labels = days.map(d => {
        const [y, m, day] = d.date.split('-').map(Number);
        return new Date(y, m - 1, day).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    });

    const summary = useMemo(() => {
        const withScore = days.filter(d => d.score > 0);
        const avg = withScore.length ? Math.round(withScore.reduce((a, b) => a + b.score, 0) / withScore.length) : 0;
        const totalPos = days.reduce((a, b) => a + (b.positive || 0), 0);
        const totalNeg = days.reduce((a, b) => a + (b.negative || 0), 0);
        const totalNeu = days.reduce((a, b) => a + (b.neutral || 0), 0);
        return {
            avg,
            totalPos,
            totalNeg,
            totalNeu,
            scoredDays: withScore.length
        };
    }, [days]);

    const chartData = useMemo(() => ({
        labels,
        datasets: [
            {
                type: 'line' as const,
                label: 'Daily Score',
                data: days.map(d => d.score),
                borderColor: 'rgba(16, 185, 129, 1)',
                backgroundColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0.4,
                fill: false,
                yAxisID: 'yScore',
                order: 1,
            },
            {
                label: 'Positive',
                data: days.map(d => d.positive || 0),
                backgroundColor: 'rgba(16, 185, 129, 0.35)',
                yAxisID: 'yCount',
                stack: 'symptoms',
                order: 3,
            },
            {
                label: 'Neutral',
                data: days.map(d => d.neutral || 0),
                backgroundColor: 'rgba(234, 179, 8, 0.35)',
                yAxisID: 'yCount',
                stack: 'symptoms',
                order: 3,
            },
            {
                label: 'Negative',
                data: days.map(d => d.negative || 0),
                backgroundColor: 'rgba(244, 63, 94, 0.35)',
                yAxisID: 'yCount',
                stack: 'symptoms',
                order: 3,
            },
        ],
    }), [days, labels]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                labels: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10, weight: 'bold' as const } },
                usePointStyle: true,
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                titleFont: { size: 12, weight: 'bold' as const },
                bodyFont: { size: 11 },
                padding: 12,
                cornerRadius: 8,
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 9 } },
            },
            y: {
                position: 'left' as const,
                beginAtZero: true,
                suggestedMax: 100,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: 'rgba(16, 185, 129, 0.8)', font: { size: 9 }, callback: (v: any) => v + '%' },
                title: { display: true, text: 'Daily Score %', color: 'rgba(16, 185, 129, 0.8)', font: { size: 9, weight: 'bold' as const } },
            },
            yCount: {
                position: 'right' as const,
                beginAtZero: true,
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 9 } },
                title: { display: true, text: 'Symptom Count', color: 'rgba(255, 255, 255, 0.4)', font: { size: 9, weight: 'bold' as const } },
            },
        },
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
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

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Avg Daily Score</div>
                    <div className="text-2xl font-black text-emerald-400">{summary.avg}%</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><FiSmile size={12} className="text-emerald-400" /> Positive</div>
                    <div className="text-2xl font-black">{summary.totalPos}<span className="text-sm text-muted-foreground font-bold ml-1">days</span></div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><FiMeh size={12} className="text-amber-400" /> Neutral</div>
                    <div className="text-2xl font-black">{summary.totalNeu}<span className="text-sm text-muted-foreground font-bold ml-1">days</span></div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><FiFrown size={12} className="text-rose-400" /> Negative</div>
                    <div className="text-2xl font-black text-rose-400">{summary.totalNeg}<span className="text-sm text-muted-foreground font-bold ml-1">days</span></div>
                </div>
            </div>

            {/* Chart */}
            <div className="glass-card border-white/5 bg-black/20 p-6 min-h-[400px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Daily Score vs Symptoms</h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Score overlaid with symptom counts</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                        <FiTrendingUp size={14} className="text-emerald-500" />
                        Scored {summary.scoredDays} days
                    </div>
                </div>
                <div className="flex-1 w-full min-h-[300px]">
                    <Bar data={chartData as any} options={chartOptions as any} />
                </div>
            </div>
        </div>
    );
}