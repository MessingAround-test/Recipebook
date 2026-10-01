'use client';

import { useEffect, useState } from 'react';
import { FiActivity, FiRefreshCw } from 'react-icons/fi';
import DayNutrientCoverage from './DayNutrientCoverage';
import { formatShortDate } from '../../lib/dateUtils';
import { NUTRIENT_LABELS } from '../../lib/dailyIntake';
import { MEALS } from './types';
import { usePlanner } from './PlannerContext';

const TABS = [
    { key: 'macro', label: 'Macros' },
    { key: 'mineral', label: 'Minerals' },
    { key: 'vitamin', label: 'Vitamins' },
] as const;

type TabKey = typeof TABS[number]['key'];

function avgPct(rows: { pct: number }[]): number | null {
    if (rows.length === 0) return null;
    return rows.reduce((a, r) => a + r.pct, 0) / rows.length;
}

/**
 * Per-day diet scores tray for the day view. Estimates what the planned meals
 * cover for the visible day only (cheap endpoint, no AI) and shows the
 * familiar macro / mineral / vitamin bars.
 */
export default function DayDietTab({ day }: { day: string }) {
    const { plan } = usePlanner();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<TabKey>('macro');

    const planKey = JSON.stringify(plan);

    useEffect(() => {
        if (!day) return;
        let cancelled = false;
        // Debounce so rapid plan edits / pane swipes don't hammer the endpoint
        const t = setTimeout(() => {
            setLoading(true);
            const token = localStorage.getItem('Token');
            fetch('/api/weeklyPlan/dayCoverage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { edgetoken: token } : {}) },
                body: JSON.stringify({ plan, day })
            })
                .then(r => r.json())
                .then(d => { if (!cancelled && d.success) setData(d); })
                .catch(() => { })
                .finally(() => { if (!cancelled) setLoading(false); });
        }, 600);
        return () => { cancelled = true; clearTimeout(t); };
    }, [day, planKey]);

    const coverage = (data?.dayCoverage || []) as { key: string; label: string; pct: number }[];
    const groupItems = coverage.filter(c => (NUTRIENT_LABELS as any)[c.key]?.group === tab);
    const avg = avgPct(groupItems);
    const tabLabel = TABS.find(t => t.key === tab)?.label || '';

    const plannedMeals = (data?.plannedMeals || []) as { mealType: string }[];
    const emptySlots = MEALS.filter(m => !plannedMeals.some(x => x.mealType === m));

    return (
        <section className="mt-2 glass-card bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/20 p-3 relative z-10">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-emerald-400">
                    <FiActivity /> Day scores · {formatShortDate(day)}
                    {loading && <FiRefreshCw className="animate-spin text-emerald-400/60" size={13} />}
                </h3>
                {avg != null && (
                    <span className={`text-xl font-black ${avg >= 80 ? 'text-emerald-400' : avg >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {Math.round(avg)}%
                    </span>
                )}
            </div>

            <div className="flex gap-1 mb-2 p-1 rounded-xl bg-black/20 border border-white/5">
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

            {!data ? (
                loading ? (
                    <p className="text-xs text-muted-foreground italic">Estimating day coverage…</p>
                ) : (
                    <p className="text-xs text-muted-foreground italic">No coverage data yet.</p>
                )
            ) : groupItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No tracked {tabLabel.toLowerCase()} — set weights on your profile's Health Score settings.</p>
            ) : (
                <DayNutrientCoverage
                    coverage={groupItems}
                    title={`${tabLabel} for this day`}
                    emptySlots={emptySlots}
                />
            )}
        </section>
    );
}
