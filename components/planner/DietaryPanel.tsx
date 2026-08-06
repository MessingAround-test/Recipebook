import { useState } from 'react';
import { FiActivity, FiAlertTriangle, FiRefreshCw, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';

const GROUP_LABELS: Record<string, string> = {
    macro: 'Macros',
    mineral: 'Minerals',
    vitamin: 'Vitamins'
};

const GROUP_ORDER = ['macro', 'mineral', 'vitamin'] as const;

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

function CoverageRow({ item, compact = false }: { item: any; compact?: boolean }) {
    const pct = Math.min(item.pct, 100);
    const label = (
        <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="font-bold text-xs truncate">{item.label}</span>
            <span className={`font-black text-xs shrink-0 ${item.pct < 95 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {Math.round(item.pct)}%
            </span>
        </div>
    );

    if (compact) {
        return (
            <div className="bg-black/20 rounded-lg border border-white/5 p-2">
                {label}
                <div className="h-1.5 rounded-full bg-white/10 mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor(item.pct) }} />
                </div>
                <div className="flex items-center justify-between mt-1 text-[9px] text-muted-foreground">
                    <span>{formatValue(item.value)} {item.unit} / day</span>
                    <span>target {formatValue(item.target)} {item.unit}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 py-1.5">
            <div className="flex-1 min-w-0">
                {label}
                <div className="h-1.5 rounded-full bg-white/10 mt-1 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor(item.pct) }} />
                </div>
            </div>
            <div className="shrink-0 text-right">
                <div className="text-[10px] font-bold text-muted-foreground">
                    {formatValue(item.value)} <span className="opacity-60">/ {formatValue(item.target)} {item.unit}</span>
                </div>
                {item.weight > 0 && (
                    <div className="text-[8px] font-black uppercase tracking-widest text-purple-400/70 mt-0.5">×{item.weight}</div>
                )}
            </div>
        </div>
    );
}

function formatValue(v: number): string {
    if (v == null || !Number.isFinite(v)) return '0';
    return v >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString();
}

export default function DietaryPanel() {
    const { analysis, analyzing, numDays } = usePlanner();
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const coverage = analysis?.nutrientCoverage || [];
    const score = analysis?.projectedScore ?? null;
    const lows = coverage.filter(c => c.pct < 95).slice(0, 5);
    const groups = GROUP_ORDER
        .map(group => ({
            group,
            label: GROUP_LABELS[group],
            items: coverage.filter(c => c.group === group)
        }))
        .filter(g => g.items.length > 0);

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

            {!analysis ? (
                <p className="text-xs text-muted-foreground italic">No meals planned yet — your projected intake will appear here automatically.</p>
            ) : (
                <>
                    {analysis.numMissingSlots > 0 && (
                        <p className="text-[10px] text-muted-foreground italic mb-3">
                            *Includes {analysis.numMissingSlots} unassigned meals calculated at average values.
                        </p>
                    )}

                    {lows.length > 0 ? (
                        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-rose-400 mb-2">
                                <FiAlertTriangle size={12} /> Where you'll be low
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {lows.map(c => (
                                    <CoverageRow key={c.key} item={c} compact />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-emerald-400 font-bold mb-4">
                            Great job! Every tracked nutrient is projected to hit its target.
                        </p>
                    )}

                    <div className="space-y-3">
                        {groups.map(({ group, label, items }) => {
                            const isCollapsed = !!collapsed[group];
                            return (
                                <div key={group} className="rounded-xl border border-white/5 bg-black/20 p-3">
                                    <button
                                        onClick={() => setCollapsed(prev => ({ ...prev, [group]: !prev[group] }))}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            {label}
                                            <span className="ml-1.5 text-muted-foreground/40">({items.length})</span>
                                        </span>
                                        {isCollapsed ? <FiChevronDown size={14} className="text-muted-foreground" /> : <FiChevronUp size={14} className="text-muted-foreground" />}
                                    </button>
                                    {!isCollapsed && (
                                        <div className="mt-1 divide-y divide-white/5">
                                            {items.map(c => (
                                                <CoverageRow key={c.key} item={c} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {coverage.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">
                                No tracked nutrients (all weights are 0 in your settings). Add weights on your profile's Health Score settings to see coverage.
                            </p>
                        )}
                    </div>

                    <p className="text-[9px] text-muted-foreground mt-3 opacity-70 leading-relaxed">
                        Coverage is per person per day vs your personalised targets over the {numDays}-day plan. Weights from your Health Score settings rank importance; nutrients with a weight of 0 are not tracked.
                    </p>
                </>
            )}
        </div>
    );
}
