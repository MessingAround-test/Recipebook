import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NUTRIENT_LABELS, DailyIntakeTargets } from '../lib/dailyIntake';
import { normalizeToGrams } from '../lib/conversion';
import { computeNutrientHighlights, NutrientHighlight } from '../lib/nutrientHighlights';
import Skeleton from './Skeleton';

// ─── Default fallback targets (no profile) ────────────────────────────────────
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

type NutrientGroup = 'macro' | 'mineral' | 'vitamin';

// Keys that map from IngredientConversion vitamins_per_100g / minerals_per_100g → DailyIntakeTargets
// These are the keys the AI returns inside each ingredient's conversion document
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

// Keys by group
const GROUP_KEYS: Record<NutrientGroup, (keyof DailyIntakeTargets)[]> = {
    macro: MACRO_KEYS,
    mineral: MINERAL_KEYS,
    vitamin: VITAMIN_KEYS,
};

// Blank accumulator shape
function blankTotals(): Record<keyof DailyIntakeTargets, number> {
    const out: any = {};
    [...MACRO_KEYS, ...MINERAL_KEYS, ...VITAMIN_KEYS, 'energy_kcal'].forEach(k => (out[k] = 0));
    return out;
}

// Global caches to prevent redundant API calls across instances
const globalDefinitionCache: Record<string, any> = {};
const attemptedNames = new Set<string>();
let globalTargetsCache: DailyIntakeTargets | null = null;

function formatValue(v: number): string {
    if (!Number.isFinite(v) || v === 0) return '0';
    if (v >= 100) return String(Math.round(v));
    if (v >= 10) return v.toFixed(1);
    if (v >= 1) return v.toFixed(2);
    return v.toFixed(3);
}

function formatTarget(v: number): string {
    if (!Number.isFinite(v)) return '0';
    return v >= 10 ? String(Math.round(v)) : v.toFixed(1);
}

function pctColour(pct: number): string {
    if (pct >= 75) return '#10b981';
    if (pct >= 40) return '#f59e0b';
    return '#38bdf8';
}

// Nutrients where "a lot" is a warning rather than a win
const LIMIT_KEYS = ['energy_kcal', 'fat_g', 'carbohydrates_g', 'sodium_mg'];

interface BarState {
    isLimit: boolean;
    looped: boolean;          // %DI passed 100% and the fill has wrapped
    marker: string | null;    // symbol shown at the left edge of the bar
    markerTone: 'amber' | 'orange' | 'red';
    loopColour: string | null; // colour of the striped second pass
}

function loopSeverity(pct: number): { colour: string; tone: 'amber' | 'orange' | 'red' } {
    if (pct < 200) return { colour: '#fbbf24', tone: 'amber' };   // yellow: 100–200%
    if (pct < 300) return { colour: '#f97316', tone: 'orange' };  // orange: 200–300%
    return { colour: '#ef4444', tone: 'red' };                   // red: 300%+
}

function barState(key: string, pct: number): BarState {
    const isLimit = LIMIT_KEYS.includes(key);
    if (pct > 100) {
        const sev = loopSeverity(pct);
        return {
            isLimit,
            looped: true,
            marker: isLimit ? '⚠' : '!',
            markerTone: sev.tone,
            loopColour: sev.colour,
        };
    }
    if (isLimit && pct >= 60) {
        // Approaching the daily limit even though the bar hasn't wrapped yet
        return { isLimit, looped: false, marker: '⚠', markerTone: 'amber', loopColour: null };
    }
    return { isLimit, looped: false, marker: null, markerTone: 'amber', loopColour: null };
}

const MARKER_TONES: Record<'amber' | 'orange' | 'red', string> = {
    amber: 'bg-amber-400 text-black',
    orange: 'bg-orange-500 text-white',
    red: 'bg-red-500 text-white',
};

// Striped second pass so the wrap-around is impossible to miss
const LOOP_STRIPES = (colour: string) =>
    `repeating-linear-gradient(45deg, ${colour}B3 0px, ${colour}B3 5px, ${colour}40 5px, ${colour}40 10px)`;

function HighlightChip({ highlight, tone }: { highlight: NutrientHighlight; tone: 'pro' | 'con' }) {
    const colour = tone === 'pro' ? '#10b981' : '#f59e0b';
    return (
        <span className="relative flex-1 basis-full min-w-0 h-4 md:h-5 rounded-md bg-muted/40 overflow-hidden">
            <span
                className="absolute inset-y-0 left-0 transition-all duration-500"
                style={{ width: `${Math.min(highlight.pct, 100)}%`, backgroundColor: `${colour}59` }}
            />
            <span className="absolute inset-y-0 left-1 flex items-center gap-1 min-w-0" style={{ right: '0.25rem' }}>
                <span className="text-[10px] md:text-[11px] font-medium text-foreground/90 truncate">
                    {highlight.tier === 'very-high' ? 'Very high' : 'High'} {highlight.label}
                </span>
                <span className="text-[10px] md:text-[11px] font-medium tabular-nums shrink-0" style={{ color: colour }}>
                    {Math.round(highlight.pct)}%
                </span>
            </span>
        </span>
    );
}

function GraphSkeleton({ showServingsControl, showLogButton }: { showServingsControl: boolean; showLogButton: boolean }) {
    return (
        <div className="w-full max-w-full overflow-hidden">
            <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-4">
                <div>
                    <Skeleton className="h-2.5 w-12 mb-1.5" />
                    <div className="flex flex-col gap-1">
                        <Skeleton className="h-4 md:h-5 w-full rounded-md" />
                        <Skeleton className="h-4 md:h-5 w-full rounded-md" />
                    </div>
                </div>
                <div>
                    <Skeleton className="h-2.5 w-12 mb-1.5 rounded-sm" />
                    <div className="flex flex-col gap-1">
                        <Skeleton className="h-4 md:h-5 w-full rounded-md" />
                        <Skeleton className="h-4 md:h-5 w-full rounded-md" />
                    </div>
                </div>
            </div>
            {(showServingsControl || showLogButton) && (
                <div className="flex items-center gap-2 mb-3">
                    {showServingsControl && <Skeleton className="h-9 md:h-10 flex-1 rounded-lg" />}
                    {showLogButton && <Skeleton className="h-9 md:h-10 w-28 shrink-0 rounded-lg" />}
                </div>
            )}
            <div className="flex items-center gap-2 mb-5">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <div className="flex gap-0.5 shrink-0">
                    <Skeleton className="h-9 w-16 md:w-24 rounded-md" />
                    <Skeleton className="h-9 w-16 md:w-24 rounded-md" />
                    <Skeleton className="h-9 w-16 md:w-24 rounded-md" />
                </div>
            </div>
            <div className="flex flex-col gap-1.5 md:gap-2 mb-6">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 md:gap-3">
                        <Skeleton className="h-5 md:h-6 flex-1 rounded-md" />
                        <Skeleton className="h-3 w-[92px] md:w-[124px]" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function IngredientNutrientGraph({
    ingredients,
    onLogServe = null,
    logLabel,
    onClickNutrient,
    recipeServings,
}: {
    ingredients: any[];
    onLogServe?: ((servings?: number) => Promise<void>) | null;
    logLabel?: string;
    onClickNutrient?: (key: string) => void;
    recipeServings?: number;
}) {
    const [activeGroup, setActiveGroup] = useState<NutrientGroup>('macro');
    const [selectedIngredient, setSelectedIngredient] = useState('');
    const [definitions, setDefinitions] = useState<Record<string, any>>({}); // name -> RAW conversion data
    const [isLogging, setIsLogging] = useState(false);
    const [targets, setTargets] = useState<DailyIntakeTargets>(DEFAULT_TARGETS);
    const [totals, setTotals] = useState<Record<string, number>>(blankTotals());
    const [isLoading, setIsLoading] = useState(true);
    const [targetsReady, setTargetsReady] = useState(false);

    // ── Servings ──────────────────────────────────────────────────────────────
    const showServingsControl = typeof recipeServings === 'number';
    const hasKnownServings = typeof recipeServings === 'number' && recipeServings > 0;
    const batchServings = hasKnownServings ? (recipeServings as number) : 1;
    const maxServings = hasKnownServings ? (recipeServings as number) : 10;
    const [selectedServings, setSelectedServings] = useState(1);
    const [servingsInput, setServingsInput] = useState('1');

    useEffect(() => {
        setSelectedServings(s => Math.min(Math.max(1, s), maxServings));
    }, [maxServings]);

    useEffect(() => {
        setServingsInput(String(selectedServings));
    }, [selectedServings]);

    const commitServings = (raw: string) => {
        setServingsInput(raw);
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed)) {
            setSelectedServings(Math.min(Math.max(1, parsed), maxServings));
        }
    };

    // ── Fetch personalized targets once ───────────────────────────────────────
    useEffect(() => {
        if (globalTargetsCache) {
            setTargets(globalTargetsCache);
            setTargetsReady(true);
            return;
        }
        const token = typeof window !== 'undefined' ? localStorage.getItem('Token') : null;
        if (!token) {
            setTargetsReady(true);
            return;
        }
        fetch('/api/dailyIntake', { headers: { edgetoken: token } })
            .then(r => r.json())
            .then(data => {
                if (data.success && data.targets) {
                    globalTargetsCache = data.targets;
                    setTargets(data.targets);
                }
            })
            .catch(() => { /* use defaults */ })
            .finally(() => setTargetsReady(true));
    }, []);

    // ── Fetch raw conversion definition for one ingredient ─────────────────
    const loadDefinition = useCallback(async (name: string) => {
        if (!name || globalDefinitionCache[name] || attemptedNames.has(name)) return;

        const token = typeof window !== 'undefined' ? localStorage.getItem('Token') : null;
        if (!token) return;

        attemptedNames.add(name);
        try {
            const res = await fetch(`/api/Nutrition?search_term=${encodeURIComponent(name)}&quantity=100&qType=gram`, {
                headers: { edgetoken: token },
            }).catch(() => null);

            const json = res ? await res.json().catch(() => null) : null;
            const data = json?.data?.[0] ?? {};
            if (data.name) {
                globalDefinitionCache[name] = data;
            }
        } catch {
            /* ignore — ingredient simply won't contribute data */
        }
    }, []);

    // ── Load all definitions as a batch, then paint once ──────────────────
    useEffect(() => {
        let cancelled = false;
        const names: string[] = Array.from(new Set(
            ingredients.map(ing => ing.Name || ing.name).filter(Boolean)
        ));

        const applyCached = () => {
            const merged: Record<string, any> = {};
            names.forEach(n => { if (globalDefinitionCache[n]) merged[n] = globalDefinitionCache[n]; });
            if (!cancelled) setDefinitions(merged);
        };

        const missing = names.filter(n => !globalDefinitionCache[n] && !attemptedNames.has(n));

        if (names.length === 0) {
            // Ingredients haven't arrived yet — keep showing the skeleton.
            return;
        }

        if (missing.length === 0) {
            applyCached();
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        Promise.all(missing.map(n => loadDefinition(n))).then(() => {
            if (cancelled) return;
            applyCached();
            setIsLoading(false);
        });

        return () => { cancelled = true; };
    }, [ingredients, loadDefinition]);

    // ── Recompute totals whenever definitions or ingredients change ─
    useEffect(() => {
        const acc = blankTotals();

        // Filter by selected ingredient if needed
        const filteredIngredients = selectedIngredient
            ? ingredients.filter(ing => (ing.Name || ing.name) === selectedIngredient)
            : ingredients;

        filteredIngredients.forEach(ing => {
            const name = ing.Name || ing.name;
            const def = definitions[name];
            if (!def) return;

            const qty = ing.Amount || ing.quantity;
            const type = ing.AmountType || ing.quantity_unit || ing.quantity_type;

            const { value: grams } = normalizeToGrams(type, Number(qty), def.grams_per_each);
            const ratio = (grams ?? Number(qty)) / 100;

            // Macros
            acc.protein_g += (def.protein_g || 0) * ratio;
            acc.fat_g += (def.fat_g || 0) * ratio;
            acc.carbohydrates_g += (def.carbohydrates_g || 0) * ratio;
            acc.fiber_g += (def.fiber_g || 0) * ratio;
            acc.energy_kcal += (def.energy_kcal || 0) * ratio;

            // Vitamins
            VITAMIN_KEYS.forEach(k => {
                acc[k] = (acc[k] || 0) + (def[k] || 0) * ratio;
            });
            // Minerals
            MINERAL_KEYS.forEach(k => {
                acc[k] = (acc[k] || 0) + (def[k] || 0) * ratio;
            });
        });

        setTotals(acc);
    }, [definitions, ingredients, selectedIngredient]);

    // ── Scale the whole-batch totals to the selected number of servings ──────
    const displayTotals = useMemo(() => {
        const out: Record<string, number> = {};
        for (const key of Object.keys(totals)) {
            out[key] = (totals[key] / batchServings) * selectedServings;
        }
        return out;
    }, [totals, batchServings, selectedServings]);

    const highlights = useMemo(
        () => computeNutrientHighlights(displayTotals, targets),
        [displayTotals, targets]
    );

    const activeKeys = GROUP_KEYS[activeGroup];

    const hasVitaminData = Object.values(definitions).some(d => d && (d.vitamin_a_ug > 0 || d.vitamin_c_mg > 0));

    if (isLoading || !targetsReady) {
        return <GraphSkeleton showServingsControl={showServingsControl} showLogButton={!!onLogServe} />;
    }

    const logButtonLabel = logLabel ?? `Log ${selectedServings} Serve${selectedServings === 1 ? '' : 's'}`;

    return (
        <div className="w-full max-w-full overflow-hidden">
            {/* Pros / cons highlights — mini bars, both on one row */}
            <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-4">
                <div>
                    <div className="flex items-center gap-1 text-[10px] md:text-[11px] font-medium uppercase tracking-widest text-emerald-400 mb-1">
                        <span>👍</span> Pros
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {highlights.pros.length > 0 ? (
                            highlights.pros.map(h => <HighlightChip key={h.key} highlight={h} tone="pro" />)
                        ) : (
                            <span className="text-[10px] md:text-[11px] text-muted-foreground">No standouts.</span>
                        )}
                    </div>
                </div>
                <div>
                    <div className="flex items-center gap-1 text-[10px] md:text-[11px] font-medium uppercase tracking-widest text-amber-400 mb-1">
                        <span>⚠️</span> Cons
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {highlights.cons.length > 0 ? (
                            highlights.cons.map(h => <HighlightChip key={h.key} highlight={h} tone="con" />)
                        ) : (
                            <span className="text-[10px] md:text-[11px] text-muted-foreground">Nothing excessive.</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Servings + log row */}
            {(showServingsControl || onLogServe) && (
                <div className={`flex items-center gap-2 md:gap-4 mb-3 ${showServingsControl ? '' : 'justify-end'}`}>
                    {showServingsControl && (
                        <div className="rounded-lg md:rounded-xl bg-muted/30 px-2 md:px-3 py-1.5 md:py-2 flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                            <span className="text-[10px] md:text-[11px] font-medium uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                Servings
                            </span>
                            <input
                                type="range"
                                min={1}
                                max={maxServings}
                                step={1}
                                value={selectedServings}
                                onChange={e => commitServings(e.target.value)}
                                className="flex-1 min-w-[40px] md:min-w-[100px] accent-foreground cursor-pointer"
                                aria-label="Number of servings"
                            />
                            <input
                                type="number"
                                min={1}
                                max={maxServings}
                                value={servingsInput}
                                onChange={e => commitServings(e.target.value)}
                                onBlur={() => setServingsInput(String(selectedServings))}
                                className="w-11 md:w-14 rounded-md md:rounded-lg border border-border bg-background px-1.5 md:px-2 py-1 text-center text-xs md:text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                aria-label="Number of servings"
                            />
                            <span className="text-[10px] md:text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">/ {maxServings}</span>
                        </div>
                    )}

                    {onLogServe && (
                        <button
                            onClick={async () => {
                                setIsLogging(true);
                                try { await onLogServe(selectedServings); } catch (e) {}
                                setIsLogging(false);
                            }}
                            disabled={isLogging}
                            className="bg-secondary text-foreground hover:bg-accent disabled:opacity-50 rounded-lg py-1.5 md:py-2 px-3 md:px-4 text-[10px] md:text-[11px] font-medium uppercase tracking-widest transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                        >
                            {isLogging ? 'Logging...' : `➕ ${logButtonLabel}`}
                        </button>
                    )}
                </div>
            )}

            {/* Ingredient filter + group tabs row */}
            <div className="flex items-center gap-2 mb-5">
                <select
                    id="nutrientIngredientDropdown"
                    value={selectedIngredient}
                    onChange={e => setSelectedIngredient(e.target.value)}
                    className="h-9 md:h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 md:px-3 py-2 text-xs md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary shadow-sm"
                >
                    <option value="">All ingredients combined</option>
                    {Object.keys(definitions).map((name, i) => (
                        <option key={i} value={name}>{name}</option>
                    ))}
                </select>

                <div className="inline-flex gap-0.5 md:gap-1 bg-muted/20 rounded-lg p-0.5 md:p-1 shadow-inner shrink-0">
                    {(['macro', 'mineral', 'vitamin'] as NutrientGroup[]).map(g => (
                        <button
                            key={g}
                            id={`nutrient-tab-${g}`}
                            onClick={() => setActiveGroup(g)}
                            className={`flex items-center justify-center truncate px-1.5 md:px-4 py-1.5 min-h-[34px] md:min-h-[38px] rounded-md text-[10px] md:text-[11px] font-medium uppercase tracking-widest transition-all ${
                                activeGroup === g
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {g === 'macro' ? '🥗 Macros' : g === 'mineral' ? '⚗️ Minerals' : '💊 Vitamins'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Nutrient bars — label inside, fill = %DI, values to the right */}
            <div className="flex flex-col gap-1.5 md:gap-2 mb-6">
                {activeKeys.map(key => {
                    const meta = NUTRIENT_LABELS[key];
                    const val = displayTotals[key] ?? 0;
                    const tgt = targets[key] ?? 1;
                    const pct = tgt > 0 ? (val / tgt) * 100 : 0;
                    const colour = pctColour(pct);
                    const state = barState(key, pct);
                    const remainder = state.looped ? Math.min(pct - 100, 100) : 0;
                    const loopColour = state.loopColour ?? '';
                    return (
                        <div
                            key={key}
                            className={`flex items-center gap-2 md:gap-3 ${onClickNutrient ? 'cursor-pointer' : ''}`}
                            onClick={() => onClickNutrient?.(key)}
                        >
                            {/* Rectangle bar with the nutrient word inside */}
                            <div className="relative flex-1 min-w-0 h-5 md:h-6 rounded-md bg-muted/40 overflow-hidden transition-all">
                                {/* First pass */}
                                <div
                                    className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
                                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: `${colour}59` }}
                                />
                                {/* Second pass — wrap-around in a contrasting striped colour */}
                                {remainder > 0 && (
                                    <div
                                        className="absolute inset-y-0 left-0 transition-all duration-500"
                                        style={{
                                            width: `${remainder}%`,
                                            background: LOOP_STRIPES(loopColour),
                                        }}
                                    />
                                )}

                                {/* Warning marker at the left edge */}                                {state.marker && (
                                    <span className={`absolute inset-y-0 left-0 flex items-center justify-center w-4 md:w-5 text-[10px] md:text-[13px] font-medium ${MARKER_TONES[state.markerTone]}`}>
                                        {state.marker}
                                    </span>
                                )}

                                {/* Label + % — word/% get a blue chip behind them once the fill loops */}
                                <div
                                    className="absolute inset-y-0 flex items-center gap-1 min-w-0"
                                    style={{ left: state.marker ? '1.375rem' : '0.5rem', right: '0.25rem' }}
                                >
                                    {state.looped ? (
                                        <span className="flex items-center gap-1 min-w-0 rounded-md bg-card px-1.5">
                                            <span className="text-[10px] md:text-[13px] font-medium truncate text-white/95">
                                                {meta?.label ?? key}
                                            </span>
                                            <span className="text-[10px] md:text-[13px] font-medium tabular-nums shrink-0 text-white">
                                                {Math.round(pct)}%
                                            </span>
                                        </span>
                                    ) : (
                                        <>
                                            <span className="text-[10px] md:text-[13px] font-medium truncate text-foreground/90">
                                                {meta?.label ?? key}
                                            </span>
                                            <span className="text-[10px] md:text-[13px] font-medium tabular-nums shrink-0" style={{ color: colour }}>
                                                {Math.round(pct)}%
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Values to the right of the bar */}
                            <span className="w-[92px] md:w-[124px] shrink-0 text-right text-[9px] md:text-[11px] text-muted-foreground tabular-nums truncate">
                                {formatValue(val)} / {formatTarget(tgt)} {meta?.unit}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Vitamin data warning */}
            {activeGroup === 'vitamin' && !hasVitaminData && (
                <div className="mb-4 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-4 py-3">
                    ⚠ Vitamin data populates automatically next time each ingredient is looked up. New ingredients will have full data.
                </div>
            )}

            <p className="text-xs md:text-sm text-muted-foreground mt-3">
                Targets are personalised based on your profile. Visit <a href="/dailyIntake" className="underline text-emerald-400">Daily Intake</a> to update your details.
            </p>
        </div>
    );
}
