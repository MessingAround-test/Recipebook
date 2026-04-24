import React, { useState, useEffect, useMemo } from 'react';
import 'chart.js/auto';
import { Line } from 'react-chartjs-2';
import { NUTRIENT_LABELS, DailyIntakeTargets } from '../lib/dailyIntake';
import { FiChevronLeft, FiChevronRight, FiAlertTriangle } from 'react-icons/fi';

const DEFAULT_TARGETS: DailyIntakeTargets = {
    energy_kcal: 2000,
    protein_g: 80,
    fat_g: 67,
    carbohydrates_g: 250,
    fiber_g: 30,
    calcium_mg: 1000,
    iron_mg: 14,
    magnesium_mg: 370,
    phosphorus_mg: 700,
    potassium_mg: 3000,
    sodium_mg: 2300,
    zinc_mg: 9,
    vitamin_a_ug: 800,
    vitamin_b1_mg: 1.1,
    vitamin_b2_mg: 1.2,
    vitamin_b3_mg: 15,
    vitamin_b6_mg: 1.3,
    vitamin_b12_ug: 2.4,
    vitamin_c_mg: 80,
    vitamin_d_ug: 15,
    vitamin_e_mg: 15,
    vitamin_k_ug: 105,
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
    'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g',
];

const ALL_KEYS = [...MACRO_KEYS, ...MINERAL_KEYS, ...VITAMIN_KEYS];

function blankTotals(): Record<keyof DailyIntakeTargets, number> {
    const out: any = {};
    [...ALL_KEYS, 'energy_kcal'].forEach(k => (out[k] = 0));
    return out;
}

export default function WeeklyNutrientGraph() {
    const [targets, setTargets] = useState<DailyIntakeTargets>(DEFAULT_TARGETS);
    const [dailyTotals, setDailyTotals] = useState<Record<string, Record<string, number>>>({});
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'macro' | 'mineral' | 'vitamin' | 'custom'>('all');
    const [customFilters, setCustomFilters] = useState<(keyof DailyIntakeTargets)[]>([]);
    
    const [endDateStr, setEndDateStr] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    const getLocalDateString = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const changeWeek = (offsetDays: number) => {
        const [y, m, d] = endDateStr.split('-').map(Number);
        const newD = new Date(y, m - 1, d);
        newD.setDate(newD.getDate() + offsetDays);
        setEndDateStr(getLocalDateString(newD));
    };

    const startDateStr = useMemo(() => {
        const [y, m, d] = endDateStr.split('-').map(Number);
        const newD = new Date(y, m - 1, d);
        newD.setDate(newD.getDate() - 6); // 7 days total inclusive
        return getLocalDateString(newD);
    }, [endDateStr]);

    const weekDates = useMemo(() => {
        const dates = [];
        const [y, m, d] = startDateStr.split('-').map(Number);
        const iterD = new Date(y, m - 1, d);
        for (let i = 0; i < 7; i++) {
            dates.push(getLocalDateString(iterD));
            iterD.setDate(iterD.getDate() + 1);
        }
        return dates;
    }, [startDateStr]);

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('Token') : null;
        if (!token) return;
        fetch('/api/dailyIntake', { headers: { edgetoken: token } })
            .then(r => r.json())
            .then(data => {
                if (data.success && data.targets) setTargets(data.targets);
            })
            .catch(() => { /* use defaults */ });
    }, []);

    useEffect(() => {
        const fetchWeeklyData = async () => {
            setLoading(true);
            const token = localStorage.getItem('Token');
            if (!token) return;

            try {
                const res = await fetch(`/api/dailyLog/range?startDate=${startDateStr}&endDate=${endDateStr}`, {
                    headers: { edgetoken: token },
                });
                const data = await res.json();
                
                if (data.success && data.logs) {
                    const accByDate: Record<string, Record<string, number>> = {};
                    weekDates.forEach(d => accByDate[d] = blankTotals());

                    data.logs.forEach((log: any) => {
                        if (accByDate[log.date]) {
                            (log.items || []).forEach((item: any) => {
                                if (item.nutrients) {
                                    Object.keys(item.nutrients).forEach(k => {
                                        if (accByDate[log.date][k] !== undefined) {
                                            accByDate[log.date][k] += item.nutrients[k];
                                        }
                                    });
                                }
                            });
                        }
                    });
                    
                    setDailyTotals(accByDate);
                }
            } catch (error) {
                console.error("Error fetching weekly data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchWeeklyData();
    }, [startDateStr, endDateStr, weekDates]);

    // Build Chart Data
    const chartLabels = weekDates.map(d => {
        const [y, m, day] = d.split('-').map(Number);
        const dateObj = new Date(y, m - 1, day);
        return dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    });

    // Color palette for when a specific filter is applied
    const PALETTE = [
        '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', 
        '#ec4899', '#06b6d4', '#84cc16', '#f97316', 
        '#14b8a6', '#6366f1'
    ];

    let activeKeys: (keyof DailyIntakeTargets)[] = ALL_KEYS;
    if (filter === 'macro') activeKeys = MACRO_KEYS;
    if (filter === 'mineral') activeKeys = MINERAL_KEYS;
    if (filter === 'vitamin') activeKeys = VITAMIN_KEYS;
    if (filter === 'custom') activeKeys = customFilters;

    const datasets: any[] = activeKeys.map((k, idx) => {
        const target = targets[k as keyof DailyIntakeTargets] || 1;
        const dataPoints = weekDates.map(d => {
            const val = dailyTotals[d]?.[k] ?? 0;
            return parseFloat(((val / target) * 100).toFixed(1));
        });
        
        const isDeficient = dataPoints.some(val => val < 75);
        
        let color, width, pointRad, order;
        if (filter === 'all') {
            color = isDeficient ? '#ef4444' : 'rgba(255,255,255,0.05)';
            width = isDeficient ? 2 : 1;
            pointRad = isDeficient ? 3 : 0;
            order = isDeficient ? 1 : 2;
        } else {
            color = PALETTE[idx % PALETTE.length];
            width = 2;
            pointRad = 3;
            order = 1;
        }
        
        return {
            label: NUTRIENT_LABELS[k as keyof DailyIntakeTargets]?.label ?? k,
            data: dataPoints,
            borderColor: color,
            backgroundColor: color,
            borderWidth: width,
            tension: 0.4,
            pointRadius: pointRad,
            pointHoverRadius: 5,
            order: order,
        };
    });

    // Add the 75% Threshold Line
    datasets.push({
        label: '75% Warning Threshold',
        data: weekDates.map(() => 75),
        borderColor: '#f59e0b',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        order: 0,
    });

    const chartData = {
        labels: chartLabels,
        datasets: datasets,
    };

    // Calculate deficient averages over the week (only for days with actual logs)
    const deficientAverages = useMemo(() => {
        if (Object.keys(dailyTotals).length === 0) return [];
        
        // Count how many days actually had food logged
        let activeDaysCount = 0;
        weekDates.forEach(d => {
            if ((dailyTotals[d]?.energy_kcal ?? 0) > 0) {
                activeDaysCount++;
            }
        });
        
        const divisor = activeDaysCount > 0 ? activeDaysCount : 1;

        return ALL_KEYS.map(k => {
            const target = targets[k as keyof DailyIntakeTargets] || 1;
            const sum = weekDates.reduce((acc, d) => acc + (dailyTotals[d]?.[k] ?? 0), 0);
            const avg = sum / divisor;
            const pct = (avg / target) * 100;
            return { key: k, avg, target, pct };
        }).filter(n => n.pct < 75).sort((a, b) => a.pct - b.pct);
    }, [dailyTotals, targets, weekDates]);

    return (
        <div className="w-full">
            {/* Week Navigation */}
            <div className="flex items-center justify-between mb-6 bg-muted/20 p-2 rounded-xl border border-white/5">
                <button onClick={() => changeWeek(-7)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                    <FiChevronLeft size={20} />
                </button>
                <div className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Weekly Trend
                </div>
                <button onClick={() => changeWeek(7)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                    <FiChevronRight size={20} />
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-col gap-3 mb-5">
                <div className="flex gap-1 bg-muted/20 rounded-lg p-1 w-full md:w-auto inline-flex shadow-inner overflow-x-auto">
                    {(['all', 'macro', 'mineral', 'vitamin', 'custom'] as const).map(g => (
                        <button
                            key={g}
                            onClick={() => setFilter(g)}
                            className={`flex-none px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                filter === g
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {g === 'all' ? '🌎 All' : g === 'macro' ? '🥗 Macros' : g === 'mineral' ? '⚗️ Minerals' : g === 'vitamin' ? '💊 Vitamins' : '🎛️ Custom'}
                        </button>
                    ))}
                </div>

                {filter === 'custom' && (
                    <div className="flex flex-wrap gap-2 p-3 bg-muted/10 rounded-xl border border-white/5 max-h-[150px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
                        {ALL_KEYS.map(k => {
                            const isSelected = customFilters.includes(k);
                            const label = NUTRIENT_LABELS[k as keyof DailyIntakeTargets]?.label ?? k;
                            return (
                                <button
                                    key={k}
                                    onClick={() => {
                                        if (isSelected) setCustomFilters(prev => prev.filter(x => x !== k));
                                        else setCustomFilters(prev => [...prev, k]);
                                    }}
                                    className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${
                                        isSelected 
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-sm' 
                                            : 'bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Chart */}
            <div className="w-full h-[350px] mb-8 bg-muted/10 p-4 rounded-xl border border-white/5 relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 rounded-xl">
                        <div className="animate-pulse text-emerald-500 font-black tracking-widest text-xs uppercase">Analyzing Trends...</div>
                    </div>
                )}
                <Line
                    data={chartData}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            legend: { display: filter !== 'all', position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                            tooltip: {
                                filter: function(tooltipItem) {
                                    if (filter !== 'all') return true;
                                    if (tooltipItem.dataset.label === '75% Warning Threshold') return true;
                                    return tooltipItem.dataset.borderColor === '#ef4444';
                                },
                                callbacks: {
                                    label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%`,
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 150,
                                grid: { color: 'rgba(255,255,255,0.05)' },
                                ticks: { color: '#9ca3af' },
                                title: { display: true, text: '% of Daily Target', color: '#6b7280', font: { size: 10 } }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: '#9ca3af', font: { size: 11, weight: 'bold' } }
                            }
                        }
                    }}
                />
            </div>

            {/* Deficient Summary */}
            <div className="glass-card">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-rose-500 flex items-center gap-2">
                        <FiAlertTriangle /> Critical Deficiencies (Active Days Avg)
                    </h3>
                </div>
                
                {deficientAverages.length === 0 ? (
                    <div className="text-sm text-emerald-400 font-bold p-4 bg-emerald-500/10 rounded-xl text-center border border-emerald-500/20">
                        Awesome! You hit &gt;75% of your targets for everything this week.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {deficientAverages.map(def => {
                            const meta = NUTRIENT_LABELS[def.key as keyof DailyIntakeTargets];
                            const colour = def.pct < 50 ? '#ef4444' : '#f59e0b';
                            return (
                                <div key={def.key} className="bg-muted/30 rounded-lg p-3 border border-border">
                                    <div className="text-xs font-medium text-muted-foreground capitalize mb-1">{meta?.label ?? def.key}</div>
                                    <div className="text-lg font-bold">
                                        {def.avg < 10 ? def.avg.toFixed(2) : Math.round(def.avg)}
                                        <span className="text-xs font-normal text-muted-foreground ml-1">/ {def.target < 10 ? def.target.toFixed(1) : Math.round(def.target)}{meta?.unit}</span>
                                    </div>
                                    <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(def.pct, 5)}%`, backgroundColor: colour }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
