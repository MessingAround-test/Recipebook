import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { calculateDailyIntake, DailyIntakeTargets, NUTRIENT_LABELS } from '../lib/dailyIntake';
import 'chart.js/auto';
import { Bar } from 'react-chartjs-2';
import { FiChevronLeft, FiChevronRight, FiPlus, FiTrash2, FiSearch, FiZap, FiX } from 'react-icons/fi';
import AddShoppingItem from '../components/AddShoppingItem';
import { Toolbar } from '../components/Toolbar';
import IngredientNutrientGraph from '../components/IngredientNutrientGraph';

export default function DailyTracker() {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [log, setLog] = useState<any>(null);
    const [targets, setTargets] = useState<DailyIntakeTargets | null>(null);
    const [loading, setLoading] = useState(false);
    const [isLoggingOpen, setIsLoggingOpen] = useState(false);
    const [recommendations, setRecommendations] = useState<any>(null);

    // Fetch targets and log
    const fetchData = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('Token');
        if (!token) return;

        try {
            // 1. Get targets
            const targetRes = await fetch('/api/dailyIntake', { headers: { edgetoken: token } });
            const targetData = await targetRes.json();
            if (targetData.success) setTargets(targetData.targets);

            // 2. Get log for date
            const logRes = await fetch(`/api/dailyLog?date=${date}`, { headers: { edgetoken: token } });
            const logData = await logRes.json();
            if (logData.success) setLog(logData.log);

            // 3. Get recommendations (weekly analysis)
            const recRes = await fetch('/api/dailyLog/recommendations', { headers: { edgetoken: token } });
            const recData = await recRes.json();
            if (recData.success) setRecommendations(recData);

        } catch (err) {
            console.error("Fetch data failed:", err);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const changeDate = (offset: number) => {
        const d = new Date(date);
        d.setDate(d.getDate() + offset);
        setDate(d.toISOString().split('T')[0]);
    };

    const handleLogItem = async (e: any) => {
        const token = localStorage.getItem('Token');
        const item = e.value;
        try {
            const res = await fetch('/api/dailyLog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({
                    date,
                    type: 'ingredient',
                    name: item.name,
                    quantity: Number(item.quantity),
                    quantity_unit: item.quantity_type
                })
            });
            const data = await res.json();
            if (data.success) {
                setLog(data.log);
                e.resetForm();
                setIsLoggingOpen(false);
            }
        } catch (err) {
            alert("Add failed");
        }
    };

    const deleteItem = async (itemId: string) => {
        const token = localStorage.getItem('Token');
        try {
            const res = await fetch('/api/dailyLog', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({ date, itemId })
            });
            const data = await res.json();
            if (data.success) setLog(data.log);
        } catch (err) {
            alert("Delete failed");
        }
    };

    // Calculate totals for a Daily Score
    const totals = (log?.items || []).reduce((acc: any, item: any) => {
        Object.keys(item.nutrients).forEach(k => {
            acc[k] = (acc[k] || 0) + item.nutrients[k];
        });
        return acc;
    }, {});

    const calculateScore = () => {
        if (!targets || !log?.items?.length) return 0;
        const keys = ['energy_kcal', 'protein_g', 'carbohydrates_g', 'fat_g', 'fiber_g'];
        const pcts = keys.map(k => {
            const val = totals[k] || 0;
            const target = (targets as any)[k];
            return Math.min((val / target) * 100, 100);
        });
        return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    };

    const dailyScore = calculateScore();

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Toolbar />
            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
                    <div>
                        <PageHeader title="Daily Food Tracker" />
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-1">Track & Optimize Your Nutrition</p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-center">
                            <div className={`text-4xl font-black ${dailyScore > 80 ? 'text-emerald-400' : dailyScore > 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                {dailyScore}%
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Daily Score</div>
                        </div>
                        <div className="h-10 w-px bg-white/10" />
                        <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-xl border border-white/5 shadow-inner">
                            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><FiChevronLeft size={18} /></button>
                            <div className="font-black text-[11px] tracking-widest uppercase px-3">{date === new Date().toISOString().split('T')[0] ? 'Today' : date}</div>
                            <button onClick={() => changeDate(1)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><FiChevronRight size={18} /></button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {/* Top Row: Log and Insights */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                        {/* Log Section */}
                        <div className="lg:col-span-3 space-y-6">
                            {!isLoggingOpen ? (
                                <button
                                    onClick={() => setIsLoggingOpen(true)}
                                    className="w-full py-10 rounded-[2rem] border-2 border-dashed border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all group flex flex-col items-center gap-3"
                                >
                                    <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                                        <FiPlus size={24} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-emerald-500 transition-colors">Log New Food Item</span>
                                </button>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                                    <AddShoppingItem
                                        handleSubmit={handleLogItem}
                                        hideCategories={true}
                                        onCancel={() => setIsLoggingOpen(false)}
                                    />
                                </div>
                            )}

                            <div className="glass-card min-h-[300px]">
                                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Consumed Today</h3>
                                <div className="space-y-4">
                                    {log?.items?.length === 0 ? (
                                        <div className="py-20 text-center text-muted-foreground border-2 border-dashed border-white/5 rounded-xl opacity-40">
                                            No items logged for this day.
                                        </div>
                                    ) : (
                                        (() => {
                                            const groups: any[] = [];
                                            (log?.items || []).forEach((item: any) => {
                                                if (item.recipe_id && item.recipe_name) {
                                                    let group = groups.find(g => g.isGroup && g.recipe_id === item.recipe_id && g.logged_at === item.logged_at);
                                                    if (!group) {
                                                        group = { isGroup: true, recipe_id: item.recipe_id, recipe_name: item.recipe_name, logged_at: item.logged_at, items: [], totalKcal: 0 };
                                                        groups.push(group);
                                                    }
                                                    group.items.push(item);
                                                    group.totalKcal += item.nutrients.energy_kcal;
                                                } else {
                                                    groups.push({ isGroup: false, ...item });
                                                }
                                            });

                                            return groups.map((g, idx) => {
                                                if (g.isGroup) {
                                                    return (
                                                        <div key={`${g.recipe_id}-${g.logged_at}`} className="bg-white/[0.02] rounded-3xl border border-white/5 overflow-hidden group/recipe">
                                                            <div className="flex items-center justify-between p-4 bg-white/[0.03] border-b border-white/5">
                                                                <div>
                                                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">Recipe Serving</div>
                                                                    <div className="font-black text-sm">{g.recipe_name}</div>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{Math.round(g.totalKcal)} kcal</div>
                                                                    <button onClick={() => deleteItem(g.items[0]._id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover/recipe:opacity-100 transition-all">
                                                                        <FiTrash2 />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="p-2 space-y-1">
                                                                {g.items.map((it: any) => (
                                                                    <div key={it._id} className="flex items-center justify-between px-4 py-2 text-[11px] hover:bg-white/[0.02] rounded-xl transition-all">
                                                                        <span className="text-muted-foreground capitalize font-bold">{it.name}</span>
                                                                        <span className="text-muted-foreground/60">{it.quantity}{it.quantity_unit}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div key={g._id} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
                                                            <div>
                                                                <div className="font-bold text-sm capitalize">{g.name}</div>
                                                                <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">{g.quantity}{g.quantity_unit} • {Math.round(g.nutrients.energy_kcal)} kcal</div>
                                                            </div>
                                                            <button onClick={() => deleteItem(g._id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                                                <FiTrash2 />
                                                            </button>
                                                        </div>
                                                    );
                                                }
                                            });
                                        })()
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Insights Section */}
                        <div className="lg:col-span-2 space-y-6">
                            {recommendations?.deficientNutrient && (
                                <div className="glass-card border-amber-500/30 bg-amber-500/5 relative overflow-hidden h-full">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><FiZap size={60} /></div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-4 flex items-center gap-2">
                                        <FiZap /> Weekly Insight
                                    </h3>
                                    <p className="text-sm font-medium mb-6 leading-relaxed">
                                        You're hitting <span className="text-amber-400 font-black">{recommendations.currentWeeklyPct}%</span> of your weekly <span className="capitalize text-white">{NUTRIENT_LABELS[recommendations.deficientNutrient as keyof DailyIntakeTargets]?.label}</span>. Try adding these:
                                    </p>
                                    <div className="space-y-3">
                                        {recommendations.recommendations.map((rec: any) => (
                                            <div key={rec.name} className="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] font-bold flex justify-between items-center capitalize group hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all">
                                                <span>{rec.name}</span>
                                                <span className="text-emerald-400 font-black">+{Math.round(rec.value)}{NUTRIENT_LABELS[recommendations.deficientNutrient as keyof DailyIntakeTargets]?.unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Row: Full Width Breakdown */}
                    <div className="glass-card">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Comprehensive Nutritional Breakdown</h3>
                            <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest bg-white/5 px-3 py-1 rounded-full">Detailed Analysis</div>
                        </div>
                        <IngredientNutrientGraph 
                            ingredients={(log?.items || []).map((item: any) => ({
                                name: item.name,
                                quantity: item.quantity,
                                quantity_type: item.quantity_unit
                            }))} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
