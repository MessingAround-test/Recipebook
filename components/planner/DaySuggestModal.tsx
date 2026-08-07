import { useMemo, useState } from 'react';
import { FiX, FiZap, FiPlus, FiCheck, FiEye, FiEyeOff } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import { formatShortDate } from '../../lib/dateUtils';
import { DaySuggestion } from './types';
import DayNutrientCoverage from './DayNutrientCoverage';

const TIME_OPTIONS = [
    { value: 'short', label: 'Zap', desc: 'under 30m' },
    { value: 'medium', label: 'Standard', desc: '30–60m' },
    { value: 'long', label: 'Slow', desc: '60m+' },
];

// Distinct colours, one per suggestion, so projected increases are easy to tell apart.
const SUGGEST_COLORS = ['#38bdf8', '#fb923c', '#a78bfa', '#f472b6'];
// Colour used for a freshly generated recipe's preview.
const GENERATED_COLOR = '#c084fc';

const REQUIREMENT_PRESETS = [
    'High protein',
    'Quick one-pan',
    'Use tofu',
    'No onion or garlic',
    'Spicy',
    'Kid friendly',
    'Meal-prep friendly',
    'Low carb',
    'Use up leftover rice',
];

type PreviewTarget = number | 'generated' | null;

export default function DaySuggestModal() {
    const {
        suggestDay,
        suggestData,
        suggesting,
        suggestError,
        generatingRecipe,
        generatedRecipe,
        generateCoverArt,
        setGenerateCoverArt,
        closeDaySuggest,
        addDaySuggestion,
        addAllDaySuggestions,
        generateRecipe,
        addGeneratedRecipe
    } = usePlanner();

    const [timePref, setTimePref] = useState('medium');
    const [requirement, setRequirement] = useState('');
    const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
    const [previewIdx, setPreviewIdx] = useState<PreviewTarget>(null);

    const recommendations = suggestData?.recommendations || [];
    const coverage = suggestData?.dayCoverage || [];

    const markAdded = (key: string) => {
        setAddedKeys(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    };

    const keyFor = (s: DaySuggestion) => s.type === 'pantry' ? `pantry:${s.pantryName}` : `recipe:${s.recipe?._id}`;

    const handleAddSuggestion = (s: DaySuggestion) => {
        addDaySuggestion(s);
        markAdded(keyFor(s));
    };

    const handleAddAll = () => {
        addAllDaySuggestions();
        setAddedKeys(prev => {
            const next = new Set(prev);
            recommendations.forEach(s => next.add(keyFor(s)));
            return next;
        });
    };

    const lows = coverage.filter(c => c.pct < 95);
    const lowKeySet = useMemo(() => new Set(lows.map(c => c.key)), [lows]);

    // Impact score: how much this suggestion lifts the day, weighted toward
    // nutrients currently running low. The top suggestion gets a "Best" badge.
    const impacts = useMemo(() => {
        return recommendations.map(s => (s.nutrientDelta || []).reduce(
            (sum, d) => sum + d.pct * (lowKeySet.has(d.key) ? 2 : 1),
            0
        ));
    }, [recommendations, lowKeySet]);
    const bestIdx = useMemo(() => {
        if (impacts.length === 0) return null;
        const max = Math.max(...impacts);
        return max > 0 ? impacts.indexOf(max) : null;
    }, [impacts]);

    const previewIsGenerated = previewIdx === 'generated';
    const previewSugg = typeof previewIdx === 'number' ? recommendations[previewIdx] : null;
    const previewColor = previewIsGenerated
        ? GENERATED_COLOR
        : (previewIdx != null ? SUGGEST_COLORS[(previewIdx as number) % SUGGEST_COLORS.length] : null);
    const previewDeltaByKey = useMemo(() => {
        const map: Record<string, number> = {};
        const source = previewIsGenerated ? generatedRecipe?.nutrientDelta : previewSugg?.nutrientDelta;
        (source || []).forEach(d => { map[d.key] = d.pct; });
        return map;
    }, [previewIsGenerated, generatedRecipe, previewSugg]);
    const previewLabel = previewIsGenerated
        ? generatedRecipe?.name
        : (previewSugg ? (previewSugg.type === 'pantry' ? previewSugg.pantryName : previewSugg.recipe?.name) : null);

    if (!suggestDay) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-black tracking-widest uppercase flex items-center gap-2">
                        <FiZap className="text-emerald-400" /> AI Day Fill
                        <span className="text-sm font-bold text-muted-foreground normal-case tracking-normal">{formatShortDate(suggestDay)}</span>
                    </h2>
                    <button onClick={closeDaySuggest} className="p-2 text-muted-foreground hover:text-white transition-colors">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-5">
                    {suggestError && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-bold">
                            {suggestError}
                        </div>
                    )}

                    {suggesting ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Finding good fits for this day…</p>
                        </div>
                    ) : suggestData && (
                        <>
                            {/* Day nutrient snapshot + preview */}
                            <DayNutrientCoverage
                                coverage={coverage}
                                emptySlots={suggestData.emptySlots}
                                previewLabel={previewLabel}
                                previewColor={previewColor}
                                previewDeltaByKey={previewDeltaByKey}
                            />

                            {/* AI recommendations */}
                            <section>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5">
                                    <FiZap size={12} /> Suggested to add
                                </h3>
                                {recommendations.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-muted-foreground italic">
                                        No great matches found — try generating a brand-new recipe below.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {recommendations.map((s, idx) => {
                                            const key = keyFor(s);
                                            const added = addedKeys.has(key);
                                            const color = SUGGEST_COLORS[idx % SUGGEST_COLORS.length];
                                            const previewing = previewIdx === idx;
                                            const isBest = bestIdx === idx;
                                            return (
                                                <div
                                                    key={key}
                                                    className="flex items-start justify-between gap-2 rounded-lg border p-2.5 transition-all"
                                                    style={{
                                                        borderColor: previewing ? color : (s.type === 'pantry' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.1)'),
                                                        backgroundColor: previewing ? `${color}14` : (s.type === 'pantry' ? 'rgba(251,191,36,0.05)' : 'rgba(255,255,255,0.03)'),
                                                        boxShadow: previewing ? `0 0 0 1px ${color}55` : 'none'
                                                    }}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 text-xs font-black">
                                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                            <span className="truncate">{s.type === 'pantry' ? s.pantryName : s.recipe?.name}</span>
                                                            {s.type === 'pantry' ? (
                                                                <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                                    Pantry · {s.quantity || 100}g/day
                                                                </span>
                                                            ) : (
                                                                <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                                    {s.mealSlot}
                                                                </span>
                                                            )}
                                                            {isBest && (
                                                                <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                                                                    ★ Best
                                                                </span>
                                                            )}
                                                        </div>
                                                        {s.reason && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.reason}</p>}
                                                        {s.type === 'recipe' && (s.recipe?.carbType || s.recipe?.genre) && (
                                                            <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wider font-bold mt-0.5">
                                                                {[s.recipe?.genre, s.recipe?.carbType].filter(Boolean).join(' • ')}
                                                            </p>
                                                        )}
                                                        {s.nutrientDelta && s.nutrientDelta.length > 0 && (
                                                            <p className="text-[9px] text-muted-foreground/70 mt-0.5 flex flex-wrap gap-x-2">
                                                                <span className="uppercase tracking-wider font-bold">Boosts:</span>
                                                                {s.nutrientDelta.slice(0, 4).map(d => (
                                                                    <span key={d.key}>
                                                                        {d.label} <span style={{ color }}>+{Math.round(d.pct)}%</span>
                                                                    </span>
                                                                ))}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        <button
                                                            onClick={() => handleAddSuggestion(s)}
                                                            disabled={added}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${added
                                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                                : s.type === 'pantry'
                                                                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
                                                                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'}`}
                                                        >
                                                            {added ? <FiCheck size={11} /> : <FiPlus size={11} />}
                                                            {added ? 'Added' : s.type === 'pantry' ? `${s.quantity || 100}g/day` : `Add → ${s.mealSlot}`}
                                                        </button>
                                                        <button
                                                            onClick={() => setPreviewIdx(previewing ? null : idx)}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors`}
                                                            style={{
                                                                backgroundColor: previewing ? `${color}22` : 'rgba(255,255,255,0.05)',
                                                                color: previewing ? color : '#a1a1aa'
                                                            }}
                                                        >
                                                            {previewing ? <FiEyeOff size={10} /> : <FiEye size={10} />}
                                                            {previewing ? 'Hide' : 'Preview'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {recommendations.length > 1 && (
                                            <button
                                                onClick={handleAddAll}
                                                className="w-full rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-black uppercase tracking-widest py-2 transition-colors"
                                            >
                                                Add all ({recommendations.length})
                                            </button>
                                        )}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {/* Generate a new recipe */}
                    <section className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-3 flex items-center gap-1.5">
                            ✨ Don't like the picks? Generate a new recipe
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                            <div className="flex-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">How long do you want to cook?</p>
                                <div className="flex gap-1 p-1 rounded-xl bg-black/20 border border-white/5">
                                    {TIME_OPTIONS.map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setTimePref(t.value)}
                                            className={`flex-1 flex flex-col items-center rounded-lg px-2 py-1.5 transition-all ${timePref === t.value
                                                ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30'
                                                : 'text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent'}`}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-wider">{t.label}</span>
                                            <span className="text-[8px] opacity-70">{t.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground cursor-pointer select-none shrink-0">
                                <input
                                    type="checkbox"
                                    checked={generateCoverArt}
                                    onChange={(e) => setGenerateCoverArt(e.target.checked)}
                                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-purple-500 focus:ring-purple-500/50"
                                />
                                Cover art
                            </label>
                            <button
                                onClick={() => generateRecipe(timePref, requirement.trim() || undefined)}
                                disabled={generatingRecipe}
                                className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-black text-xs bg-purple-500 hover:bg-purple-600 text-white transition-colors disabled:opacity-50"
                            >
                                {generatingRecipe && !generatedRecipe ? (
                                    <>
                                        <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                                        Creating…
                                    </>
                                ) : (
                                    <>✨ {generatedRecipe ? 'Generate another' : 'Generate recipe'}</>
                                )}
                            </button>
                        </div>

                        {/* Tiny requirement input (dropdown of presets + free text) */}
                        <div className="mt-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Extra requirement (optional)</p>
                            <div className="relative">
                                <input
                                    type="text"
                                    list="generate-requirements"
                                    value={requirement}
                                    onChange={(e) => setRequirement(e.target.value)}
                                    placeholder="e.g. high protein, use tofu, no onion…"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-colors"
                                />
                                <datalist id="generate-requirements">
                                    {REQUIREMENT_PRESETS.map(r => (
                                        <option key={r} value={r} />
                                    ))}
                                </datalist>
                                {requirement && (
                                    <button
                                        onClick={() => setRequirement('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors text-[10px]"
                                        title="Clear requirement"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {generatingRecipe && generatedRecipe && (
                            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-400" /> Generating cover art…
                            </div>
                        )}

                        {generatedRecipe && (
                            <div
                                className="mt-3 rounded-lg border p-3 transition-all"
                                style={{
                                    borderColor: previewIsGenerated ? GENERATED_COLOR : 'rgba(192,132,252,0.3)',
                                    backgroundColor: previewIsGenerated ? `${GENERATED_COLOR}14` : 'rgba(168,85,247,0.1)',
                                    boxShadow: previewIsGenerated ? `0 0 0 1px ${GENERATED_COLOR}55` : 'none'
                                }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 text-sm font-black">
                                            <span className="truncate">{generatedRecipe.name}</span>
                                            <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200 border border-purple-500/40">
                                                {generatedRecipe.suggestedSlot}
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mt-1">
                                            {[generatedRecipe.time, generatedRecipe.genre, generatedRecipe.carbType].filter(Boolean).join(' • ')} • {generatedRecipe.servings} servings
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/90 mt-1.5 leading-tight">
                                            {(generatedRecipe.ingredients || []).map(i => i.Name).filter(Boolean).join(', ')}
                                        </p>
                                        {generatedRecipe.nutrientDelta && generatedRecipe.nutrientDelta.length > 0 && (
                                            <p className="text-[9px] text-muted-foreground/70 mt-1.5 flex flex-wrap gap-x-2">
                                                <span className="uppercase tracking-wider font-bold">Boosts:</span>
                                                {generatedRecipe.nutrientDelta.slice(0, 4).map(d => (
                                                    <span key={d.key}>
                                                        {d.label} <span style={{ color: GENERATED_COLOR }}>+{Math.round(d.pct)}%</span>
                                                    </span>
                                                ))}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setPreviewIdx(previewIsGenerated ? null : 'generated')}
                                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors"
                                        style={{
                                            backgroundColor: previewIsGenerated ? `${GENERATED_COLOR}22` : 'rgba(255,255,255,0.05)',
                                            color: previewIsGenerated ? GENERATED_COLOR : '#a1a1aa'
                                        }}
                                    >
                                        {previewIsGenerated ? <FiEyeOff size={10} /> : <FiEye size={10} />}
                                        {previewIsGenerated ? 'Hide' : 'Preview'}
                                    </button>
                                </div>
                                <button
                                    onClick={addGeneratedRecipe}
                                    disabled={generatingRecipe}
                                    className="mt-3 w-full rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-[11px] font-black uppercase tracking-widest py-2 transition-colors disabled:opacity-50"
                                >
                                    Save to recipes & add to {generatedRecipe.suggestedSlot}
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
