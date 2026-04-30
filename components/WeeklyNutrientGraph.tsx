import React, { useState, useEffect, useMemo } from 'react';
import { NUTRIENT_LABELS, DailyIntakeTargets } from '../lib/dailyIntake';
import { FiChevronLeft, FiChevronRight, FiAlertTriangle, FiCalendar } from 'react-icons/fi';

const DEFAULT_TARGETS: DailyIntakeTargets = {
    energy_kcal: 2000, protein_g: 80, fat_g: 67, carbohydrates_g: 250, fiber_g: 30,
    calcium_mg: 1000, iron_mg: 14, magnesium_mg: 370, phosphorus_mg: 700,
    potassium_mg: 3000, sodium_mg: 2300, zinc_mg: 9,
    vitamin_a_ug: 800, vitamin_b1_mg: 1.1, vitamin_b2_mg: 1.2, vitamin_b3_mg: 15,
    vitamin_b6_mg: 1.3, vitamin_b12_ug: 2.4, vitamin_c_mg: 80,
    vitamin_d_ug: 15, vitamin_e_mg: 15, vitamin_k_ug: 105,
};

const VITAMIN_KEYS: (keyof DailyIntakeTargets)[] = [
    'vitamin_a_ug', 'vitamin_b1_mg', 'vitamin_b2_mg', 'vitamin_b3_mg',
    'vitamin_b6_mg', 'vitamin_b12_ug', 'vitamin_c_mg', 'vitamin_d_ug',
    'vitamin_e_mg', 'vitamin_k_ug',
];
const MINERAL_KEYS: (keyof DailyIntakeTargets)[] = [
    'calcium_mg', 'iron_mg', 'magnesium_mg', 'phosphorus_mg',
    'potassium_mg', 'sodium_mg', 'zinc_mg',
];
const MACRO_KEYS: (keyof DailyIntakeTargets)[] = [
    'energy_kcal', 'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g',
];
const ALL_KEYS = [...MACRO_KEYS, ...MINERAL_KEYS, ...VITAMIN_KEYS];

type Period = 'week' | 'month' | 'year';
type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

const GRADE_CONFIG: Record<Grade, { min: number; color: string; bg: string; border: string; label: string }> = {
    A: { min: 90, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Excellent' },
    B: { min: 75, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Good' },
    C: { min: 60, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Fair' },
    D: { min: 40, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'Poor' },
    F: { min: 0, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'Critical' },
};

function getGrade(pct: number): Grade {
    if (pct >= 90) return 'A';
    if (pct >= 75) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
}

const PERIOD_CONFIG: Record<Period, { label: string; days: number; icon: string; navStep: (d: Date, dir: 1|-1) => Date }> = {
    week:  { label: 'Week',  days: 7,   icon: '7d',  navStep: (d, dir) => { const n = new Date(d); n.setDate(n.getDate() + dir * 7); return n; } },
    month: { label: 'Month', days: 30,  icon: '30d', navStep: (d, dir) => { const n = new Date(d); n.setMonth(n.getMonth() + dir); return n; } },
    year:  { label: 'Year',  days: 365, icon: '1y',  navStep: (d, dir) => { const n = new Date(d); n.setFullYear(n.getFullYear() + dir); return n; } },
};

function blankTotals(): Record<keyof DailyIntakeTargets, number> {
    const out: any = {};
    [...ALL_KEYS, 'energy_kcal'].forEach(k => (out[k] = 0));
    return out;
}

const getLocalDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtVal = (v: number, unit: string) => {
    if (v === 0) return `0${unit}`;
    
    let val = v;
    let u = unit;
    
    // Multi-step Unit conversion
    const convertible = ['mg', 'μg', 'g'];
    while (convertible.includes(u) && val >= 1000) {
        if (u === 'mg') { val /= 1000; u = 'g'; }
        else if (u === 'μg') { val /= 1000; u = 'mg'; }
        else if (u === 'g') { val /= 1000; u = 'kg'; }
        else break;
    }
    
    // Formatting
    if (val >= 1000) {
        return (val / 1000).toFixed(1) + 'k' + (u ? ' ' + u : '');
    }
    
    let formatted: string;
    if (val >= 100) {
        formatted = Math.round(val).toString();
    } else if (val < 1) {
        formatted = val.toFixed(2);
    } else {
        formatted = val.toFixed(1);
    }
    
    return formatted + u;
};

interface NutrientStat {
    key: string; label: string; unit: string;
    totalCumulative: number; cumulativeTarget: number; cumulativePct: number;
    todayValue: number; todayPct: number; avgValue: number; avgPct: number;
    isVitaminC: boolean; activeDaysCount: number; grade: Grade;
    dailyPcts: number[]; // for sparkline
}

export default function WeeklyNutrientGraph() {
    const [targets, setTargets] = useState<DailyIntakeTargets>(DEFAULT_TARGETS);
    const [dailyTotals, setDailyTotals] = useState<Record<string, Record<string, number>>>({});
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState<Period>('month');
    const [filter, setFilter] = useState<'all' | 'macro' | 'mineral' | 'vitamin' | 'custom'>('all');
    const [customFilters, setCustomFilters] = useState<(keyof DailyIntakeTargets)[]>([]);
    const [endDate, setEndDate] = useState<Date>(() => new Date());

    const startDate = useMemo(() => {
        const d = new Date(endDate);
        d.setDate(d.getDate() - (PERIOD_CONFIG[period].days - 1));
        return d;
    }, [endDate, period]);

    const startDateStr = useMemo(() => getLocalDateString(startDate), [startDate]);
    const endDateStr = useMemo(() => getLocalDateString(endDate), [endDate]);
    const todayStr = getLocalDateString(new Date());

    const rangeDates = useMemo(() => {
        const dates: string[] = [];
        const iter = new Date(startDate);
        while (iter <= endDate) { dates.push(getLocalDateString(iter)); iter.setDate(iter.getDate() + 1); }
        return dates;
    }, [startDate, endDate]);

    const periodLabel = useMemo(() => {
        if (period === 'week') {
            const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
            return `${startDate.toLocaleDateString('en-AU', opts)} – ${endDate.toLocaleDateString('en-AU', opts)}`;
        }
        if (period === 'month') return endDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
        return endDate.getFullYear().toString();
    }, [period, startDate, endDate]);

    const navigate = (dir: 1 | -1) => setEndDate(prev => PERIOD_CONFIG[period].navStep(prev, dir));
    const switchPeriod = (p: Period) => { setPeriod(p); setEndDate(new Date()); };

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('Token') : null;
        if (!token) return;
        fetch('/api/dailyIntake', { headers: { edgetoken: token } })
            .then(r => r.json())
            .then(data => { if (data.success && data.targets) setTargets(data.targets); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const token = localStorage.getItem('Token');
            if (!token) return;
            try {
                const res = await fetch(`/api/dailyLog/range?startDate=${startDateStr}&endDate=${endDateStr}`, { headers: { edgetoken: token } });
                const data = await res.json();
                if (data.success && data.logs) {
                    const acc: Record<string, Record<string, number>> = {};
                    rangeDates.forEach(d => (acc[d] = blankTotals()));
                    data.logs.forEach((log: any) => {
                        if (acc[log.date]) {
                            (log.items || []).forEach((item: any) => {
                                if (item.nutrients) Object.keys(item.nutrients).forEach(k => {
                                    if (acc[log.date][k] !== undefined) acc[log.date][k] += item.nutrients[k];
                                });
                            });
                        }
                    });
                    setDailyTotals(acc);
                }
            } catch (e) { console.error('Error fetching nutrient data', e); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [startDateStr, endDateStr, rangeDates]);

    const nutrientStats: NutrientStat[] = useMemo(() => {
        if (Object.keys(dailyTotals).length === 0) return [];
        const activeDays = rangeDates.filter(d => (dailyTotals[d]?.energy_kcal ?? 0) > 0);
        const activeDaysCount = activeDays.length || 1;

        return ALL_KEYS.map(k => {
            const target = targets[k] || 1;
            const isVitaminC = k === 'vitamin_c_mg';
            const totalCumulative = rangeDates.reduce((a, d) => a + (dailyTotals[d]?.[k] ?? 0), 0);
            const todayValue = dailyTotals[todayStr]?.[k] ?? 0;
            const avgValue = totalCumulative / activeDaysCount;
            const cumulativeTarget = target * activeDaysCount;
            const cumulativePct = (totalCumulative / cumulativeTarget) * 100;
            const todayPct = (todayValue / target) * 100;
            const avgPct = (avgValue / target) * 100;

            // Build sparkline data — last 7 active days (or all if week mode)
            const sparkDates = period === 'week' ? rangeDates : activeDays.slice(-14);
            const dailyPcts = sparkDates.map(d => Math.min(((dailyTotals[d]?.[k] ?? 0) / target) * 100, 150));

            return {
                key: k, label: NUTRIENT_LABELS[k]?.label ?? k, unit: NUTRIENT_LABELS[k]?.unit ?? '',
                totalCumulative, cumulativeTarget, cumulativePct,
                todayValue, todayPct, avgValue, avgPct,
                isVitaminC, activeDaysCount,
                grade: isVitaminC ? getGrade(avgPct) : getGrade(cumulativePct),
                dailyPcts,
            };
        });
    }, [dailyTotals, targets, rangeDates, todayStr, period]);

    const filteredStats = useMemo(() => {
        return nutrientStats.filter(s => {
            if (filter === 'all') return true;
            if (filter === 'macro') return MACRO_KEYS.includes(s.key as any);
            if (filter === 'mineral') return MINERAL_KEYS.includes(s.key as any);
            if (filter === 'vitamin') return VITAMIN_KEYS.includes(s.key as any);
            if (filter === 'custom') return customFilters.includes(s.key as any);
            return true;
        });
    }, [nutrientStats, filter, customFilters]);

    // Group by grade for the "all" view
    const gradeGroups = useMemo(() => {
        const groups: Record<Grade, NutrientStat[]> = { A: [], B: [], C: [], D: [], F: [] };
        filteredStats.forEach(s => groups[s.grade].push(s));
        return groups;
    }, [filteredStats]);


    // Compact card for mobile and desktop
    const NutrientCard = ({ stat }: { stat: NutrientStat }) => {
        const gc = GRADE_CONFIG[stat.grade];
        const pct = stat.isVitaminC ? stat.avgPct : stat.cumulativePct;
        const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 60 ? 'bg-amber-500' : pct >= 40 ? 'bg-orange-500' : 'bg-rose-500';

        return (
            <div className={`group relative overflow-hidden ${gc.bg} border ${gc.border} rounded-2xl p-4 flex flex-col gap-3 hover:shadow-xl hover:shadow-black/20 transition-all duration-300`}>
                {/* Background Grade Accent */}
                <div className={`absolute -top-2 -right-2 text-6xl font-black opacity-5 pointer-events-none ${gc.color}`}>{stat.grade}</div>

                {/* Top row: label + grade */}
                <div className="flex items-center justify-between gap-1 relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80 truncate">{stat.label}</span>
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full ${gc.bg} border ${gc.border} text-xs font-black ${gc.color}`}>
                        {stat.grade}
                    </div>
                </div>

                {/* Main Progress Bar */}
                <div className="space-y-1.5 relative z-10">
                    <div className="h-2 w-full bg-black/30 rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full ${barColor} transition-all duration-1000 ease-out rounded-full shadow-[0_0_8px_rgba(0,0,0,0.3)]`}
                            style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                </div>

                {/* Cumulative Period Total - The requested highlight */}
                <div className="bg-black/20 rounded-xl p-2.5 border border-white/5 space-y-1 relative z-10">
                    <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">Cumulative Period</div>
                    <div className="flex items-baseline justify-between">
                        <div className="text-sm font-black tabular-nums">
                            {fmtVal(stat.totalCumulative, stat.unit)} 
                            <span className="text-[10px] text-muted-foreground/40 mx-1">/</span> 
                            {fmtVal(stat.cumulativeTarget, stat.unit)}
                        </div>
                        <div className={`text-[10px] font-black ${gc.color}`}>
                            {Math.round(stat.cumulativePct)}%
                        </div>
                    </div>
                </div>

                {/* Values: Today / Avg */}
                <div className="grid grid-cols-2 gap-3 text-[9px] relative z-10">
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-muted-foreground/60 font-bold uppercase tracking-tighter">
                            <span>Today</span>
                            <span className="text-foreground">{fmtVal(stat.todayValue, stat.unit)}</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500/50 rounded-full" style={{ width: `${Math.min(stat.todayPct, 100)}%` }} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-muted-foreground/60 font-bold uppercase tracking-tighter">
                            <span>Daily Avg</span>
                            <span className="text-foreground">{fmtVal(stat.avgValue, stat.unit)}</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500/50 rounded-full" style={{ width: `${Math.min(stat.avgPct, 100)}%` }} />
                        </div>
                    </div>
                </div>

                {stat.isVitaminC && (
                    <div className="text-[8px] font-black uppercase tracking-widest text-amber-500/60 flex items-center gap-1.5 mt-1 border-t border-amber-500/10 pt-2">
                        <FiAlertTriangle size={10} /> Daily replenish
                    </div>
                )}
            </div>
        );
    };

    // Grade section header for "all" view
    const GradeSection = ({ grade, stats }: { grade: Grade; stats: NutrientStat[] }) => {
        if (stats.length === 0) return null;
        const gc = GRADE_CONFIG[grade];
        return (
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-2xl ${gc.bg} border ${gc.border} text-xl font-black ${gc.color} shadow-lg`}>
                        {grade}
                    </div>
                    <div>
                        <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${gc.color}`}>{gc.label}</div>
                        <div className="text-[9px] text-muted-foreground font-bold">{stats.length} nutrient{stats.length !== 1 ? 's' : ''} in this bracket</div>
                    </div>
                    <div className="flex-1 h-px bg-white/5 ml-2" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {stats.map(s => <NutrientCard key={s.key} stat={s} />)}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full">
            {/* Controls Bar — stacks nicely on mobile */}
            <div className="flex flex-wrap gap-2 mb-4 items-center">
                {/* Period pills */}
                <div className="flex gap-0.5 bg-muted/30 rounded-xl p-0.5 border border-white/5">
                    {(['week', 'month', 'year'] as Period[]).map(p => (
                        <button key={p} onClick={() => switchPeriod(p)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                period === p ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-muted-foreground hover:text-foreground'
                            }`}>
                            {PERIOD_CONFIG[p].icon}
                        </button>
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-0.5 border border-white/5 ml-auto">
                    <button onClick={() => navigate(-1)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground active:scale-90">
                        <FiChevronLeft size={14} />
                    </button>
                    <div className="flex items-center gap-1.5 px-2">
                        <FiCalendar size={10} className="text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-black tracking-wide tabular-nums whitespace-nowrap">{periodLabel}</span>
                    </div>
                    <button onClick={() => navigate(1)} disabled={endDateStr >= todayStr}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground disabled:opacity-20 active:scale-90">
                        <FiChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Filter row */}
            <div className="mb-4">
                <div className="flex gap-0.5 bg-muted/20 rounded-lg p-0.5 overflow-x-auto no-scrollbar">
                    {(['all', 'macro', 'mineral', 'vitamin', 'custom'] as const).map(g => (
                        <button key={g} onClick={() => setFilter(g)}
                            className={`flex-none px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                filter === g ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}>
                            {g === 'all' ? '🌎 All' : g === 'macro' ? '🥗 Macros' : g === 'mineral' ? '⚗️ Minerals' : g === 'vitamin' ? '💊 Vitamins' : '🎛️ Custom'}
                        </button>
                    ))}
                </div>

                {filter === 'custom' && (
                    <div className="flex flex-wrap gap-1.5 p-2 mt-2 bg-muted/10 rounded-xl border border-white/5 max-h-[120px] overflow-y-auto">
                        {ALL_KEYS.map(k => {
                            const sel = customFilters.includes(k);
                            return (
                                <button key={k} onClick={() => sel ? setCustomFilters(p => p.filter(x => x !== k)) : setCustomFilters(p => [...p, k])}
                                    className={`px-2 py-1 text-[8px] font-bold uppercase tracking-wider rounded transition-all ${
                                        sel ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10'
                                    }`}>
                                    {NUTRIENT_LABELS[k as keyof DailyIntakeTargets]?.label ?? k}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Active days badge */}
            {nutrientStats.length > 0 && (
                <div className="flex items-center gap-3 mb-4 px-1">
                    <span className="text-[9px] font-bold text-muted-foreground/60">
                        {nutrientStats[0].activeDaysCount} of {rangeDates.length} days logged
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                </div>
            )}

            {/* Content */}
            <div className="relative min-h-[200px]">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm z-10 rounded-xl">
                        <div className="animate-pulse text-emerald-500 font-black tracking-widest text-[10px] uppercase">
                            Loading {PERIOD_CONFIG[period].label}…
                        </div>
                    </div>
                )}

                {filter === 'all' ? (
                    /* Grouped by grade */
                    <div>
                        {(['A', 'B', 'C', 'D', 'F'] as Grade[]).map(g => (
                            <GradeSection key={g} grade={g} stats={gradeGroups[g]} />
                        ))}
                        {filteredStats.length === 0 && !loading && (
                            <div className="text-center py-12 text-muted-foreground text-sm">No data for this period.</div>
                        )}
                    </div>
                ) : (
                    /* Flat grid for specific filters */
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                        {filteredStats.map(s => <NutrientCard key={s.key} stat={s} />)}
                    </div>
                )}
            </div>

            {/* Bottom summary */}
            {nutrientStats.length > 0 && (
                <div className="mt-6 bg-muted/10 border border-white/5 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">
                        {PERIOD_CONFIG[period].label} Report Card
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {(['A', 'B', 'C', 'D', 'F'] as Grade[]).map(g => {
                            const count = gradeGroups[g]?.length ?? 0;
                            if (count === 0) return null;
                            const gc = GRADE_CONFIG[g];
                            return (
                                <div key={g} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${gc.bg} border ${gc.border}`}>
                                    <span className={`text-lg font-black ${gc.color}`}>{g}</span>
                                    <div>
                                        <div className={`text-[10px] font-black ${gc.color}`}>{count}</div>
                                        <div className="text-[7px] font-bold text-muted-foreground uppercase tracking-wider">{gc.label}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
