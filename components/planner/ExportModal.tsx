import { useMemo, useState } from 'react';
import { FiX, FiShoppingCart, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { usePlanner } from './PlannerContext';
import { formatShortDate } from '../../lib/dateUtils';
import { MEALS, PlannedRecipeItem } from './types';

interface Cutoff {
    day: string | null;
    meal: string | null;
}

const MEAL_ORDER = MEALS as readonly string[]; // Breakfast, Lunch, Dinner, Snack

// Mirrors the server-side cutoff rule: blocks strictly after the chosen
// day+meal are exported; leftover blocks and already-covered blocks are not.
function isBlockAfterCutoff(block: PlannedRecipeItem, cutoff: Cutoff): boolean {
    if (block.isLeftover) return false;
    if (!cutoff.day || !cutoff.meal) return true;
    const day = String(block.day || 'Undecided');
    if (day === 'Undecided') return true;
    if (day > cutoff.day) return true;
    if (day < cutoff.day) return false;
    const mealIdx = MEAL_ORDER.indexOf(String(block.mealType || 'Dinner'));
    const cutoffIdx = MEAL_ORDER.indexOf(cutoff.meal);
    return (mealIdx === -1 ? 3 : mealIdx) > (cutoffIdx === -1 ? 0 : cutoffIdx);
}

// Mirrors the server-side aggregation: planned blocks are grouped per recipe;
// leftover servings are bundled with the base cook only when the base block is
// inside the export window (earlier cooks' leftovers need nothing new).
function aggregateExport(plan: any, cutoff: Cutoff) {
    const needs = new Map<string, { baseServings: number; leftoverServings: number }>();
    const blocks: PlannedRecipeItem[] = (plan?.plannedRecipes || []).filter((b: PlannedRecipeItem) => !!b.recipe_id);
    let skippedCutoffBlocks = 0;
    for (const b of blocks) {
        if (b.isLeftover) continue;
        if (!isBlockAfterCutoff(b, cutoff)) { skippedCutoffBlocks++; continue; }
        const key = String(b.recipe_id);
        const entry = needs.get(key) || { baseServings: 0, leftoverServings: 0 };
        entry.baseServings += Number(b.servings) || 0;
        needs.set(key, entry);
    }
    let leftoverIncludedBlocks = 0;
    let leftoverSkippedBlocks = 0;
    for (const b of blocks) {
        if (!b.isLeftover) continue;
        const entry = needs.get(String(b.recipe_id));
        if (entry && entry.baseServings > 0) {
            entry.leftoverServings += Number(b.servings) || 0;
            leftoverIncludedBlocks++;
        } else {
            leftoverSkippedBlocks++;
        }
    }
    let recipesIncluded = 0;
    needs.forEach(e => { if (e.baseServings + e.leftoverServings > 0) recipesIncluded++; });
    return { recipesIncluded, leftoverIncludedBlocks, leftoverSkippedBlocks, skippedCutoffBlocks };
}

export default function ExportModal() {
    const {
        showExportModal,
        closeExportModal,
        runExport,
        exporting,
        plan,
        dates
    } = usePlanner();

    const [cutoff, setCutoff] = useState<Cutoff>({ day: null, meal: null });

    const summary = useMemo(() => {
        if (!plan) return { recipesIncluded: 0, leftoverIncludedBlocks: 0, leftoverSkippedBlocks: 0, skippedCutoffBlocks: 0 };
        return aggregateExport(plan, cutoff);
    }, [plan, cutoff]);

    if (!showExportModal) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-md flex flex-col shadow-2xl">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-black tracking-widest uppercase flex items-center gap-2">
                        <FiShoppingCart className="text-blue-400" /> Export Shopping List
                    </h2>
                    <button onClick={closeExportModal} className="p-2 text-muted-foreground hover:text-white transition-colors">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-5">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">
                            I have ingredients up to…
                        </label>
                        <div className="space-y-1.5">
                            <button
                                onClick={() => setCutoff({ day: null, meal: null })}
                                className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-bold transition-colors ${!cutoff.day
                                    ? 'bg-blue-500/15 border-blue-500/50 text-blue-200'
                                    : 'bg-white/[0.03] border-white/10 hover:border-white/20 text-muted-foreground'}`}
                            >
                                <FiCheck size={12} className={cutoff.day ? 'opacity-0' : 'text-blue-400'} />
                                Nothing yet — export the whole plan
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">…up to</span>
                                <select
                                    value={cutoff.day || ''}
                                    onChange={(e) => setCutoff(c => ({ ...c, day: e.target.value || null, meal: e.target.value ? c.meal : null }))}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500/40"
                                >
                                    <option value="" disabled>
                                        {dates.length ? `pick a day (${formatShortDate(dates[0])} →)` : 'pick a day'}
                                    </option>
                                    {dates.map(d => (
                                        <option key={d} value={d}>{formatShortDate(d)}</option>
                                    ))}
                                </select>
                                <select
                                    value={cutoff.meal || ''}
                                    onChange={(e) => setCutoff(c => ({ ...c, meal: e.target.value || null }))}
                                    disabled={!cutoff.day}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500/40 disabled:opacity-40"
                                >
                                    <option value="" disabled>meal</option>
                                    {MEAL_ORDER.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 space-y-1 text-[11px] font-bold">
                        <div className="flex items-center justify-between text-blue-300">
                            <span>Total pool items (always in full)</span>
                            <span>{plan?.everydayItems?.length || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-400">
                            <span>Recipes to buy for</span>
                            <span>{summary.recipesIncluded}</span>
                        </div>
                        {summary.leftoverIncludedBlocks > 0 && (
                            <div className="flex items-center justify-between text-emerald-400/80">
                                <span>Leftover blocks covered by the cook</span>
                                <span>{summary.leftoverIncludedBlocks}</span>
                            </div>
                        )}
                        {summary.skippedCutoffBlocks > 0 && (
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span>Skipped (already have ingredients)</span>
                                <span>{summary.skippedCutoffBlocks}</span>
                            </div>
                        )}
                        {summary.leftoverSkippedBlocks > 0 && (
                            <div className="flex items-center justify-between text-amber-400">
                                <span>Leftover blocks skipped (base already cooked)</span>
                                <span>{summary.leftoverSkippedBlocks}</span>
                            </div>
                        )}
                    </div>

                    {summary.leftoverSkippedBlocks > 0 && (
                        <p className="flex items-start gap-1.5 text-[10px] text-amber-400/80 leading-tight">
                            <FiAlertCircle size={12} className="shrink-0 mt-0.5" />
                            Leftover servings whose base cook isn&apos;t in this export need no new ingredients.
                        </p>
                    )}
                    {cutoff.day && !cutoff.meal && (
                        <p className="flex items-start gap-1.5 text-[10px] text-blue-300/80 leading-tight">
                            <FiAlertCircle size={12} className="shrink-0 mt-0.5" />
                            Pick a meal to activate the cutoff — exporting the whole plan for now.
                        </p>
                    )}
                </div>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={() => runExport(cutoff.day, cutoff.meal)}
                        disabled={exporting}
                        className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                        <FiShoppingCart /> {exporting ? 'Exporting…' : 'Export list'}
                    </button>
                </div>
            </div>
        </div>
    );
}
