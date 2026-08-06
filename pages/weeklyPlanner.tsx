import React, { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import { Layout } from '../components/Layout';
import { useAuthGuard } from '../lib/useAuthGuard';
import { FiChevronRight as FiChevronRightSolid, FiChevronLeft as FiChevronLeftSolid, FiSave as FiSaveSolid, FiShoppingCart as FiShoppingCartSolid, FiTrash2 as FiTrash2Solid, FiInfo as FiInfoSolid, FiCoffee as FiCoffeeSolid, FiX as FiXSolid, FiActivity as FiActivitySolid, FiDollarSign as FiDollarSignSolid, FiMenu as FiMenuSolid, FiFilter as FiFilterSolid, FiCheck as FiCheckSolid } from 'react-icons/fi';
import SearchableDropdown from '../components/SearchableDropdown';
import { NUTRIENT_LABELS } from '../lib/dailyIntake';
import { CURRENT_PLAN_VERSION } from '../lib/planVersion';
import { getDateRange, formatRangeLabel, addDays, todayStr, getMondayOf, formatShortDate, daysBetween, parseFlexibleDate } from '../lib/dateUtils';

const MAX_DAYS = 14;
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function WeeklyPlanner() {
    const isAuthed = useAuthGuard();

    const [startDate, setStartDate] = useState(() => todayStr());
    const [numDays, setNumDays] = useState(7);

    const [plan, setPlan] = useState({ defaultServings: 2, plannedRecipes: [], everydayItems: [], numDays: 7 });
    const [allRecipes, setAllRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    const [newEverydayQty, setNewEverydayQty] = useState(1);

    // Modal state
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [modalSelectedRecipeIds, setModalSelectedRecipeIds] = useState(new Set());
    const [modalOnlySnacks, setModalOnlySnacks] = useState(false);

    // Mobile pool drawer
    const [mobilePoolOpen, setMobilePoolOpen] = useState(false);

    // Day column refs for jump navigation
    const dayRefs = useRef({} as Record<string, HTMLDivElement | null>);

    const dates = getDateRange(startDate, numDays);
    const endDate = dates[dates.length - 1];

    const planWithRange = useMemo(() => ({ ...plan, numDays }), [plan, numDays]);

    useEffect(() => {
        if (isAuthed) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed, startDate]);

    const fetchData = async () => {
        setLoading(true);
        const token = localStorage.getItem('Token');
        if (!token) return;

        try {
            const planRes = await fetch(`/api/weeklyPlan?startDate=${startDate}`, {
                headers: { edgetoken: token }
            });
            const planData = await planRes.json();

            const recipesRes = await fetch(`/api/Recipe`, {
                headers: { edgetoken: token }
            });
            const recipesData = await recipesRes.json();

            if (planData.success && planData.plan && planData.plan.version === CURRENT_PLAN_VERSION) {
                setPlan(planData.plan);
                // Adopt a saved range length, but not for a freshly created (empty) plan
                if (!planData.created && planData.plan.numDays) {
                    setNumDays(planData.plan.numDays);
                }
            } else {
                // Stale or missing plan: show nothing from the old data shape
                setPlan({ defaultServings: 2, plannedRecipes: [], everydayItems: [], numDays: 7 });
            }

            if (recipesData.res) {
                setAllRecipes(recipesData.res);
            }

        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const changeStart = (offsetDays) => {
        setStartDate(addDays(startDate, offsetDays));
    };

    const applyPreset = (newStart, days = 7) => {
        setStartDate(newStart);
        setNumDays(days);
    };

    // Editable date-range fields (typed text + tick to apply)
    const [draftStart, setDraftStart] = useState(startDate);
    const [draftEnd, setDraftEnd] = useState(endDate);
    const [rangeError, setRangeError] = useState(false);

    useEffect(() => {
        setDraftStart(startDate);
        setDraftEnd(endDate);
        setRangeError(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate]);

    const applyDraftRange = () => {
        const s = parseFlexibleDate(draftStart);
        const e = parseFlexibleDate(draftEnd);
        if (!s || !e) {
            setRangeError(true);
            return;
        }
        const start = s <= e ? s : e;
        const end = s <= e ? e : s;
        const days = Math.min(MAX_DAYS, Math.max(1, daysBetween(start, end)));
        setStartDate(start);
        setNumDays(days);
        setDraftStart(start);
        setDraftEnd(end);
        setRangeError(false);
    };

    const onRangeKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyDraftRange();
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const token = localStorage.getItem('Token');
        try {
            await fetch(`/api/weeklyPlan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    edgetoken: token
                },
                body: JSON.stringify({ startDate, ...planWithRange })
            });
        } catch (err) {
            console.error(err);
        }
        setSaving(false);
    };

    const handleExport = async () => {
        setExporting(true);
        const token = localStorage.getItem('Token');
        try {
            await handleSave();
            const res = await fetch(`/api/weeklyPlan/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    edgetoken: token
                },
                body: JSON.stringify({ startDate })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Successfully exported ${data.addedCount} items to a new Shopping List!`);
            } else {
                alert("Failed to export: " + data.message);
            }
        } catch (err) {
            console.error(err);
            alert("Error exporting");
        }
        setExporting(false);
    };

    const handleAnalyze = async () => {
        setAnalyzing(true);
        const token = localStorage.getItem('Token');
        try {
            const res = await fetch(`/api/weeklyPlan/analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    edgetoken: token
                },
                body: JSON.stringify({ plan: planWithRange })
            });
            const data = await res.json();
            if (data.success) {
                setAnalysis(data.analysis);
            } else {
                alert("Analysis failed: " + data.message);
            }
        } catch (err) {
            console.error(err);
            alert("Error analyzing plan");
        }
        setAnalyzing(false);
    };

    // --- Pantry Pool ---
    const addEverydayItem = (recipeId) => {
        if (!recipeId) return;
        const recipe = allRecipes.find(r => r._id === recipeId);
        if (!recipe) return;
        setPlan(prev => ({
            ...prev,
            everydayItems: [...prev.everydayItems, { name: recipe.name, quantity: newEverydayQty * numDays, recipe_id: recipe._id }]
        }));
        setNewEverydayQty(1);
    };

    const updateEverydayQty = (idx, qty) => {
        setPlan(prev => ({
            ...prev,
            everydayItems: prev.everydayItems.map((item, i) => i === idx ? { ...item, quantity: qty } : item)
        }));
    };

    const removeEverydayItem = (idx) => {
        setPlan(prev => ({
            ...prev,
            everydayItems: prev.everydayItems.filter((_, i) => i !== idx)
        }));
    };

    // --- Recipe Modal & Pool logic ---
    const isSnackRecipe = (r) =>
        (r.mealTypes || []).some(m => /snack/i.test(m)) || /snack/i.test(r.genre || '');

    const openModal = (onlySnacks = false) => {
        setModalSelectedRecipeIds(new Set());
        setModalOnlySnacks(onlySnacks);
        setShowRecipeModal(true);
    };

    const handleToggleModalRecipe = (id) => {
        setModalSelectedRecipeIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const confirmModalRecipes = () => {
        const newRecipes = [];
        modalSelectedRecipeIds.forEach(id => {
            const recipe = allRecipes.find(r => r._id === id);
            if (recipe) {
                const serves = recipe.servings || 1;
                // Main recipe block
                newRecipes.push({
                    recipe_id: recipe._id,
                    recipe_name: recipe.name,
                    servings: plan.defaultServings,
                    day: 'Undecided',
                    mealType: 'Dinner',
                    carbType: recipe.carbType || 'Uncategorized',
                    isLeftover: false,
                    id: Math.random().toString(36).substr(2, 9) // temporary ID for drag and drop tracking
                });

                // Leftovers block
                if (serves > plan.defaultServings) {
                    newRecipes.push({
                        recipe_id: recipe._id,
                        recipe_name: `${recipe.name} (Leftovers)`,
                        servings: serves - plan.defaultServings,
                        day: 'Undecided',
                        mealType: 'Lunch',
                        carbType: recipe.carbType || 'Uncategorized',
                        isLeftover: true,
                        id: Math.random().toString(36).substr(2, 9)
                    });
                }
            }
        });

        setPlan(prev => ({
            ...prev,
            plannedRecipes: [...prev.plannedRecipes, ...newRecipes]
        }));
        setShowRecipeModal(false);
    };

    const removePlannedRecipe = (idToRemove) => {
        setPlan(prev => ({
            ...prev,
            plannedRecipes: prev.plannedRecipes.filter(r => r.id !== idToRemove && r._id !== idToRemove)
        }));
    };

    // --- Drag and Drop ---
    const handleDragStart = (e, recipeItem) => {
        const id = recipeItem.id || recipeItem._id;
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Allow drop
    };

    const handleDrop = (e, targetDay, targetMealType = null) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');

        setPlan(prev => {
            const nextRecipes = prev.plannedRecipes.map(r => {
                if ((r.id && r.id === draggedId) || (r._id && r._id === draggedId)) {
                    return {
                        ...r,
                        day: targetDay,
                        mealType: targetMealType ? targetMealType : r.mealType
                    };
                }
                return r;
            });
            return { ...prev, plannedRecipes: nextRecipes };
        });
    };

    const scrollToDay = (date) => {
        dayRefs.current[date]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    };

    // --- Carb Guidance ---
    const getCarbSuggestions = () => {
        const plannedRecipeIds = plan.plannedRecipes.map(r => r.recipe_id);
        const plannedR = allRecipes.filter(r => plannedRecipeIds.includes(r._id));

        let carbSources = { rice: false, pasta: false, potato: false, bread: false, noodles: false };
        plannedR.forEach(r => {
            const ings = JSON.stringify(r.ingredients).toLowerCase();
            if (ings.includes('rice')) carbSources.rice = true;
            if (ings.includes('pasta') || ings.includes('spaghetti') || ings.includes('macaroni')) carbSources.pasta = true;
            if (ings.includes('potato')) carbSources.potato = true;
            if (ings.includes('bread') || ings.includes('bun') || ings.includes('toast')) carbSources.bread = true;
            if (ings.includes('noodle')) carbSources.noodles = true;
        });

        let suggestions = [];
        const missingCarbs = Object.keys(carbSources).filter(k => !carbSources[k]);

        if (missingCarbs.length > 0) {
            allRecipes.forEach(r => {
                if (plannedRecipeIds.includes(r._id)) return;
                const ings = JSON.stringify(r.ingredients).toLowerCase();
                for (let carb of missingCarbs) {
                    if (ings.includes(carb)) {
                        suggestions.push({ recipe: r, carb });
                        break;
                    }
                }
            });
        }

        return suggestions.sort(() => 0.5 - Math.random()).slice(0, 3);
    };

    const carbSuggestions = useMemo(() => getCarbSuggestions(), [plan.plannedRecipes, allRecipes]);

    const recipeOptions = allRecipes.map(r => ({ label: r.name, value: r._id }));

    if (!isAuthed) return null;

    const undecidedRecipes = plan.plannedRecipes.filter(r => r.day === 'Undecided');

    const sidebarContent = (
        <div className="space-y-6">
            {/* Recipe Pool */}
            <div
                className="glass-card border-blue-500/30"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'Undecided')}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                        <FiInfoSolid /> Recipe Pool
                    </h3>
                    <button onClick={() => openModal(false)} className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-bold px-2 py-1 rounded-md transition-colors">
                        + Browse
                    </button>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Drag these recipes to your days!</p>

                <div className="space-y-2 min-h-[100px]">
                    {undecidedRecipes.length === 0 ? (
                        <div className="text-center p-4 border border-dashed border-white/10 rounded-xl text-muted-foreground/50 text-xs font-bold uppercase tracking-widest">
                            Pool Empty
                        </div>
                    ) : (
                        Object.entries(
                            undecidedRecipes.reduce((acc, r) => {
                                const type = r.carbType || 'Uncategorized';
                                if (!acc[type]) acc[type] = [];
                                acc[type].push(r);
                                return acc;
                            }, {})
                        ).sort(([a], [b]) => a.localeCompare(b)).map(([carbType, recipes]) => (
                            <div key={carbType} className="mb-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1 border-b border-white/10 pb-1 inline-block">{carbType}</h4>
                                <div className="space-y-2">
                                    {(recipes as any[]).map((r, idx) => (
                                        <div
                                            key={r.id || r._id || idx}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, r)}
                                            className={`cursor-grab active:cursor-grabbing p-3 rounded-lg border flex items-start justify-between group transition-all ${r.isLeftover ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                        >
                                            <div>
                                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{r.mealType}</div>
                                                <div className="font-bold text-sm">{r.recipe_name}</div>
                                                <div className="text-xs text-muted-foreground mt-1">Serves: {r.servings}</div>
                                            </div>
                                            <button
                                                onClick={() => removePlannedRecipe(r.id || r._id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-400 p-1"
                                            >
                                                <FiTrash2Solid size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Pantry Pool */}
            <div className="glass-card relative z-40">
                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-emerald-400">
                    <FiCoffeeSolid /> Pantry Pool
                </h3>
                <p className="text-xs text-muted-foreground mb-4">Enter per-day amounts — spread evenly across your {numDays} {numDays === 1 ? 'day' : 'days'}.</p>

                <div className="space-y-2 mb-4">
                    {plan.everydayItems.length === 0 ? (
                        <div className="text-center p-3 border border-dashed border-white/10 rounded-xl text-muted-foreground/50 text-xs font-bold uppercase tracking-widest">
                            Pool Empty
                        </div>
                    ) : (
                        plan.everydayItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-black/20 p-2 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        value={Math.round((item.quantity / numDays) * 100) / 100}
                                        onChange={(e) => updateEverydayQty(idx, (parseFloat(e.target.value) || 0) * numDays)}
                                        className="w-16 bg-background border border-white/10 rounded-lg px-2 text-sm"
                                        title="Quantity per day"
                                    />
                                    <div className="min-w-0">
                                        <div className="font-medium text-sm truncate">{item.name}</div>
                                        <div className="text-[10px] text-muted-foreground">{Math.round(item.quantity * 10) / 10} total over {numDays} {numDays === 1 ? 'day' : 'days'}</div>
                                    </div>
                                </div>
                                <button onClick={() => removeEverydayItem(idx)} className="text-rose-500 hover:text-rose-400 p-1">
                                    <FiTrash2Solid size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Qty per day</div>
                    <div className="flex gap-2 relative">
                        <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={newEverydayQty}
                            onChange={e => setNewEverydayQty(parseFloat(e.target.value) || 1)}
                            className="w-16 bg-background border border-white/10 rounded-lg px-2 text-sm z-10 relative"
                            title="Quantity per day"
                        />
                        <div className="flex-1 relative z-50">
                            <SearchableDropdown
                                options={recipeOptions}
                                placeholder="Add to pantry..."
                                onChange={(e) => addEverydayItem(e.target.value)}
                                name=""
                                value=""
                                onComplete={() => { }}
                            />
                        </div>
                    </div>
                    <button onClick={() => openModal(true)} className="text-xs font-bold text-emerald-400/80 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-3 py-1.5 transition-colors text-left">
                        + Browse snacks
                    </button>
                </div>
            </div>

            {/* Carb Guidance */}
            <div className="glass-card bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-purple-400">
                    🥗 Carb Diversity
                </h3>
                {carbSuggestions.length > 0 ? (
                    <>
                        <p className="text-xs text-muted-foreground mb-3">You're missing some diverse carbs. Try adding:</p>
                        <div className="space-y-2">
                            {carbSuggestions.map((sug, idx) => (
                                <div key={idx} className="bg-background/50 p-2 rounded-lg border border-white/5 text-xs">
                                    <span className="font-bold text-purple-300 capitalize">{sug.carb}: </span>
                                    <span className="text-muted-foreground">{sug.recipe.name}</span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="text-xs text-emerald-400 font-bold">Great job! Your selected meals contain a diverse range of carbohydrate sources.</p>
                )}
            </div>

            {/* Analysis Insights */}
            {analysis && (
                <div className="glass-card bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20 relative z-40">
                    <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-emerald-400">
                        <FiActivitySolid /> Plan Insights
                    </h3>

                    <div className="mb-4">
                        <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Average Daily Cost (Per Person)</div>
                        <div className="text-2xl font-black flex items-center gap-1 text-white">
                            <FiDollarSignSolid className="text-emerald-500" />
                            {analysis.averageDailyCostPerPerson?.toFixed(2) || analysis.averageDailyCost.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 font-medium">
                            Total Cost ({numDays} days): ${analysis.totalCost.toFixed(2)}
                        </div>
                        {analysis.everydayCost > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-1 font-medium">
                                Pantry Pool: ${(analysis.everydayCost).toFixed(2)} ({(analysis.everydayCost / analysis.totalCost * 100).toFixed(1)}%)
                            </div>
                        )}
                    </div>

                    {analysis.deficiencies && analysis.deficiencies.length > 0 ? (
                        <>
                            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Deficient Nutrients</div>
                            <div className="space-y-2">
                                {analysis.deficiencies.slice(0, 5).map((def, idx) => {
                                    const label = NUTRIENT_LABELS[def.key]?.label || def.key;
                                    return (
                                        <div key={idx} className="flex items-center justify-between bg-black/20 p-2 rounded-lg border border-white/5 text-xs">
                                            <span className="font-bold text-amber-400">{label}</span>
                                            <span className="text-muted-foreground font-medium">{Math.round(def.pct * 100)}% of target</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <p className="text-xs text-emerald-400 font-bold">Great job! You are hitting all your nutritional targets.</p>
                    )}
                    {analysis.numMissingSlots > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-3 italic">
                            *Includes {analysis.numMissingSlots} unassigned meals calculated at average values.
                        </p>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <Layout title="Weekly Planner" description="Plan your meals for the week">
            <div className="max-w-[1600px] mx-auto pb-20 relative">
                {/* Header */}
                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-6 glass-card p-6 z-10 relative gap-4">
                    <div className="flex items-center gap-3 w-full xl:w-auto">
                        <button onClick={() => changeStart(-numDays)} className="p-2 hover:bg-white/10 rounded-lg text-emerald-500 transition-colors shrink-0">
                            <FiChevronLeftSolid size={24} />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-2xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 whitespace-nowrap">
                                {formatRangeLabel(startDate, numDays)}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {[
                                    { label: 'Next 7 days', fn: () => applyPreset(todayStr(), 7) },
                                    { label: 'This week', fn: () => applyPreset(getMondayOf(todayStr()), 7) },
                                    { label: 'Next week', fn: () => applyPreset(addDays(getMondayOf(todayStr()), 7), 7) },
                                    { label: 'Last 7 days', fn: () => applyPreset(addDays(todayStr(), -6), 7) }
                                ].map((preset) => (
                                    <button
                                        key={preset.label}
                                        onClick={preset.fn}
                                        className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white transition-colors"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        value={draftStart}
                                        onChange={(e) => { setDraftStart(e.target.value); setRangeError(false); }}
                                        onKeyDown={onRangeKeyDown}
                                        placeholder="YYYY-MM-DD"
                                        title="Start date — type it or pick from a preset"
                                        className={`bg-background border border-white/10 rounded-md px-2 py-1 text-xs font-bold text-muted-foreground w-[7.5rem] ${rangeError ? 'border-rose-500' : ''}`}
                                    />
                                    <span className="text-xs text-muted-foreground">→</span>
                                    <input
                                        type="text"
                                        value={draftEnd}
                                        onChange={(e) => { setDraftEnd(e.target.value); setRangeError(false); }}
                                        onKeyDown={onRangeKeyDown}
                                        placeholder="YYYY-MM-DD"
                                        title="End date — type it or pick from a preset"
                                        className={`bg-background border border-white/10 rounded-md px-2 py-1 text-xs font-bold text-muted-foreground w-[7.5rem] ${rangeError ? 'border-rose-500' : ''}`}
                                    />
                                    <button
                                        onClick={applyDraftRange}
                                        title="Apply date range"
                                        className="p-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 transition-colors shrink-0"
                                    >
                                        <FiCheckSolid size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => changeStart(numDays)} className="p-2 hover:bg-white/10 rounded-lg text-emerald-500 transition-colors shrink-0">
                            <FiChevronRightSolid size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap">
                        <div className="flex flex-col items-start">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Default Servings</label>
                            <input
                                type="number"
                                min="1"
                                className="bg-background border border-white/10 rounded-md w-20 px-3 py-1.5 text-center font-bold text-lg"
                                value={plan.defaultServings}
                                onChange={(e) => setPlan(p => ({ ...p, defaultServings: parseInt(e.target.value) || 2 }))}
                            />
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                        >
                            <FiSaveSolid /> {saving ? 'Saving...' : 'Save Plan'}
                        </button>
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing}
                            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
                        >
                            <FiActivitySolid /> {analyzing ? 'Analyzing...' : 'Analyze Plan'}
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                        >
                            <FiShoppingCartSolid /> {exporting ? 'Exporting...' : 'Export List'}
                        </button>
                        <button
                            onClick={() => setMobilePoolOpen(true)}
                            className="xl:hidden bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-400 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all"
                        >
                            <FiMenuSolid /> Pool
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">

                        {/* Sidebar (desktop) */}
                        <div className="hidden xl:block">
                            <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar pr-1">
                                {sidebarContent}
                            </div>
                        </div>

                        {/* Day area */}
                        <div className="min-w-0">
                            {/* Day jump chips */}
                            <div className="sticky top-0 z-30 mb-4 -mx-2 px-2 py-2 bg-background/90 backdrop-blur-md border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
                                {dates.map((d) => (
                                    <button
                                        key={d}
                                        onClick={() => scrollToDay(d)}
                                        className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-300 border border-white/10 text-muted-foreground transition-colors"
                                    >
                                        {formatShortDate(d)}
                                    </button>
                                ))}
                            </div>

                            {/* Horizontal day columns */}
                            <div className="flex gap-4 overflow-x-auto snap-x pb-6 custom-scrollbar items-start">
                                {dates.map((date) => {
                                    const dayRecipes = plan.plannedRecipes.filter(r => r.day === date);
                                    let dayPlannedCost = 0;
                                    let dayMissingSlots = 3;

                                    dayRecipes.forEach(r => {
                                        const rAnalysis = analysis?.recipeAnalysis?.find(a => (a.id === r.id || a.id === r._id));
                                        if (rAnalysis) {
                                            dayPlannedCost += rAnalysis.cost;
                                            dayMissingSlots -= 1;
                                        }
                                    });
                                    const dayTotalCost = analysis ? (dayPlannedCost + (analysis.dailyEverydayCost || 0)) : 0;

                                    return (
                                        <div
                                            key={date}
                                            ref={(el) => { dayRefs.current[date] = el; }}
                                            className="w-[300px] min-w-[300px] snap-start glass-card flex flex-col gap-4"
                                        >
                                            <div className="flex items-center gap-2 border-b border-white/5 pb-2 justify-between">
                                                <h2 className="text-lg font-black tracking-widest uppercase">{formatShortDate(date)}</h2>
                                                {analysis && (
                                                    <div className="text-xs font-bold text-muted-foreground flex flex-col items-end">
                                                        <span className="text-emerald-400">${dayTotalCost.toFixed(2)}</span>
                                                        <span className="text-[10px] font-normal opacity-70">
                                                            Meals: ${(dayPlannedCost).toFixed(2)} • Pool: ${(analysis.dailyEverydayCost || 0).toFixed(2)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                {MEALS.map(meal => {
                                                    const mealRecipes = dayRecipes.filter(r => r.mealType === meal);
                                                    return (
                                                        <div
                                                            key={meal}
                                                            className="flex flex-col bg-black/20 rounded-xl p-3 border border-white/5 min-h-[110px]"
                                                            onDragOver={handleDragOver}
                                                            onDrop={(e) => handleDrop(e, date, meal)}
                                                        >
                                                            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${meal === 'Snack' ? 'text-amber-400/80' : 'text-muted-foreground'}`}>{meal}</h3>
                                                            {mealRecipes.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {mealRecipes.map((r, idx) => {
                                                                        const analysisData = analysis?.recipeAnalysis?.find(a => (a.id === r.id || a.id === r._id));
                                                                        return (
                                                                            <div
                                                                                key={r.id || r._id || idx}
                                                                                draggable
                                                                                onDragStart={(e) => handleDragStart(e, r)}
                                                                                className={`cursor-grab active:cursor-grabbing transition-all rounded-xl p-3 border flex items-start justify-between group ${r.isLeftover ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'} ${analysisData?.isExpensive ? 'ring-1 ring-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : ''} ${analysisData?.isLowNutrition ? 'ring-1 ring-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]' : ''}`}
                                                                            >
                                                                                <div>
                                                                                    {r.isLeftover && <div className="text-[10px] font-bold text-amber-500 mb-1 uppercase tracking-wider">(Leftovers)</div>}
                                                                                    <div className="font-bold text-sm leading-tight">{r.recipe_name}</div>
                                                                                    <div className="flex items-center gap-2 mt-1">
                                                                                        <div className="text-xs text-muted-foreground">Serves: {r.servings}</div>
                                                                                        {analysisData?.cost != null && (
                                                                                            <div className="text-[10px] font-medium text-emerald-400">
                                                                                                ${analysisData.cost.toFixed(2)}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    {(analysisData?.isExpensive || analysisData?.isLowNutrition) && (
                                                                                        <div className="flex items-center gap-2 mt-1">
                                                                                            {analysisData?.isExpensive && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30">Expensive</span>}
                                                                                            {analysisData?.isLowNutrition && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-400 border border-rose-500/30">Low Nutrition</span>}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => removePlannedRecipe(r.id || r._id)}
                                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-400 p-1"
                                                                                >
                                                                                    <FiTrash2Solid size={14} />
                                                                                </button>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="flex-1 flex items-center justify-center border border-dashed border-white/5 rounded-lg text-muted-foreground/30 text-[10px] font-bold uppercase tracking-widest mt-1">
                                                                    Drop here
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Pantry share footer */}
                                            {plan.everydayItems.length > 0 && (
                                                <div className="border-t border-emerald-500/10 pt-3 flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500/70">
                                                        🧺 {plan.everydayItems.length} pantry items
                                                    </span>
                                                    {analysis && analysis.dailyEverydayCost > 0 && (
                                                        <span className="text-xs font-bold text-emerald-400">
                                                            ${(analysis.dailyEverydayCost).toFixed(2)}/day
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* Mobile Pool Drawer */}
            {mobilePoolOpen && (
                <div className="fixed inset-0 z-[90] flex justify-end bg-black/60 backdrop-blur-sm xl:hidden">
                    <div className="w-full max-w-md h-full bg-[#121214] border-l border-white/10 flex flex-col">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-lg font-black tracking-widest uppercase">Pool & Settings</h2>
                            <button onClick={() => setMobilePoolOpen(false)} className="p-2 text-muted-foreground hover:text-white transition-colors">
                                <FiXSolid size={20} />
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                            {sidebarContent}
                        </div>
                    </div>
                </div>
            )}

            {/* Browse Recipes Modal */}
            {showRecipeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-lg font-black tracking-widest uppercase">Browse Recipes</h2>
                            <button onClick={() => setShowRecipeModal(false)} className="p-2 text-muted-foreground hover:text-white transition-colors">
                                <FiXSolid size={20} />
                            </button>
                        </div>
                        <div className="p-4 border-b border-white/5 flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={modalOnlySnacks}
                                    onChange={(e) => setModalOnlySnacks(e.target.checked)}
                                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-amber-500 focus:ring-amber-500/50"
                                />
                                <FiFilterSolid className="text-amber-400" /> Only snacks
                            </label>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
                            {Object.entries(
                                allRecipes
                                    .filter(r => !modalOnlySnacks || isSnackRecipe(r))
                                    .reduce((acc, r) => {
                                        const type = r.carbType || 'Uncategorized';
                                        if (!acc[type]) acc[type] = [];
                                        acc[type].push(r);
                                        return acc;
                                    }, {})
                            ).sort(([a], [b]) => a.localeCompare(b)).map(([carbType, recipes]) => (
                                <div key={carbType}>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
                                        {carbType}
                                        <span className="flex-1 h-px bg-white/5"></span>
                                    </h3>
                                    <div className="space-y-2">
                                        {(recipes as any[]).map(r => (
                                            <label key={r._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-white/5 hover:border-white/10 transition-all group">
                                                <input
                                                    type="checkbox"
                                                    checked={modalSelectedRecipeIds.has(r._id)}
                                                    onChange={() => handleToggleModalRecipe(r._id)}
                                                    className="w-5 h-5 rounded-lg border-white/20 bg-black/50 text-emerald-500 focus:ring-emerald-500/50"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-bold text-sm group-hover:text-emerald-400 transition-colors">{r.name}</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Serves: {r.servings || 1} • {r.genre || 'General'}{isSnackRecipe(r) ? ' • Snack' : ''}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                            <button onClick={() => setShowRecipeModal(false)} className="px-4 py-2 rounded-lg font-bold text-muted-foreground hover:bg-white/5 transition-colors">
                                Cancel
                            </button>
                            <button onClick={confirmModalRecipes} className="px-6 py-2 rounded-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shadow-lg shadow-emerald-500/20">
                                Add Selected ({modalSelectedRecipeIds.size})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
