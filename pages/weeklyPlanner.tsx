import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { Layout } from '../components/Layout';
import { useAuthGuard } from '../lib/useAuthGuard';
import { FiChevronRight as FiChevronRightSolid, FiChevronLeft as FiChevronLeftSolid, FiPlus as FiPlusSolid, FiSave as FiSaveSolid, FiShoppingCart as FiShoppingCartSolid, FiTrash2 as FiTrash2Solid, FiInfo as FiInfoSolid, FiCoffee as FiCoffeeSolid, FiCalendar as FiCalendarSolid, FiX as FiXSolid } from 'react-icons/fi';
import SearchableDropdown from '../components/SearchableDropdown';

export default function WeeklyPlanner() {
    const isAuthed = useAuthGuard();

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    const [plan, setPlan] = useState({ defaultServings: 2, plannedRecipes: [], everydayItems: [] });
    const [allRecipes, setAllRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [newEverydayQty, setNewEverydayQty] = useState(1);

    // Modal state
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [modalSelectedRecipeIds, setModalSelectedRecipeIds] = useState(new Set());

    useEffect(() => {
        if (isAuthed) {
            fetchData();
        }
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

            if (planData.success && planData.plan) {
                setPlan(planData.plan);
            } else {
                setPlan({ defaultServings: 2, plannedRecipes: [], everydayItems: [] });
            }

            if (recipesData.res) {
                setAllRecipes(recipesData.res);
            }

        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const changeWeek = (offsetDays) => {
        const [y, m, d] = startDate.split('-').map(Number);
        const newD = new Date(y, m - 1, d);
        newD.setDate(newD.getDate() + offsetDays);
        setStartDate(`${newD.getFullYear()}-${String(newD.getMonth() + 1).padStart(2, '0')}-${String(newD.getDate()).padStart(2, '0')}`);
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
                body: JSON.stringify({ startDate, ...plan })
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

    // --- Everyday Items ---
    const addEverydayItem = (recipeId) => {
        if (!recipeId) return;
        const recipe = allRecipes.find(r => r._id === recipeId);
        if (!recipe) return;
        setPlan(prev => ({
            ...prev,
            everydayItems: [...prev.everydayItems, { name: recipe.name, quantity: newEverydayQty, recipe_id: recipe._id }]
        }));
        setNewEverydayQty(1);
    };

    const removeEverydayItem = (idx) => {
        setPlan(prev => ({
            ...prev,
            everydayItems: prev.everydayItems.filter((_, i) => i !== idx)
        }));
    };

    // --- Recipe Modal & Pool logic ---
    const openModal = () => {
        setModalSelectedRecipeIds(new Set());
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

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const undecidedRecipes = plan.plannedRecipes.filter(r => r.day === 'Undecided');

    return (
        <Layout title="Weekly Planner" description="Plan your meals for the week">
            <div className="max-w-7xl mx-auto pb-20 relative">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 glass-card p-6 z-10 relative">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <button onClick={() => changeWeek(-7)} className="p-2 hover:bg-white/10 rounded-lg text-emerald-500 transition-colors">
                            <FiChevronLeftSolid size={24} />
                        </button>
                        <h1 className="text-2xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                            Week of {startDate}
                        </h1>
                        <button onClick={() => changeWeek(7)} className="p-2 hover:bg-white/10 rounded-lg text-emerald-500 transition-colors">
                            <FiChevronRightSolid size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
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
                            onClick={handleExport}
                            disabled={exporting}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                        >
                            <FiShoppingCartSolid /> {exporting ? 'Exporting...' : 'Export List'}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                        {/* Sidebar (Pool & Settings) */}
                        <div className="lg:col-span-1 space-y-6">

                            {/* Undecided Pool */}
                            <div
                                className="glass-card border-blue-500/30"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, 'Undecided')}
                            >
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                                        <FiInfoSolid /> Recipe Pool
                                    </h3>
                                    <button onClick={openModal} className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-bold px-2 py-1 rounded-md transition-colors">
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

                            {/* Everyday Items */}
                            <div className="glass-card relative z-40">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-emerald-400">
                                    <FiCoffeeSolid /> Everyday Items
                                </h3>
                                <p className="text-xs text-muted-foreground mb-4">Items to always include in your shopping list (select from recipes).</p>

                                <div className="space-y-2 mb-4">
                                    {plan.everydayItems.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-black/20 p-2 rounded-lg border border-white/5">
                                            <span className="font-medium text-sm">{item.quantity}x {item.name}</span>
                                            <button onClick={() => removeEverydayItem(idx)} className="text-rose-500 hover:text-rose-400 p-1">
                                                <FiTrash2Solid size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2 relative">
                                    <input
                                        type="number" min="1"
                                        value={newEverydayQty}
                                        onChange={e => setNewEverydayQty(parseInt(e.target.value) || 1)}
                                        className="w-16 bg-background border border-white/10 rounded-lg px-2 text-sm z-10 relative"
                                    />
                                    <div className="flex-1 relative z-50">
                                        <SearchableDropdown
                                            options={recipeOptions}
                                            placeholder="Find recipe..."
                                            onChange={(e) => addEverydayItem(e.target.value)}
                                            name=""
                                            value=""
                                            onComplete={() => { }}
                                        />
                                    </div>
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
                        </div>

                        {/* Main Grid */}
                        <div className="lg:col-span-3">
                            <div className="space-y-4 relative z-0">
                                {days.map((day) => {
                                    const dayRecipes = plan.plannedRecipes.filter(r => r.day === day);
                                    return (
                                        <div key={day} className="glass-card flex flex-col gap-4 transition-colors">
                                            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                                <h2 className="text-lg font-black tracking-widest uppercase">{day}</h2>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {['Breakfast', 'Lunch', 'Dinner'].map(meal => {
                                                    const mealRecipes = dayRecipes.filter(r => r.mealType === meal);
                                                    return (
                                                        <div
                                                            key={meal}
                                                            className="flex flex-col bg-black/20 rounded-xl p-3 border border-white/5 min-h-[120px]"
                                                            onDragOver={handleDragOver}
                                                            onDrop={(e) => handleDrop(e, day, meal)}
                                                        >
                                                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{meal}</h3>
                                                            {mealRecipes.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {mealRecipes.map((r, idx) => (
                                                                        <div
                                                                            key={r.id || r._id || idx}
                                                                            draggable
                                                                            onDragStart={(e) => handleDragStart(e, r)}
                                                                            className={`cursor-grab active:cursor-grabbing transition-all rounded-xl p-3 border flex items-start justify-between group ${r.isLeftover ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                                                        >
                                                                            <div>
                                                                                {r.isLeftover && <div className="text-[10px] font-bold text-amber-500 mb-1 uppercase tracking-wider">(Leftovers)</div>}
                                                                                <div className="font-bold text-sm leading-tight">{r.recipe_name}</div>
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
                                                            ) : (
                                                                <div className="flex-1 flex items-center justify-center border border-dashed border-white/5 rounded-lg text-muted-foreground/30 text-[10px] font-bold uppercase tracking-widest mt-1">
                                                                    Drop here
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                )}
            </div>

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
                        <div className="p-4 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
                            {Object.entries(
                                allRecipes.reduce((acc, r) => {
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
                                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Serves: {r.servings || 1} • {r.genre || 'General'}</div>
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
