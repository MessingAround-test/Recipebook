import React, { useState, useEffect, useMemo } from 'react';
import { NUTRIENT_LABELS, DailyIntakeTargets } from '../lib/dailyIntake';
import { NUTRIENT_INSIGHTS } from '../lib/nutrientInsights';
import CorrelationInsightsView from './CorrelationInsightsView';
import { FiChevronLeft, FiChevronRight, FiAlertTriangle, FiCalendar, FiChevronDown, FiChevronUp, FiPlus, FiZap, FiActivity } from 'react-icons/fi';

const PERIOD_CONFIG = {
    today: { label: 'Today', days: 1 },
    week:  { label: '7 Days', days: 7 },
    month: { label: '30 Days', days: 30 },
};

export default function InsightsView({ onLogFood, endDateProp }: { onLogFood: (name: string) => void, endDateProp?: Date }) {
    const [view, setView] = useState<'deficiencies' | 'correlations'>('deficiencies');
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [dataState, setDataState] = useState<{ totals: any, activeDays: number }>({ totals: {}, activeDays: 1 });
    const [targets, setTargets] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [expandedNutrient, setExpandedNutrient] = useState<string | null>(null);

    const startDate = useMemo(() => {
        const d = new Date(endDate);
        d.setDate(d.getDate() - (PERIOD_CONFIG[period].days - 1));
        return d;
    }, [endDate, period]);

    const getLocalDateString = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    useEffect(() => {
        if (endDateProp) setEndDate(endDateProp);
    }, [endDateProp]);

    useEffect(() => {
        const token = localStorage.getItem('Token');
        if (!token) return;
        fetch('/api/dailyIntake', { headers: { edgetoken: token } })
            .then(r => r.json())
            .then(data => { if (data.success) setTargets(data.targets); });
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
                    const acc: any = {};
                    let activeCount = 0;
                    data.logs.forEach((log: any) => {
                        const hasItems = (log.items || []).length > 0;
                        if (hasItems) {
                            activeCount++;
                            (log.items || []).forEach((item: any) => {
                                if (item.nutrients) {
                                    Object.keys(item.nutrients).forEach(k => {
                                        acc[k] = (acc[k] || 0) + item.nutrients[k];
                                    });
                                }
                            });
                        }
                    });
                    setDataState({ totals: acc, activeDays: Math.max(activeCount, 1) });
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [startDate, endDate]);

    const activeDaysCount = dataState.activeDays;
    const insights = useMemo(() => {
        if (!targets) return [];
        return Object.keys(NUTRIENT_LABELS).map(k => {
            const key = k as keyof DailyIntakeTargets;
            const total = dataState.totals[key] || 0;
            const target = targets[key] * activeDaysCount;
            const pct = (total / target) * 100;
            return {
                key,
                pct,
                total,
                target,
                label: NUTRIENT_LABELS[key].label,
                unit: NUTRIENT_LABELS[key].unit,
                ...NUTRIENT_INSIGHTS[key]
            };
        }).filter(i => i.pct < 75).sort((a, b) => a.pct - b.pct);
    }, [dataState, targets, activeDaysCount]);

    return (
        <div className="space-y-6">
            {/* View toggle */}
            <div className="flex flex-wrap gap-1 bg-muted/30 p-1 rounded-xl border border-white/5 shadow-inner w-fit">
                <button onClick={() => setView('deficiencies')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'deficiencies' ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    <FiZap /> Nutrient Deficiencies
                </button>
                <button onClick={() => setView('correlations')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'correlations' ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    <FiActivity /> Food & Symptom Correlations
                </button>
            </div>

            {view === 'correlations' ? (
                <CorrelationInsightsView endDateProp={endDateProp} />
            ) : (
            <>
            <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-white/5 shadow-inner">
                    {(['today', 'week', 'month'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${period === p ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            {PERIOD_CONFIG[p].label}
                        </button>
                    ))}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                    Analyzing {activeDaysCount} Days
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center animate-pulse text-emerald-500 font-black uppercase tracking-widest text-sm">
                    Analyzing Nutritional Patterns...
                </div>
            ) : insights.length === 0 ? (
                <div className="py-20 text-center glass-card border-emerald-500/20">
                    <FiZap size={40} className="mx-auto text-emerald-500 mb-4 opacity-50" />
                    <h3 className="text-xl font-black text-emerald-400 mb-2">Optimal Nutrition Detected</h3>
                    <p className="text-sm text-muted-foreground">You are meeting your nutritional targets across all tracked categories for this period.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-6">
                        <FiAlertTriangle className="text-amber-500" />
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">Identified Potential Deficiencies</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {insights.map(insight => (
                            <div key={insight.key} className={`glass-card relative overflow-hidden transition-all duration-300 ${expandedNutrient === insight.key ? 'ring-2 ring-amber-500/50' : 'hover:bg-white/[0.04]'}`}>
                                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50" />
                                
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{NUTRIENT_LABELS[insight.key as keyof DailyIntakeTargets].group}</div>
                                        <h3 className="text-lg font-black">{insight.label}</h3>
                                    </div>
                                    <div className={`text-xl font-black ${insight.pct < 40 ? 'text-rose-400' : 'text-amber-400'}`}>
                                        {Math.round(insight.pct)}%
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full transition-all duration-1000 ${insight.pct < 40 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(insight.pct, 100)}%` }} />
                                    </div>

                                    <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/10">
                                        <h4 className="text-[9px] font-black uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5">
                                            <FiAlertTriangle size={10} /> Potential Symptoms
                                        </h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {insight.symptoms.map(s => (
                                                <span key={s} className="text-[10px] font-bold text-amber-200/80 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/10">{s}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t border-white/5 pt-4">
                                        <button 
                                            onClick={() => setExpandedNutrient(expandedNutrient === insight.key ? null : insight.key)}
                                            className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
                                        >
                                            Recommended Foods {expandedNutrient === insight.key ? <FiChevronUp /> : <FiChevronDown />}
                                        </button>
                                        
                                        {expandedNutrient === insight.key && (
                                            <div className="mt-3 grid grid-cols-1 gap-2 animate-in slide-in-from-top-1 duration-200">
                                                {insight.foods.map(food => (
                                                    <div key={food} className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-emerald-500/10 transition-all border border-transparent hover:border-emerald-500/20 group">
                                                        <span className="text-[11px] font-bold capitalize">{food}</span>
                                                        <button 
                                                            onClick={() => onLogFood(food)}
                                                            className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-md hover:bg-emerald-500 hover:text-black transition-all active:scale-90"
                                                        >
                                                            <FiPlus size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            </>
            )}
        </div>
    );
}
