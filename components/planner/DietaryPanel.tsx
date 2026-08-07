import { useMemo, useState } from 'react';
import { FiActivity, FiRefreshCw, FiZap } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';

const TABS = [
    { key: 'macro', label: 'Macros' },
    { key: 'mineral', label: 'Minerals' },
    { key: 'vitamin', label: 'Vitamins' },
] as const;

function barColor(pct: number): string {
    if (pct >= 100) return '#10b981';
    if (pct >= 80) return '#f59e0b';
    return '#f43f5e';
}

function scoreColor(score: number | null | undefined): string {
    if (score == null) return 'text-muted-foreground';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-rose-400';
}

export default function DietaryPanel() {
    const { analysis, analyzing, openModal, addSuggestedIngredient } = usePlanner();
    const [tab, setTab] = useState<'macro' | 'mineral' | 'vitamin'>('macro');

    const coverage = analysis?.nutrientCoverage || [];
    const score = analysis?.projectedScore ?? null;
    const groupItems = useMemo(() => coverage.filter(c => c.group === tab), [coverage, tab]);
    const lows = groupItems.filter(c => c.pct < 95);

    // DB-backed suggestions for the low nutrients in the active tab.
    const suggestions = useMemo(() => {
        if (!analysis?.suggestions?.length) return [];
        const lowKeys = new Set(groupItems.filter(c => c.pct < 95).map(c => c.key));
        return (analysis.suggestions || []).filter(s => lowKeys.has(s.key));
    }, [analysis, groupItems]);

    const tabLabel = TABS.find(t => t.key === tab)?.label || '';

    return (
        <div className="glass-card bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/20 relative z-10 p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-emerald-400">
                    <FiActivity /> Weeklong Dietary Requirements
                    {analyzing && <FiRefreshCw className="animate-spin text-emerald-400/60" size={14} />}
                </h3>
                {score != null && (
                    <div className={`text-2xl font-black ${scoreColor(score)}`} title="Projected coverage vs recommended intake (per person per day)">
                        {score}%
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-3 p-1 rounded-xl bg-black/20 border border-white/5">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex-1 text-[10px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg transition-all ${tab === t.key
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {!analysis ? (
                <p className="text-xs text-muted-foreground italic">No meals planned yet — your projected intake will appear here automatically.</p>
            ) : groupItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No tracked {tabLabel.toLowerCase()} — set weights on your profile's Health Score settings.</p>
            ) : (
                <>
                    {lows.length === 0 ? (
                        <p className="text-xs text-emerald-400 font-bold mb-2">All {tabLabel.toLowerCase()} are on track.</p>
                    ) : (
                        <p className="text-xs text-amber-400/90 font-bold mb-2">
                            {lows.length} {lows.length === 1 ? 'nutrient' : 'nutrients'} projected low in {tabLabel.toLowerCase()}.
                        </p>
                    )}

                    {/* Compact rows */}
                    <div className="space-y-0.5">
                        {groupItems.map(item => (
                            <div key={item.key} className="flex items-center gap-2 py-0.5">
                                <span className={`w-24 shrink-0 font-bold text-xs truncate ${item.pct < 95 ? 'text-amber-300' : 'text-muted-foreground'}`}>
                                    {item.label}
                                </span>
                                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: barColor(item.pct) }} />
                                </div>
                                <span className={`w-10 shrink-0 text-right font-black text-xs ${item.pct < 95 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {Math.round(item.pct)}%
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">
                                <FiZap size={12} /> Suggestions
                            </div>
                            <div className="space-y-2">
                                {suggestions.map(s => (
                                    <div key={s.key} className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-amber-300">{s.label}</span>
                                            <span className="text-[10px] text-muted-foreground">{Math.round(s.pct)}% of target</span>
                                        </div>
                                        {s.foods.length > 0 && (
                                            <>
                                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-2 mb-1">Add more of these</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {s.foods.map(f => (
                                                        <button
                                                            key={f.name}
                                                            onClick={() => addSuggestedIngredient(f.name)}
                                                            title="Add 100g/day to pantry"
                                                            className="text-[10px] font-bold bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 rounded-md px-1.5 py-0.5 text-muted-foreground hover:text-emerald-300 transition-colors"
                                                        >
                                                            {f.name} <span className="text-emerald-400">+{Math.round(f.pct)}%</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                        {s.recipes.length > 0 && (
                                            <>
                                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-2 mb-1">From your recipes</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {s.recipes.map(r => (
                                                        <button
                                                            key={r._id}
                                                            onClick={() => openModal(false, null, r.name)}
                                                            title={`Browse "${r.name}"`}
                                                            className="flex items-center gap-1.5 text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/20 rounded-md px-2 py-1 transition-colors"
                                                        >
                                                            {r.name}
                                                            <span className="bg-emerald-500/20 text-emerald-300 rounded px-1 py-0.5">{Math.round(r.pct)}%</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                        {(s.foods.length > 0 || s.recipes.length > 0) && (
                                            <p className="text-[9px] text-muted-foreground/70 mt-1.5">Recipe % = share of the period's total target; food % = daily target per 100g.</p>
                                        )}
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
