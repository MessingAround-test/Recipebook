import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiX, FiZap, FiPlus, FiCheck, FiEye, FiEyeOff, FiRefreshCw } from 'react-icons/fi';
import { saveRecipe } from '../lib/recipeExtraction';
import { formatShortDate } from '../lib/dateUtils';
import DayNutrientCoverage from './planner/DayNutrientCoverage';

// Distinct soft kitchen inks, one per suggestion, so projected increases
// are easy to tell apart. rgb(var(--x)) keeps them theme-reactive.
const SUGGEST_COLORS = ['rgb(var(--terracotta))', 'rgb(var(--olive))', 'rgb(var(--butter))', 'rgb(var(--plum))'];
const GENERATED_COLOR = 'rgb(var(--plum))';

type Suggestion = {
    type: 'pantry' | 'recipe';
    pantryName?: string;
    recipe?: any;
    quantity?: number;
    mealSlot?: string | null;
    reason?: string;
    nutrientDelta?: { key: string; label: string; pct: number }[];
};

interface Props {
    open: boolean;
    onClose: () => void;
    date: string;
    onLogged: () => void;
}

export default function RoundOutModal({ open, onClose, date, onLogged }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
    const [excludeMeat, setExcludeMeat] = useState(true);
    const [requirement, setRequirement] = useState('');
    const [generating, setGenerating] = useState(false);
    const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
    const [generatedLogged, setGeneratedLogged] = useState(false);
    const [previewIdx, setPreviewIdx] = useState<number | 'generated' | null>(null);

    const load = useCallback(async () => {
        const token = localStorage.getItem('Token');
        if (!token) return;
        setLoading(true);
        setError(null);
        setAddedKeys(new Set());
        setGeneratedRecipe(null);
        setGeneratedLogged(false);
        setPreviewIdx(null);
        setRequirement('');
        try {
            const res = await fetch('/api/dailyLog/roundOut', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', edgetoken: token },
                body: JSON.stringify({ date, excludeMeat })
            });
            const result = await res.json();
            if (result.success) setData(result);
            else setError(result.message || 'Failed to load suggestions');
        } catch (e: any) {
            setError(e?.message || 'Failed to load suggestions');
        } finally {
            setLoading(false);
        }
    }, [date, excludeMeat]);

    useEffect(() => {
        if (open) load();
    }, [open, load]);

    const recommendations: Suggestion[] = data?.recommendations || [];
    const lowNutrients = data?.lowNutrients || [];
    const coverage = data?.dayCoverage || [];
    const sortedCoverage = useMemo(() => [...coverage].sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)), [coverage]);
    const lowKeySet = useMemo(() => new Set(lowNutrients.map(c => c.key)), [lowNutrients]);

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

    const keyFor = (s: Suggestion) => s.type === 'pantry' ? `pantry:${s.pantryName}` : `recipe:${s.recipe?._id}`;

    const logToToday = async (body: any) => {
        const token = localStorage.getItem('Token');
        if (!token) return;
        const res = await fetch('/api/dailyLog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', edgetoken: token },
            body: JSON.stringify({ date, ...body })
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message || 'Failed to log food');
    };

    const handleAdd = async (s: Suggestion) => {
        const key = keyFor(s);
        if (addedKeys.has(key)) return;
        try {
            if (s.type === 'pantry' && s.pantryName) {
                await logToToday({
                    type: 'ingredient',
                    name: s.pantryName,
                    quantity: s.quantity || 100,
                    quantity_unit: 'gram'
                });
            } else if (s.type === 'recipe' && s.recipe) {
                await logToToday({
                    type: 'recipe',
                    name: s.recipe.name,
                    recipe_id: s.recipe._id,
                    quantity: 1
                });
            }
            setAddedKeys(prev => { const next = new Set(prev); next.add(key); return next; });
            onLogged();
        } catch (e: any) {
            setError(e?.message || 'Failed to log food');
        }
    };

    const handleGenerate = async () => {
        const token = localStorage.getItem('Token');
        if (!token || generating) return;
        setGenerating(true);
        setError(null);
        setGeneratedRecipe(null);
        setGeneratedLogged(false);
        try {
            const res = await fetch('/api/dailyLog/roundOutGenerate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', edgetoken: token },
                body: JSON.stringify({ date, excludeMeat, requirement: requirement.trim() || undefined })
            });
            const result = await res.json();
            if (result.success) setGeneratedRecipe({ ...result.recipe, nutrientDelta: result.nutrientDelta });
            else setError(result.message || 'Failed to generate recipe');
        } catch (e: any) {
            setError(e?.message || 'Failed to generate recipe');
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveGenerated = async () => {
        if (!generatedRecipe || generatedLogged) return;
        setGenerating(true);
        try {
            const saved = await saveRecipe({
                name: generatedRecipe.name,
                ingreds: generatedRecipe.ingredients || [],
                instructions: generatedRecipe.instructions || [],
                time: generatedRecipe.time,
                genre: generatedRecipe.genre,
                mealTypes: generatedRecipe.mealTypes,
                carbType: generatedRecipe.carbType,
                servings: generatedRecipe.servings || 1,
                hidden: true
            });
            await logToToday({
                type: 'recipe',
                name: saved.name || generatedRecipe.name,
                recipe_id: saved._id,
                quantity: 1
            });
            setGeneratedLogged(true);
            onLogged();
        } catch (e: any) {
            setError(e?.message || 'Failed to save & log recipe');
        } finally {
            setGenerating(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-black tracking-widest uppercase flex items-center gap-2 min-w-0">
                        <FiZap className="text-olive shrink-0" /> Round Out Today
                        <span className="text-sm font-bold text-muted-foreground normal-case tracking-normal truncate">{formatShortDate(date)}</span>
                    </h2>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setExcludeMeat(v => !v)}
                            title={excludeMeat ? 'All suggestions are meat-free (tap to include meat)' : 'Meat allowed (tap to exclude meat)'}
                            className={`flex items-center gap-1 px-2.5 py-1 min-h-[36px] rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${excludeMeat
                                ? 'bg-olive/15 text-olive border-olive/30'
                                : 'bg-foreground/5 text-muted-foreground border-transparent hover:text-foreground'}`}
                        >
                            <FiZap size={10} /> {excludeMeat ? 'No meat' : 'Meat ok'}
                        </button>
                        <button onClick={onClose} className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                            <FiX size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-5">
                    {error && (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-bold">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-olive"></div>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Scanning today's intake…</p>
                        </div>
                    ) : data && (
                        <>
                            {/* Today's low nutrients snapshot + preview overlay */}
                            <DayNutrientCoverage
                                coverage={sortedCoverage}
                                title="Today's gaps"
                                previewLabel={previewLabel}
                                previewColor={previewColor}
                                previewDeltaByKey={previewDeltaByKey}
                                maxItems={8}
                            />
                            {lowNutrients.length > 0 && (
                                <p className="text-[10px] text-butter font-bold -mt-3">
                                    {lowNutrients.length} {lowNutrients.length === 1 ? 'nutrient' : 'nutrients'} low right now.
                                </p>
                            )}

                            {/* Suggestions */}
                            <section>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-olive mb-2 flex items-center gap-1.5">
                                    <FiZap size={12} /> Quick ways to round it out
                                </h3>
                                {recommendations.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground italic">
                                        No matches found — try generating a 5-minute recipe below.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {recommendations.map((s, idx) => {
                                            const key = keyFor(s);
                                            const added = addedKeys.has(key);
                                            const color = SUGGEST_COLORS[idx % SUGGEST_COLORS.length];
                                            const isBest = bestIdx === idx;
                                            const previewing = previewIdx === idx;
                                            return (
                                                <div
                                                    key={key}
                                                    className="flex items-start justify-between gap-2 rounded-lg border p-2.5 transition-all"
                                                    style={{
                                                        borderColor: previewing ? color : (s.type === 'pantry' ? 'rgb(var(--butter) / 0.35)' : 'var(--border)'),
                                                        backgroundColor: previewing
                                                            ? `color-mix(in srgb, ${color} 10%, transparent)`
                                                            : (s.type === 'pantry' ? 'rgb(var(--butter) / 0.08)' : 'rgb(var(--foreground) / 0.04)'),
                                                        boxShadow: previewing ? `0 0 0 1px ${color}` : 'none'
                                                    }}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 text-xs font-black flex-wrap">
                                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                            <span className="truncate">{s.type === 'pantry' ? s.pantryName : s.recipe?.name}</span>
                                                            {s.type === 'pantry' ? (
                                                                <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-butter/20 text-butter border border-butter/40">
                                                                    {s.quantity || 100}g
                                                                </span>
                                                            ) : (
                                                                <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-olive/20 text-olive border border-olive/40">
                                                                    {s.mealSlot}
                                                                </span>
                                                            )}
                                                            {s.type === 'recipe' && (s.recipe?.time === 'short' || (s.recipe?.ingredientCount || 0) <= 6) && (
                                                                <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-water/20 text-water border border-water/40">
                                                                    Easy
                                                                </span>
                                                            )}
                                                            {isBest && (
                                                                <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-butter/25 text-butter border border-butter/50">
                                                                    ★ Best
                                                                </span>
                                                            )}
                                                        </div>
                                                        {s.reason && <p className="hidden sm:block text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.reason}</p>}
                                                        {s.nutrientDelta && s.nutrientDelta.length > 0 && (
                                                            <p className="hidden sm:flex text-[9px] text-muted-foreground/70 mt-0.5 flex-wrap gap-x-2">
                                                                <span className="uppercase tracking-wider font-bold">Boosts:</span>
                                                                {s.nutrientDelta.slice(0, 4).map(d => (
                                                                    <span key={d.key}>
                                                                        {d.label} <span style={{ color }}>+{Math.round(d.pct)}%</span>
                                                                    </span>
                                                                ))}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-row items-center sm:flex-col sm:items-end gap-1 shrink-0">
                                                        <button
                                                            onClick={() => handleAdd(s)}
                                                            disabled={added}
                                                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${added
                                                                ? 'bg-olive/20 text-olive'
                                                                : s.type === 'pantry'
                                                                    ? 'bg-butter/20 hover:bg-butter/30 text-butter'
                                                                    : 'bg-olive/20 hover:bg-olive/30 text-olive'}`}
                                                        >
                                                            {added ? <FiCheck size={11} /> : <FiPlus size={11} />}
                                                            {added ? 'Logged' : 'Log it'}
                                                        </button>
                                                        <button
                                                            onClick={() => setPreviewIdx(previewing ? null : idx)}
                                                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors"
                                                            style={{
                                                                backgroundColor: previewing ? `color-mix(in srgb, ${color} 15%, transparent)` : 'rgb(var(--foreground) / 0.06)',
                                                                color: previewing ? color : 'var(--muted-foreground)'
                                                            }}
                                                        >
                                                            {previewing ? <FiEyeOff size={10} /> : <FiEye size={10} />}
                                                            {previewing ? 'Hide' : 'Preview'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {/* Generate a 5-minute recipe */}
                    <section className="rounded-xl border border-plum/25 bg-plum/10 p-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-plum mb-3 flex items-center gap-1.5">
                            ✨ Don't like the picks? Generate a 5-minute recipe
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={requirement}
                                    onChange={(e) => setRequirement(e.target.value)}
                                    placeholder="Extra requirement (optional) — e.g. high protein, no onion…"
                                    className="w-full bg-foreground/5 border border-border rounded-lg px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-plum/50 focus:ring-1 focus:ring-plum/25 transition-colors"
                                />
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-black text-xs bg-plum/20 hover:bg-plum/30 border border-plum/40 text-plum transition-colors disabled:opacity-50"
                            >
                                {generating && !generatedRecipe ? (
                                    <>
                                        <FiRefreshCw className="animate-spin" size={12} /> Creating…
                                    </>
                                ) : (
                                    <>✨ {generatedRecipe ? 'Generate another' : 'Generate recipe'}</>
                                )}
                            </button>
                        </div>

                        {generatedRecipe && (
                            <div
                                className="mt-3 rounded-lg border p-3 transition-all"
                                style={{
                                    borderColor: previewIsGenerated ? GENERATED_COLOR : 'rgb(var(--plum) / 0.35)',
                                    backgroundColor: previewIsGenerated
                                        ? `color-mix(in srgb, ${GENERATED_COLOR} 10%, transparent)`
                                        : 'rgb(var(--plum) / 0.08)',
                                    boxShadow: previewIsGenerated ? `0 0 0 1px ${GENERATED_COLOR}` : 'none'
                                }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 text-sm font-black flex-wrap">
                                            <span className="truncate">{generatedRecipe.name}</span>
                                            <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-plum/30 text-plum border border-plum/40">
                                                {generatedRecipe.suggestedSlot}
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mt-1">
                                            {generatedRecipe.genre} • {generatedRecipe.carbType} • 5 min • {generatedRecipe.servings} serving
                                        </p>
                                        <p className="hidden sm:block text-[10px] text-muted-foreground/90 mt-1.5 leading-tight">
                                            {(generatedRecipe.ingredients || []).map(i => i.Name).filter(Boolean).join(', ')}
                                        </p>
                                        {generatedRecipe.nutrientDelta && generatedRecipe.nutrientDelta.length > 0 && (
                                            <p className="hidden sm:flex text-[9px] text-muted-foreground/70 mt-1.5 flex-wrap gap-x-2">
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
                                            backgroundColor: previewIsGenerated ? `color-mix(in srgb, ${GENERATED_COLOR} 15%, transparent)` : 'rgb(var(--foreground) / 0.06)',
                                            color: previewIsGenerated ? GENERATED_COLOR : 'var(--muted-foreground)'
                                        }}
                                    >
                                        {previewIsGenerated ? <FiEyeOff size={10} /> : <FiEye size={10} />}
                                        {previewIsGenerated ? 'Hide' : 'Preview'}
                                    </button>
                                </div>
                                <button
                                    onClick={handleSaveGenerated}
                                    disabled={generating || generatedLogged}
                                    className={`mt-3 w-full rounded-lg text-[11px] font-black uppercase tracking-widest py-2 transition-colors disabled:opacity-50 ${generatedLogged
                                        ? 'bg-olive/20 text-olive'
                                        : 'bg-plum/20 hover:bg-plum/30 border border-plum/40 text-plum'}`}
                                >
                                    {generatedLogged ? <span className="flex items-center justify-center gap-1"><FiCheck size={11} /> Logged to today</span> : 'Save & log to today'}
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
