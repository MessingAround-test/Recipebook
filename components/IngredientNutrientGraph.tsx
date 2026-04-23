import React, { useState, useEffect, useCallback } from 'react';
import 'chart.js/auto';
import { Bar } from 'react-chartjs-2';
import { NUTRIENT_LABELS, DailyIntakeTargets } from '../lib/dailyIntake';
import { normalizeToGrams } from '../lib/conversion';

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
    'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g',
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

// Colour per group
const GROUP_COLOURS: Record<NutrientGroup, string> = {
    macro: 'rgba(99, 102, 241, 0.7)',
    mineral: 'rgba(251, 191, 36, 0.7)',
    vitamin: 'rgba(16, 185, 129, 0.7)',
};

export default function IngredientNutrientGraph({ ingredients, onLogServe = null, logLabel = 'Log Serve' }: { ingredients: any[], onLogServe?: (() => Promise<void>) | null, logLabel?: string }) {
    const [activeGroup, setActiveGroup] = useState<NutrientGroup>('macro');
    const [selectedIngredient, setSelectedIngredient] = useState('');
    const [ingredientData, setIngredientData] = useState<Record<string, any>>({});   // name → { nutrition_info, vitamins_per_100g, minerals_per_100g }
    const [isLogging, setIsLogging] = useState(false);
    const [targets, setTargets] = useState<DailyIntakeTargets>(DEFAULT_TARGETS);
    const [totals, setTotals] = useState<Record<string, number>>(blankTotals());

    // ── Fetch personalized targets once ───────────────────────────────────────
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

    // ── Fetch nutrition + vitamins/minerals for one ingredient ─────────────────
    const fetchIngredient = useCallback(async (name: string, amount: string | number, qType: string) => {
        if (!name) return;
        const token = localStorage.getItem('Token');
        if (!token) return;

        // Fetch all nutrition data (macros + micros) from the unified Nutrition API
        const res = await fetch(`/api/Nutrition?search_term=${encodeURIComponent(name)}&quantity=${amount}&qType=${qType}`, {
            headers: { edgetoken: token },
        }).catch(() => null);

        const json = res ? await res.json().catch(() => null) : null;
        const data = json?.data?.[0] ?? {};
        
        // The API now returns the full IngredientConversion record as well
        const vitamins: Record<string, number> = {};
        VITAMIN_KEYS.forEach(k => { vitamins[k] = Number(data[k]) || 0; });
        const minerals: Record<string, number> = {};
        MINERAL_KEYS.forEach(k => { minerals[k] = Number(data[k]) || 0; });
        const macros: Record<string, number> = {};
        MACRO_KEYS.forEach(k => { macros[k] = Number(data[k]) || 0; });
        macros.energy_kcal = Number(data.energy_kcal) || 0;

        setIngredientData(prev => ({
            ...prev,
            [name]: {
                nutrition_info: data.nutrition_info || {}, 
                vitamins,
                minerals,
                macros,
            },
        }));
    }, []);

    // ── Re-fetch whenever the ingredient list changes ─────────────────────────
    useEffect(() => {
        ingredients.forEach(ing => {
            const name = ing.Name || ing.name;
            const qty  = ing.Amount || ing.quantity;
            const type = ing.AmountType || ing.quantity_type;
            fetchIngredient(name, qty, type);
        });
    }, [ingredients, fetchIngredient]);

    // ── Recompute totals whenever ingredientData or selectedIngredient changes ─
    useEffect(() => {
        const acc = blankTotals();
        const source = selectedIngredient
            ? { [selectedIngredient]: ingredientData[selectedIngredient] }
            : ingredientData;

        Object.values(source).forEach((d: any) => {
            if (!d) return;
            const ni = d.nutrition_info || {};
            const ma = d.macros || {};

            // Macros - prefer explicit columns (ma) if they have values, otherwise fallback to ni
            const getMacro = (key: string, niKey: string) => {
                return (ma[key] || parseFloat(ni[niKey]) || 0);
            };

            acc.protein_g        += getMacro('protein_g', 'protein');
            acc.fat_g            += getMacro('fat_g', 'fat');
            acc.carbohydrates_g  += getMacro('carbohydrates_g', 'carbohydrates');
            acc.fiber_g          += getMacro('fiber_g', 'fiber');

            // Energy: use explicit energy_kcal if > 0, otherwise calculate from macros
            if (ma.energy_kcal > 0) {
                acc.energy_kcal += ma.energy_kcal;
            } else if (ni.energy_kcal) {
                acc.energy_kcal += parseFloat(ni.energy_kcal);
            } else {
                acc.energy_kcal += (getMacro('protein_g', 'protein') * 4) +
                                   (getMacro('fat_g', 'fat') * 9) +
                                   (getMacro('carbohydrates_g', 'carbohydrates') * 4);
            }

            // Vitamins
            VITAMIN_KEYS.forEach(k => {
                acc[k] = (acc[k] || 0) + (d.vitamins?.[k] || 0);
            });
            // Minerals
            MINERAL_KEYS.forEach(k => {
                acc[k] = (acc[k] || 0) + (d.minerals?.[k] || 0);
            });
            // Iron fallback
            if (!d.minerals?.iron_mg && ni.iron) {
                acc.iron_mg += parseFloat(ni.iron) || 0;
            }
        });

        setTotals(acc);
    }, [ingredientData, selectedIngredient]);

    // ── Chart data ────────────────────────────────────────────────────────────
    const activeKeys = GROUP_KEYS[activeGroup];
    const chartLabels = activeKeys.map(k => NUTRIENT_LABELS[k]?.label ?? k);
    const chartData = {
        labels: chartLabels,
        datasets: [
            {
                label: '% of Daily Target',
                data: activeKeys.map(k => {
                    const t = targets[k] || 1;
                    return parseFloat(((totals[k] / t) * 100).toFixed(1));
                }),
                backgroundColor: GROUP_COLOURS[activeGroup],
                borderRadius: 6,
            },
        ],
    };

    const hasVitaminData = Object.values(ingredientData).some(d => d && Object.keys(d.vitamins ?? {}).length > 0);

    return (
        <div className="w-full">
            {/* Ingredient filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-4 items-start md:items-center">
                <select
                    id="nutrientIngredientDropdown"
                    value={selectedIngredient}
                    onChange={e => setSelectedIngredient(e.target.value)}
                    className="flex h-10 w-full md:w-1/2 items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                >
                    <option value="">All ingredients combined</option>
                    {Object.keys(ingredientData).map((name, i) => (
                        <option key={i} value={name}>{name}</option>
                    ))}
                </select>

                {onLogServe && (
                    <button
                        onClick={async () => {
                            setIsLogging(true);
                            try { await onLogServe(); } catch(e) {}
                            setIsLogging(false);
                        }}
                        disabled={isLogging}
                        className="btn-modern !bg-emerald-500 !text-black !py-2 !px-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                    >
                        {isLogging ? 'Logging...' : `➕ ${logLabel}`}
                    </button>
                )}
            </div>

            {/* Group tabs */}
            <div className="flex gap-1 mb-5 bg-muted/20 rounded-lg p-1 w-full md:w-auto inline-flex shadow-inner">
                {(['macro', 'mineral', 'vitamin'] as NutrientGroup[]).map(g => (
                    <button
                        key={g}
                        id={`nutrient-tab-${g}`}
                        onClick={() => setActiveGroup(g)}
                        className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeGroup === g
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {g === 'macro' ? '🥗 Macros' : g === 'mineral' ? '⚗️ Minerals' : '💊 Vitamins'}
                    </button>
                ))}
            </div>

            {/* Nutrient cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {activeKeys.map(key => {
                    const meta = NUTRIENT_LABELS[key];
                    const val = totals[key] ?? 0;
                    const tgt = targets[key] ?? 1;
                    const pct = Math.min((val / tgt) * 100, 120);
                    const colour = pct >= 90 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#6366f1';
                    return (
                        <div key={key} className="bg-muted/30 rounded-lg p-3 border border-border">
                            <div className="text-xs font-medium text-muted-foreground capitalize mb-1">{meta?.label ?? key}</div>
                            <div className="text-lg font-bold">
                                {val < 10 ? val.toFixed(2) : Math.round(val)}
                                <span className="text-xs font-normal text-muted-foreground ml-1">/ {tgt < 10 ? tgt.toFixed(1) : Math.round(tgt)}{meta?.unit}</span>
                            </div>
                            <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: colour }} />
                            </div>
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

            {/* Bar chart */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <Bar
                    data={chartData}
                    options={{
                        responsive: true,
                        plugins: {
                            legend: { labels: { color: 'gray' } },
                            tooltip: {
                                callbacks: {
                                    label: ctx => `${ctx.parsed.y.toFixed(1)}% of daily target`,
                                },
                            },
                        },
                        scales: {
                            x: { ticks: { color: 'gray' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                            y: {
                                ticks: { color: 'gray', callback: v => `${v}%` },
                                grid: { color: 'rgba(255,255,255,0.05)' },
                                suggestedMax: 120,
                            },
                        },
                    }}
                />
            </div>

            <p className="text-xs text-muted-foreground mt-3">
                Targets are personalised based on your profile. Visit <a href="/dailyIntake" className="underline text-emerald-400">Daily Intake</a> to update your details.
            </p>
        </div>
    );
}
