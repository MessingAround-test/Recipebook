import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { calculateDailyIntake, DailyIntakeTargets, NUTRIENT_LABELS } from '../lib/dailyIntake';
import 'chart.js/auto';
import { Bar } from 'react-chartjs-2';
import { FiChevronLeft, FiChevronRight, FiPlus, FiTrash2, FiSearch, FiZap, FiX, FiChevronDown, FiChevronUp, FiPieChart } from 'react-icons/fi';
import AddShoppingItem from '../components/AddShoppingItem';
import { Toolbar } from '../components/Toolbar';
import IngredientNutrientGraph from '../components/IngredientNutrientGraph';
import WeeklyNutrientGraph from '../components/WeeklyNutrientGraph';
import SearchableDropdown from '../components/SearchableDropdown';
import { useRouter } from 'next/router';
import IngredientResearchComponent from '../components/IngredientResearchComponent';
import NutrientResearchModal from '../components/NutrientResearchModal';

export default function DailyTracker() {
    const router = useRouter();
    const getLocalDateString = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState(getLocalDateString(new Date()));
    const [log, setLog] = useState<any>(null);
    const [targets, setTargets] = useState<DailyIntakeTargets | null>(null);
    const [loading, setLoading] = useState(false);
    const [isLoggingOpen, setIsLoggingOpen] = useState(false);
    const [recommendations, setRecommendations] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
    const [knownIngredients, setKnownIngredients] = useState<string[]>([]);
    const [unifiedSearch, setUnifiedSearch] = useState("");
    const [recipes, setRecipes] = useState<any[]>([]);
    const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
    const [servingsToLog, setServingsToLog] = useState<number>(1);
    const [recipeWeight, setRecipeWeight] = useState<number | null>(null);

    // Action states
    const [prefillData, setPrefillData] = useState<any>(null);
    const [researchIngredient, setResearchIngredient] = useState<{ name: string, quantity?: number, unit?: string } | null>(null);
    const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(new Set());
    const [insightsExpanded, setInsightsExpanded] = useState(false);
    const [breakdownExpanded, setBreakdownExpanded] = useState(false);
    const [selectedNutrientForResearch, setSelectedNutrientForResearch] = useState<string | null>(null);

    const toggleRecipe = (recipeKey: string) => {
        setExpandedRecipes(prev => {
            const next = new Set(prev);
            if (next.has(recipeKey)) next.delete(recipeKey);
            else next.add(recipeKey);
            return next;
        });
    };

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

            // 3. Get recommendations (daily analysis)
            const recRes = await fetch(`/api/dailyLog/recommendations?date=${date}`, { headers: { edgetoken: token } });
            const recData = await recRes.json();
            if (recData.success) setRecommendations(recData);

        } catch (err) {
            console.error("Fetch data failed:", err);
        } finally {
            setLoading(false);
        }
    }, [date]);

    const fetchRecipes = useCallback(async () => {
        const token = localStorage.getItem('Token');
        if (!token) return;
        const res = await fetch('/api/Recipe', { headers: { edgetoken: token } });
        const data = await res.json();
        if (data.res) setRecipes(data.res);
    }, []);

    const fetchKnownIngredients = useCallback(async () => {
        const token = localStorage.getItem('Token');
        if (!token) return;
        const res = await fetch('/api/Ingredients/defaults', { headers: { edgetoken: token } });
        const data = await res.json();
        if (data.success) setKnownIngredients(data.data);
    }, []);

    useEffect(() => {
        fetchData();
        fetchRecipes();
        fetchKnownIngredients();
    }, [fetchData, fetchRecipes, fetchKnownIngredients]);

    const changeDate = (offset: number) => {
        const [y, m, d] = date.split('-').map(Number);
        const newD = new Date(y, m - 1, d);
        newD.setDate(newD.getDate() + offset);
        setDate(getLocalDateString(newD));
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
                setPrefillData(null);
                setUnifiedSearch("");
                setIsLoggingOpen(false);
                fetchData();
            }
        } catch (err) {
            alert("Add failed");
        }
    };

    const handleLogRecipe = async () => {
        if (!selectedRecipe) return;
        const token = localStorage.getItem('Token');
        try {
            const res = await fetch('/api/dailyLog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({
                    date,
                    type: 'recipe',
                    name: selectedRecipe.name,
                    recipe_id: selectedRecipe._id,
                    quantity: servingsToLog
                })
            });
            const data = await res.json();
            if (data.success) {
                setLog(data.log);
                setSelectedRecipe(null);
                setRecipeWeight(null);
                setUnifiedSearch("");
                setIsLoggingOpen(false);
                fetchData();
            }
        } catch (err) {
            alert("Recipe log failed");
        }
    };

    const calculateWeight = async (recipe: any) => {
        let totalGrams = 0;
        const { normalizeToGrams } = require('../lib/conversion');
        for (const ing of recipe.ingredients) {
            const token = localStorage.getItem('Token');
            const convRes = await fetch(`/api/Ingredients/SearchLogLookup?search_term=${encodeURIComponent(ing.Name || ing.name)}`, {
                headers: { edgetoken: token || '' }
            });
            const convData = await convRes.json();
            if (convData.success && convData.res) {
                const { value: grams } = normalizeToGrams(ing.AmountType || ing.quantity_type, ing.Amount || ing.quantity, convData.res.grams_per_each);
                totalGrams += (grams ?? 0);
            }
        }
        setRecipeWeight(totalGrams);
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
            if (data.success) {
                setLog(data.log);
                fetchData();
            }
        } catch (err) {
            alert("Delete failed");
        }
    };

    const handlePrefillIngredient = (name: string) => {
        setPrefillData({
            name: name,
            quantity: 100,
            quantity_type: 'gram'
        });
        setSelectedRecipe(null);
        setUnifiedSearch(name);
        setIsLoggingOpen(true);
        document.getElementById('logging-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handlePrefillRecipe = (recipe: any) => {
        const fullRecipe = recipes.find(r => r._id === recipe.id) || recipe;
        setSelectedRecipe(fullRecipe);
        setPrefillData(null);
        setUnifiedSearch(fullRecipe.name);
        setServingsToLog(1);
        calculateWeight(fullRecipe);
        setIsLoggingOpen(true);
        document.getElementById('logging-section')?.scrollIntoView({ behavior: 'smooth' });
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

    const token = typeof window !== 'undefined' ? localStorage.getItem('Token') : null;
    let isAdmin = false;
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            isAdmin = payload.role === 'admin';
        } catch (e) {
            console.error("Failed to decode token", e);
        }
    }


    // Pre-compute consumed item groups (shared between mobile & desktop)
    const consumedGroups = (() => {
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
        return groups;
    })();

    const totalKcal = Math.round(totals.energy_kcal || 0);

    // Shared: render consumed items list
    const renderConsumedItems = () => (
        <div className="space-y-3">
            {log?.items?.length === 0 ? (
                <div className="py-12 md:py-20 text-center text-muted-foreground border-2 border-dashed border-white/5 rounded-xl opacity-40 text-sm">
                    No items logged for this day.
                </div>
            ) : (
                consumedGroups.map((g: any, idx: number) => {
                    if (g.isGroup) {
                        const recipeKey = `${g.recipe_id}-${g.logged_at}`;
                        const isExpanded = expandedRecipes.has(recipeKey);
                        return (
                            <div key={recipeKey} className="bg-white/[0.02] rounded-2xl md:rounded-3xl border border-white/5 overflow-hidden group/recipe">
                                <div className="flex items-center justify-between p-3 md:p-4 bg-white/[0.03] border-b border-white/5">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">Recipe</div>
                                            <div className="font-black text-sm truncate cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => router.push(`/Recipe/${g.recipe_id}`)}>{g.recipe_name}</div>
                                        </div>
                                        <button onClick={() => toggleRecipe(recipeKey)} className={`shrink-0 px-2 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/5 transition-all min-h-[36px] ${isExpanded ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'text-muted-foreground'}`}>
                                            {isExpanded ? <span className="flex items-center gap-1">Hide <FiChevronUp /></span> : <span className="flex items-center gap-1">Details <FiChevronDown /></span>}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-4 ml-2 shrink-0">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{Math.round(g.totalKcal)} kcal</div>
                                        <button onClick={() => deleteItem(g.items[0]._id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-100 md:opacity-0 md:group-hover/recipe:opacity-100 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center">
                                            <FiTrash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="p-2 space-y-1 animate-in slide-in-from-top-1 duration-200">
                                        {g.items.map((it: any) => (
                                            <div key={it._id} className="flex items-center justify-between px-3 md:px-4 py-2 text-[11px] hover:bg-white/[0.02] rounded-xl transition-all">
                                                <span className="text-muted-foreground capitalize font-bold cursor-pointer hover:text-emerald-400" onClick={() => setResearchIngredient({ name: it.name, quantity: it.quantity, unit: it.quantity_unit })}>{it.name}</span>
                                                <span className="text-muted-foreground/60">{it.quantity}{it.quantity_unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    } else {
                        return (
                            <div key={g._id} className="flex items-center justify-between p-3 md:p-4 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-sm capitalize cursor-pointer hover:text-emerald-400 transition-colors truncate" onClick={() => setResearchIngredient({ name: g.name, quantity: g.quantity, unit: g.quantity_unit })}>{g.name}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">{g.quantity}{g.quantity_unit} • {Math.round(g.nutrients.energy_kcal)} kcal</div>
                                </div>
                                <button onClick={() => deleteItem(g._id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center">
                                    <FiTrash2 size={16} />
                                </button>
                            </div>
                        );
                    }
                })
            )}
        </div>
    );

    // Shared: render insights content
    const renderInsightsContent = () => {
        if (!recommendations?.deficientNutrient) return null;
        const nutrientKey = recommendations.deficientNutrient as keyof DailyIntakeTargets;
        const nutrientInfo = NUTRIENT_LABELS[nutrientKey];
        const dailyTarget = (targets as any)?.[nutrientKey] || 0;
        const dailyTotal = totals[nutrientKey] || 0;
        const dailyPct = Math.min(Math.round((dailyTotal / dailyTarget) * 100), 100);
        return (
            <>
                <p className="text-sm font-medium mb-4 leading-relaxed">
                    You're at <span className="text-amber-400 font-black">{dailyPct}%</span> of your daily <span className="capitalize text-white">{nutrientInfo?.label}</span>. Try adding:
                </p>
                <div className="space-y-2">
                    {recommendations.recommendations.map((rec: any) => (
                        <div key={rec.name} className="p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/5 flex items-center gap-3 group hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all">
                            <div className="flex-1 min-w-0">
                                <span className="text-[12px] font-black cursor-pointer hover:text-emerald-400 transition-colors capitalize" onClick={() => setResearchIngredient({ name: rec.name, quantity: 100, unit: 'gram' })}>{rec.name} / 100g</span>
                                <div className="flex flex-wrap gap-x-2 mt-0.5">
                                    <span className="text-[10px] font-black text-emerald-400">+{Math.round((rec.value / dailyTarget) * 100)}% {nutrientInfo?.label}</span>
                                    {rec.helpsWith?.slice(0, 2).map((h: string) => {
                                        const hInfo = NUTRIENT_LABELS[h as keyof DailyIntakeTargets];
                                        const hValue = rec.fullProfile?.[h] || 0;
                                        const hTarget = (targets as any)?.[h] || 1;
                                        const hPct = Math.round((hValue / hTarget) * 100);
                                        if (hPct < 1) return null;
                                        return <span key={h} className="text-[10px] font-bold text-muted-foreground">• +{hPct}% {hInfo?.label}</span>;
                                    })}
                                </div>
                                {rec.warnings?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {rec.warnings?.map((w: string) => (
                                            <span key={w} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">High {NUTRIENT_LABELS[w as keyof DailyIntakeTargets]?.label}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => handlePrefillIngredient(rec.name)} className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-black transition-all active:scale-90 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center">
                                <FiPlus size={18} />
                            </button>
                        </div>
                    ))}
                    {recommendations.recipeRecommendations?.length > 0 && (
                        <div className="space-y-2 mt-4 border-t border-white/5 pt-4">
                            <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">
                                {recommendations.recipeRecommendations.some((r: any) => r.isSnack) ? 'Snack Suggestions' : 'Recipe Suggestions'}
                            </h4>
                            {recommendations.recipeRecommendations.map((recipe: any) => {
                                const recipeValue = recipe.nutrients?.[nutrientKey] || 0;
                                const boostPct = Math.round((recipeValue / dailyTarget) * 100);
                                return (
                                    <div key={recipe.id} className="p-3 md:p-4 bg-emerald-500/5 rounded-xl md:rounded-2xl border border-emerald-500/10 flex gap-3 items-center group hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all">
                                        {recipe.image && <img src={recipe.image} alt={recipe.name} className="w-10 h-10 rounded-xl object-cover shadow-lg border border-white/10 cursor-pointer shrink-0" onClick={() => router.push(`/Recipe/${recipe.id}`)} />}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-black truncate cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => router.push(`/Recipe/${recipe.id}`)}>{recipe.name}</div>
                                            <span className="text-[10px] font-black text-emerald-400">+{boostPct}% {nutrientInfo?.label}</span>
                                        </div>
                                        <button onClick={() => handlePrefillRecipe(recipe)} className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-black transition-all active:scale-90 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center">
                                            <FiPlus size={18} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </>
        );
    };

    const combinedOptions = useMemo(() => {
        const options: any[] = [];
        const recipeNames = new Set(recipes.map(r => r.name.toLowerCase()));
        const ingredientNames = new Set(knownIngredients.map(i => i.toLowerCase()));

        recipes.forEach(r => {
            const hasCollision = ingredientNames.has(r.name.toLowerCase());
            options.push({
                label: hasCollision ? `🍲 ${r.name} (Recipe)` : r.name,
                value: r._id,
                type: 'recipe',
                data: r
            });
        });

        knownIngredients.forEach(i => {
            const hasCollision = recipeNames.has(i.toLowerCase());
            options.push({
                label: hasCollision ? `🥗 ${i} (Ingredient)` : i,
                value: i,
                type: 'ingredient',
                data: i
            });
        });

        return options;
    }, [recipes, knownIngredients]);

    const handleUnifiedSearch = (e: any) => {
        const val = e.target.value;
        const option = e.target.option;
        if (!val) {
            setPrefillData(null);
            setSelectedRecipe(null);
            setUnifiedSearch("");
            return;
        }
        if (option) {
            if (option.type === 'recipe') {
                setPrefillData(null);
                setSelectedRecipe(option.data);
                setServingsToLog(option.data.servings || 1);
                calculateWeight(option.data);
                setUnifiedSearch(option.label);
            } else if (option.type === 'ingredient') {
                setSelectedRecipe(null);
                setPrefillData({ name: option.data });
                setUnifiedSearch(option.label);
            }
        }
    };

    const handleUnifiedComplete = (text: string) => {
        if (!text) {
             setPrefillData(null);
             setSelectedRecipe(null);
             setUnifiedSearch("");
             return;
        }
        setSelectedRecipe(null);
        setPrefillData({ name: text });
        setUnifiedSearch(text);
    };

    // Shared: render the logging form
    const renderLoggingForm = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Log Food
                </h2>
                {unifiedSearch && (
                    <button onClick={() => { setUnifiedSearch(""); setPrefillData(null); setSelectedRecipe(null); }} className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors bg-white/5 px-2 py-1 rounded-md">
                        Clear Search
                    </button>
                )}
            </div>
            
            <div className="bg-muted/20 rounded-xl md:rounded-[2rem] border border-white/5 p-4 md:p-8 shadow-2xl shadow-black/20">
                <div className="space-y-4 md:space-y-6">
                    <SearchableDropdown
                        name="unified-search"
                        value={unifiedSearch}
                        options={combinedOptions}
                        onChange={handleUnifiedSearch}
                        onComplete={handleUnifiedComplete}
                        placeholder="Search recipes or ingredients..."
                    />

                    {prefillData ? (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 border-t border-white/5 pt-4">
                            <AddShoppingItem
                                key={`prefill-${prefillData.name}`}
                                handleSubmit={handleLogItem}
                                hideCategories={true}
                                initialData={prefillData}
                                hideHeader={true}
                                hideNote={true}
                                hideNameInput={true}
                                triggerSearchOnInit={true}
                            />
                        </div>
                    ) : selectedRecipe ? (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4 pt-4 border-t border-white/5">
                            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Servings to Log</label>
                                    <div className="flex items-center gap-4">
                                        <input type="number" value={servingsToLog} onChange={(e) => setServingsToLog(Number(e.target.value))} className="w-24 bg-background border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500/50" />
                                        <div className="text-[10px] font-black text-muted-foreground uppercase">of {selectedRecipe.servings || 1} total</div>
                                    </div>
                                </div>
                                {recipeWeight !== null && (
                                    <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/20 flex flex-col justify-center">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">Est. Weight</div>
                                        <div className="text-xl font-black">{Math.round(recipeWeight / (selectedRecipe.servings || 1))}g <span className="text-[10px] font-medium text-muted-foreground ml-1">per serve</span></div>
                                    </div>
                                )}
                            </div>
                            <button onClick={handleLogRecipe} className="w-full btn-modern !bg-emerald-500 !text-black py-4 font-black uppercase tracking-widest flex items-center justify-center gap-2 min-h-[48px]"><FiPlus /> Log {servingsToLog} Serving{servingsToLog !== 1 ? 's' : ''}</button>
                            <div className="flex items-center gap-2 px-1"><FiZap size={10} className="text-emerald-400" /><p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Recipe logging expands into constituent ingredients for accuracy.</p></div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
    return (
        <div className="min-h-screen bg-background text-foreground pb-24 md:pb-0">
            <Toolbar />
            <div className="max-w-5xl mx-auto px-3 md:px-4 py-4 md:py-8">
                {/* ═══ COMPACT HEADER ═══ */}
                <div className="mb-4 md:mb-8">
                    <div className="flex items-center justify-between mb-3 md:mb-6">
                        <div>
                            <PageHeader title="Daily Food Tracker" />
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-0.5">Track & Optimize</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className={`text-3xl md:text-4xl font-black ${dailyScore > 80 ? 'text-emerald-400' : dailyScore > 50 ? 'text-amber-400' : 'text-rose-400'}`}>{dailyScore}%</div>
                            <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground">Daily Score</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-white/5 shadow-inner">
                            <button onClick={() => setViewMode('daily')} className={`px-3 md:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all min-h-[40px] ${viewMode === 'daily' ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>📅 Daily</button>
                            <button onClick={() => setViewMode('weekly')} className={`px-3 md:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all min-h-[40px] ${viewMode === 'weekly' ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>📊 Trends</button>
                        </div>
                        {viewMode === 'daily' && (
                            <div className="flex items-center gap-1 md:gap-3 bg-muted/30 p-1 md:p-1.5 rounded-xl border border-white/5 shadow-inner ml-auto">
                                <button onClick={() => changeDate(-1)} className="p-2.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-90"><FiChevronLeft size={18} /></button>
                                <button onClick={() => setDate(getLocalDateString(new Date()))} className="font-black text-[11px] tracking-widest uppercase px-2 md:px-4 hover:text-emerald-400 transition-all active:scale-95 min-h-[40px] flex items-center">
                                    {date === getLocalDateString(new Date()) ? 'Today' : (() => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); })()}
                                </button>
                                <button onClick={() => changeDate(1)} className="p-2.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-90"><FiChevronRight size={18} /></button>
                            </div>
                        )}
                    </div>
                </div>

                {viewMode === 'weekly' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <WeeklyNutrientGraph onClickNutrient={(key) => setSelectedNutrientForResearch(key)} />
                    </div>
                ) : (
                    <>
                        {/* ═══ DESKTOP LAYOUT (md+) ═══ */}
                        <div className="hidden md:grid grid-cols-1 gap-8 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                                <div id="logging-section" className="lg:col-span-3 space-y-6">
                                    {renderLoggingForm()}
                                    <div className="glass-card min-h-[300px]">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Consumed Today</h3>
                                        {renderConsumedItems()}
                                    </div>
                                </div>
                                <div className="lg:col-span-2 space-y-6">
                                    {recommendations?.deficientNutrient && (
                                        <div className="glass-card border-amber-500/30 bg-amber-500/5 relative overflow-hidden h-full">
                                            <div className="absolute top-0 right-0 p-4 opacity-10"><FiZap size={60} /></div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-4 flex items-center gap-2"><FiZap /> Daily Insight</h3>
                                            {renderInsightsContent()}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="glass-card">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Comprehensive Nutritional Breakdown</h3>
                                    <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest bg-white/5 px-3 py-1 rounded-full">Detailed Analysis</div>
                                </div>
                                <IngredientNutrientGraph 
                                    ingredients={(log?.items || []).map((item: any) => ({ name: item.name, quantity: item.quantity, quantity_type: item.quantity_unit }))} 
                                    onClickNutrient={(key) => setSelectedNutrientForResearch(key)}
                                />
                            </div>
                        </div>

                        {/* ═══ MOBILE LAYOUT ═══ */}
                        <div className="md:hidden space-y-3 animate-in fade-in duration-500">
                            {/* Consumed Today ” PRIMARY on mobile */}
                            <div className="glass-card !p-3 !rounded-2xl">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Consumed Today</h3>
                                    <div className="text-[10px] font-black text-emerald-400">{totalKcal} kcal</div>
                                </div>
                                {renderConsumedItems()}
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                {recommendations?.deficientNutrient && (
                                    <button onClick={() => setInsightsExpanded(true)} className="glass-card !p-3 !rounded-2xl relative flex flex-col items-center justify-center gap-2 active:bg-white/5 transition-colors border-amber-500/30 bg-amber-500/5">
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 text-black text-[11px] font-black rounded-full flex items-center justify-center shadow-lg ring-2 ring-background animate-bounce">1</div>
                                        <FiZap size={24} className="text-amber-400" />
                                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">Insights</div>
                                    </button>
                                )}
                                <button onClick={() => setBreakdownExpanded(true)} className="glass-card !p-3 !rounded-2xl flex flex-col items-center justify-center gap-2 active:bg-white/5 transition-colors">
                                    <FiPieChart size={24} className="text-emerald-500" />
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Breakdown</div>
                                </button>
                            </div>
                        </div>

                        {/* ═══ MOBILE: Insights Overlay ═══ */}
                        {insightsExpanded && (
                            <div className="md:hidden fixed inset-0 z-[90] bg-background overflow-y-auto animate-in slide-in-from-bottom duration-300">
                                <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-background/95 backdrop-blur-md border-b border-white/5">
                                    <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-amber-400"><FiZap /> Daily Insight</h2>
                                    <button onClick={() => setInsightsExpanded(false)} className="p-2.5 hover:bg-white/10 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"><FiX size={22} /></button>
                                </div>
                                <div className="p-4 pb-8">{renderInsightsContent()}</div>
                            </div>
                        )}

                        {/* ═══ MOBILE: Breakdown Overlay ═══ */}
                        {breakdownExpanded && (
                            <div className="md:hidden fixed inset-0 z-[90] bg-background overflow-y-auto animate-in slide-in-from-bottom duration-300">
                                <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-background/95 backdrop-blur-md border-b border-white/5">
                                    <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-emerald-500"><FiPieChart /> Breakdown</h2>
                                    <button onClick={() => setBreakdownExpanded(false)} className="p-2.5 hover:bg-white/10 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"><FiX size={22} /></button>
                                </div>
                                <div className="p-4 pb-8">
                                    <IngredientNutrientGraph 
                                        ingredients={(log?.items || []).map((item: any) => ({ name: item.name, quantity: item.quantity, quantity_type: item.quantity_unit }))} 
                                        onClickNutrient={(key) => {
                                            setBreakdownExpanded(false);
                                            setSelectedNutrientForResearch(key);
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ═══ MOBILE: Logging Overlay ═══ */}
                        {isLoggingOpen && (
                            <div className="md:hidden fixed inset-0 z-[90] bg-background overflow-y-auto animate-in slide-in-from-bottom duration-300">
                                <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-background/95 backdrop-blur-md border-b border-white/5">
                                    <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><FiPlus className="text-emerald-500" /> Log Food</h2>
                                    <button onClick={() => { setIsLoggingOpen(false); setPrefillData(null); }} className="p-2.5 hover:bg-white/10 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"><FiX size={22} /></button>
                                </div>
                                <div className="p-3 pb-8">{renderLoggingForm()}</div>
                            </div>
                        )}

                        {/* ═══ MOBILE: FAB ═══ */}
                        {!isLoggingOpen && (
                            <button
                                onClick={() => setIsLoggingOpen(true)}
                                className="md:hidden fixed bottom-[90px] right-6 z-[100] px-6 py-4 rounded-full bg-emerald-500 text-black shadow-2xl shadow-emerald-500/50 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-sm active:scale-90 transition-all"
                            >
                                <FiPlus size={22} /> Add Food
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Research Modal */}
            {researchIngredient && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-8">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setResearchIngredient(null)} />
                    <div className="relative bg-background border-t md:border border-white/10 rounded-t-[2rem] md:rounded-[2.5rem] shadow-2xl w-full md:max-w-5xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto overflow-x-hidden animate-in slide-in-from-bottom duration-300 md:animate-in md:fade-in md:zoom-in-95">
                        <button onClick={() => setResearchIngredient(null)} className="absolute top-4 right-4 md:top-6 md:right-6 p-2.5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-all z-50 min-h-[44px] min-w-[44px] flex items-center justify-center"><FiX size={22} /></button>
                        <div className="p-1 md:p-2">
                             <IngredientResearchComponent 
                                initialSearchTerm={researchIngredient.name} 
                                initialQuantity={researchIngredient.quantity || 100} 
                                initialQuantityUnit={researchIngredient.unit || "gram"} 
                                initialViewMode="price" 
                                autoSearch={true}
                                autoSwitchToNutrition={true}
                                isAdmin={isAdmin}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Nutrient Research Modal */}
            {selectedNutrientForResearch && (
                <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center md:p-8">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedNutrientForResearch(null)} />
                    <div className="relative bg-background border-t md:border border-white/10 rounded-t-[2rem] md:rounded-[2.5rem] shadow-2xl w-full md:max-w-4xl h-[80vh] md:h-auto md:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300 md:animate-in md:fade-in md:zoom-in-95">
                        <NutrientResearchModal 
                            nutrientKey={selectedNutrientForResearch} 
                            onClose={() => setSelectedNutrientForResearch(null)} 
                            onResearch={(name) => {
                                setSelectedNutrientForResearch(null);
                                setResearchIngredient({ name, quantity: 100, unit: 'gram' });
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
