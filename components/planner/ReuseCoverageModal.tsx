import { useEffect, useState } from 'react';
import { FiX, FiUsers, FiRefreshCw } from 'react-icons/fi';
import { usePlanner } from './PlannerContext';
import { MEALS } from './types';
import { formatShortDate, addDays } from '../../lib/dateUtils';

const MEAL_ABBR: Record<string, string> = { Breakfast: 'B', Lunch: 'L', Dinner: 'D', Snack: 'S' };

/**
 * Copy a prior week's per-meal servings pattern ("who's eating which meal")
 * onto the current week — timing only, never meals or the pantry pool.
 * Lists prior weeks that carry a pattern, previews it as a day × meal grid,
 * and only applies after an explicit Accept.
 */
export default function ReuseCoverageModal() {
    const {
        showReuseCoverage,
        closeReuseCoverage,
        coverageHistory,
        coverageHistoryLoading,
        applyMealCoverage,
        startDate,
        numDays,
        plan
    } = usePlanner();

    const defaultServings = Math.max(1, Math.round(Number(plan?.defaultServings) || 2));

    const [selected, setSelected] = useState<string | null>(null);

    // Default-select the most recent prior pattern whenever the list refreshes
    useEffect(() => {
        if (showReuseCoverage && coverageHistory.length > 0 && !selected) {
            setSelected(coverageHistory[0].startDate);
        }
    }, [showReuseCoverage, coverageHistory, selected]);

    if (!showReuseCoverage) return null;

    const source = coverageHistory.find(w => w.startDate === selected) || null;
    const sourceDays = source
        ? Array.from({ length: Math.min(source.numDays || 7, 14) }, (_, i) => addDays(source.startDate, i))
        : [];
    const applyDays = Math.min(sourceDays.length, numDays);

    return (
        <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200" onMouseDown={closeReuseCoverage}>
            <div
                className="w-full sm:max-w-lg bg-[#121214] border border-white/10 border-b-0 sm:rounded-2xl rounded-t-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar"
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="relative text-center mb-4">
                    <h2 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center justify-center gap-2">
                        <FiUsers size={14} /> Copy servings pattern
                    </h2>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        Timing only — who eats which meal. Meals & pantry stay as they are.
                    </p>
                    <button onClick={closeReuseCoverage} className="absolute right-0 top-0 p-1.5 -mr-1 text-muted-foreground hover:text-white transition-colors" aria-label="Close">
                        <span className="text-lg leading-none">×</span>
                    </button>
                </div>

                {coverageHistoryLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-xs font-bold">
                        <FiRefreshCw size={14} className="animate-spin" /> Loading past weeks…
                    </div>
                ) : coverageHistory.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No earlier weeks with a servings pattern yet. Set one with the <FiUsers size={11} className="inline" /> toggle on any week first.
                    </p>
                ) : (
                    <>
                        {/* Week list */}
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Past weeks</div>
                        <div className="space-y-1 mb-4 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {coverageHistory.map(w => (
                                <button
                                    key={w.startDate}
                                    onClick={() => setSelected(w.startDate)}
                                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${selected === w.startDate ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' : 'bg-white/[0.04] border-white/10 text-muted-foreground hover:text-white hover:bg-white/10'}`}
                                >
                                    Week of {formatShortDate(w.startDate)} · {w.numDays || 7} days
                                </button>
                            ))}
                        </div>

                        {/* Preview grid */}
                        {source && (
                            <>
                                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Preview</div>
                                <div className="rounded-xl border border-white/10 overflow-hidden mb-2">
                                    <div className="grid grid-cols-[1fr_repeat(4,2rem)] bg-black/30 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                                        <div className="px-2 py-1.5">Day</div>
                                        {MEALS.map(m => (
                                            <div key={m} className="px-1 py-1.5 text-center" title={m}>{MEAL_ABBR[m]}</div>
                                        ))}
                                    </div>
                                    {sourceDays.map((day, i) => {
                                        const meals = source.mealCoverage?.[day] || {};
                                        const willApply = i < applyDays;
                                        return (
                                            <div key={day} className={`grid grid-cols-[1fr_repeat(4,2rem)] border-t border-white/5 text-[10px] ${willApply ? '' : 'opacity-40'}`}>
                                                <div className="px-2 py-1.5 font-bold text-muted-foreground truncate">
                                                    {formatShortDate(day)}
                                                    {!willApply && <span className="ml-1 text-[8px] uppercase tracking-wider">(not applied)</span>}
                                                </div>
                                                {MEALS.map(m => {
                                                    const listed = meals[m] != null;
                                                    const value = listed ? Math.max(1, Math.round(Number(meals[m]) || 1)) : defaultServings;
                                                    return (
                                                        <div key={m} className={`px-1 py-1.5 text-center font-black ${listed ? 'text-emerald-300' : 'text-muted-foreground'}`}>
                                                            {value}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-muted-foreground mb-4">
                                    Applies to the first {applyDays} day{applyDays === 1 ? '' : 's'} of this week, matching by position.
                                    Days or meals without a listed value are set to your standard of {defaultServings}, replacing any servings settings already on this week.
                                </p>
                            </>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => source && applyMealCoverage(source)}
                                disabled={!source}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-40"
                            >
                                Apply pattern
                            </button>
                            <button
                                onClick={closeReuseCoverage}
                                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground text-xs font-bold"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
