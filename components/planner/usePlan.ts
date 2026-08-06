import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthGuard } from '../../lib/useAuthGuard';
import { CURRENT_PLAN_VERSION } from '../../lib/planVersion';
import { getDateRange, addDays, todayStr, daysBetween, parseFlexibleDate } from '../../lib/dateUtils';
import { fetchPlan, postPlan, postPlanKeepAlive, fetchAnalysis, postExport, fetchRecipes } from './dataLayer';
import { Plan, PlanAnalysis, Recipe, SaveStatus, BrowseTarget } from './types';
import { MAX_DAYS } from './types';
import { makeKey, newTempId } from './utils';

const emptyPlan = (): Plan => ({ defaultServings: 2, plannedRecipes: [], everydayItems: [], numDays: 7, pantryPlacements: {} });

export function usePlan() {
    const isAuthed = useAuthGuard();

    const [startDate, setStartDate] = useState(() => todayStr());
    const [numDays, setNumDays] = useState(7);
    const [plan, setPlan] = useState<Plan>(emptyPlan);
    const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [exporting, setExporting] = useState(false);
    const [analysis, setAnalysis] = useState<PlanAnalysis | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    const [newEverydayQty, setNewEverydayQty] = useState(1);

    // Modal state
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [modalSelectedRecipeIds, setModalSelectedRecipeIds] = useState<Set<string>>(new Set());
    const [modalOnlySnacks, setModalOnlySnacks] = useState(false);
    const [modalGroupBy, setModalGroupBy] = useState<'carb' | 'meal' | 'genre'>('carb');
    const [modalMealFilters, setModalMealFilters] = useState<Set<string>>(new Set());
    const [modalSearch, setModalSearch] = useState('');
    const [browseTarget, setBrowseTarget] = useState<BrowseTarget | null>(null);

    // Mobile pool drawer
    const [mobilePoolOpen, setMobilePoolOpen] = useState(false);

    // Combine zone holds the first dropped item, waiting for a second
    const [combinePendingId, setCombinePendingId] = useState<string | null>(null);

    // Editable date-range fields (typed text + tick to apply)
    const [draftStart, setDraftStart] = useState(startDate);
    const [draftEnd, setDraftEnd] = useState(addDays(startDate, numDays - 1));
    const [rangeError, setRangeError] = useState(false);

    // Autosave / analysis debounce refs
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const analysisTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const analysisSeq = useRef(0);
    const lastSavedRef = useRef('');
    const loadedStartRef = useRef(startDate);
    // Set when a pantry mutation occurs: save immediately instead of debouncing.
    const immediateSaveRef = useRef(false);
    // Latest unsaved plan (for flushing pending edits on refresh / tab hide).
    const pendingSaveRef = useRef<{ startDate: string; plan: any } | null>(null);

    const dates = useMemo(() => getDateRange(startDate, numDays), [startDate, numDays]);
    const endDate = dates[dates.length - 1];

    const planWithRange = useMemo(() => ({ ...plan, numDays }), [plan, numDays]);
    // Content-only snapshot (no startDate) so navigating weeks never autosaves the wrong plan
    const planContentSnapshot = useMemo(() => JSON.stringify({
        defaultServings: plan.defaultServings,
        plannedRecipes: plan.plannedRecipes,
        everydayItems: plan.everydayItems,
        pantryPlacements: plan.pantryPlacements || {},
        numDays
    }), [plan, numDays]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const planData = await fetchPlan(startDate);
            const recipes = await fetchRecipes();
            setAllRecipes(recipes);

            if (planData.success && planData.plan && planData.plan.version === CURRENT_PLAN_VERSION) {
                const loaded = { ...planData.plan, pantryPlacements: planData.plan.pantryPlacements || {} };
                setPlan(loaded);
                if (!planData.created && planData.plan.numDays) {
                    setNumDays(planData.plan.numDays);
                }
                loadedStartRef.current = planData.plan.startDate || startDate;
                lastSavedRef.current = JSON.stringify({
                    defaultServings: loaded.defaultServings,
                    plannedRecipes: loaded.plannedRecipes,
                    everydayItems: loaded.everydayItems,
                    pantryPlacements: loaded.pantryPlacements,
                    numDays: loaded.numDays || 7
                });
            } else {
                setPlan(emptyPlan());
                loadedStartRef.current = startDate;
                lastSavedRef.current = JSON.stringify({ defaultServings: 2, plannedRecipes: [], everydayItems: [], pantryPlacements: {}, numDays: 7 });
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, [startDate]);

    useEffect(() => {
        if (isAuthed) {
            fetchData();
        }
    }, [isAuthed, fetchData]);

    // Autosave whenever the plan content changes. Pantry mutations bypass the
    // debounce (immediateSaveRef) so a quick refresh can never lose them.
    useEffect(() => {
        if (!isAuthed || loading) return;
        if (planContentSnapshot === lastSavedRef.current) {
            immediateSaveRef.current = false;
            return;
        }

        const doSave = async () => {
            try {
                await postPlan(loadedStartRef.current, planWithRange);
                lastSavedRef.current = planContentSnapshot;
                pendingSaveRef.current = null;
                setSaveStatus('saved');
            } catch (err) {
                console.error(err);
                setSaveStatus('error');
            }
        };

        setSaveStatus('saving');
        pendingSaveRef.current = { startDate: loadedStartRef.current, plan: planWithRange };

        if (immediateSaveRef.current) {
            immediateSaveRef.current = false;
            doSave();
            return;
        }

        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            saveTimer.current = null;
            doSave();
        }, 500);
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, [isAuthed, loading, planContentSnapshot, planWithRange]);

    // Clear pending saves when switching weeks so old-week edits are never
    // POSTed under the new week's startDate after navigation.
    useEffect(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = null;
        pendingSaveRef.current = null;
    }, [startDate]);

    // Flush any pending (unsaved) plan edits when the tab is being closed,
    // hidden, or the page is refreshed — before the debounced autosave can run.
    useEffect(() => {
        const flush = () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            if (pendingSaveRef.current) {
                postPlanKeepAlive(pendingSaveRef.current.startDate, pendingSaveRef.current.plan);
                pendingSaveRef.current = null;
            }
        };
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') flush();
        };
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('pagehide', flush);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    // Live analysis (debounced) whenever the plan changes
    useEffect(() => {
        if (!isAuthed || loading) return;
        if (analysisTimer.current) clearTimeout(analysisTimer.current);
        analysisTimer.current = setTimeout(async () => {
            const seq = ++analysisSeq.current;
            setAnalyzing(true);
            try {
                const data = await fetchAnalysis(planWithRange);
                if (seq === analysisSeq.current) {
                    if (data.success) setAnalysis(data.analysis);
                    else console.error('Analysis failed:', data.message);
                }
            } catch (err) {
                console.error(err);
            } finally {
                if (seq === analysisSeq.current) setAnalyzing(false);
            }
        }, 1000);
        return () => {
            if (analysisTimer.current) clearTimeout(analysisTimer.current);
        };
    }, [isAuthed, loading, planWithRange]);

    // Clear the pending combine partner if that item is removed or moved away
    useEffect(() => {
        if (combinePendingId && !plan.plannedRecipes.some(r => makeKey(r) === combinePendingId)) {
            setCombinePendingId(null);
        }
    }, [plan.plannedRecipes, combinePendingId]);

    // Keep draft fields in sync when the range changes externally
    useEffect(() => {
        setDraftStart(startDate);
        setDraftEnd(endDate);
        setRangeError(false);
    }, [startDate, endDate]);

    // --- Date range navigation ---
    const changeStart = useCallback((offsetDays: number) => {
        setStartDate(addDays(startDate, offsetDays));
    }, [startDate]);

    const applyPreset = useCallback((newStart: string, days = 7) => {
        setStartDate(newStart);
        setNumDays(days);
    }, []);

    const applyDraftRange = useCallback(() => {
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
    }, [draftStart, draftEnd]);

    const onRangeKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyDraftRange();
        }
    }, [applyDraftRange]);

    // --- Save / Export ---
    const handleSave = useCallback(async () => {
        setSaveStatus('saving');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        pendingSaveRef.current = null;
        try {
            await postPlan(loadedStartRef.current, planWithRange);
            lastSavedRef.current = planContentSnapshot;
            setSaveStatus('saved');
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
        }
    }, [planWithRange, planContentSnapshot]);

    const handleExport = useCallback(async () => {
        setExporting(true);
        try {
            // Flush any pending autosave first, since export reads from the DB
            await handleSave();
            const data = await postExport(loadedStartRef.current);
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
    }, [handleSave]);

    // --- Pantry Pool ---
    const addEverydayItem = useCallback((recipeId: string) => {
        if (!recipeId) return;
        const recipe = allRecipes.find(r => r._id === recipeId);
        if (!recipe) return;
        immediateSaveRef.current = true;
        setPlan(prev => ({
            ...prev,
            everydayItems: [...prev.everydayItems, { name: recipe.name, quantity: newEverydayQty * numDays, recipe_id: recipe._id }]
        }));
        setNewEverydayQty(1);
    }, [allRecipes, newEverydayQty, numDays]);

    const updateEverydayQty = useCallback((idx: number, qty: number) => {
        immediateSaveRef.current = true;
        setPlan(prev => ({
            ...prev,
            everydayItems: prev.everydayItems.map((item, i) => i === idx ? { ...item, quantity: qty } : item)
        }));
    }, []);

    const removeEverydayItem = useCallback((idx: number) => {
        immediateSaveRef.current = true;
        setPlan(prev => {
            const everydayItems = prev.everydayItems.filter((_, i) => i !== idx);
            // Re-index placements: drop references to the removed item, shift later ones down
            const pantryPlacements = {};
            Object.entries(prev.pantryPlacements || {}).forEach(([key, list]) => {
                const adjusted = list
                    .filter(i => i !== idx)
                    .map(i => i > idx ? i - 1 : i);
                if (adjusted.length) pantryPlacements[key] = adjusted;
            });
            return { ...prev, everydayItems, pantryPlacements };
        });
    }, []);

    // Visual-only: pin/unpin a pantry pool item into a specific meal slot
    const togglePantryPlacement = useCallback((itemIndex: number, day: string, mealType: string) => {
        immediateSaveRef.current = true;
        setPlan(prev => {
            const key = `${day}|${mealType}`;
            const placements = { ...(prev.pantryPlacements || {}) };
            const list = placements[key] ? [...placements[key]] : [];
            const pos = list.indexOf(itemIndex);
            if (pos >= 0) list.splice(pos, 1);
            else list.push(itemIndex);
            if (list.length === 0) delete placements[key];
            else placements[key] = list;
            return { ...prev, pantryPlacements: placements };
        });
    }, []);

    // --- Modal helpers ---
    const openModal = useCallback((onlySnacks = false, target: BrowseTarget | null = null) => {
        setModalOnlySnacks(onlySnacks);
        setModalGroupBy('carb');
        setModalMealFilters(target?.mealType ? new Set([target.mealType]) : new Set());
        setModalSearch('');
        setBrowseTarget(target);
        setShowRecipeModal(true);
    }, []);

    const closeModal = useCallback(() => setShowRecipeModal(false), []);

    const toggleMealFilter = useCallback((m: string) => {
        setModalMealFilters(prev => {
            const next = new Set(prev);
            if (next.has(m)) next.delete(m);
            else next.add(m);
            return next;
        });
    }, []);

    const handleToggleModalRecipe = useCallback((id: string) => {
        setModalSelectedRecipeIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // --- Recipe additions (with auto-split) ---
    const confirmModalRecipes = useCallback(() => {
        if (browseTarget?.pantry) {
            // Pantry mode: add selected recipes as everyday items (no auto-split)
            immediateSaveRef.current = true;
            const newItems = [];
            modalSelectedRecipeIds.forEach((id: string) => {
                const recipe = allRecipes.find(r => r._id === id);
                if (recipe) {
                    newItems.push({
                        name: recipe.name,
                        quantity: newEverydayQty * numDays,
                        recipe_id: recipe._id
                    });
                }
            });
            setPlan(prev => ({
                ...prev,
                everydayItems: [...prev.everydayItems, ...newItems]
            }));
            setShowRecipeModal(false);
            return;
        }

        const newRecipes = [];
        modalSelectedRecipeIds.forEach((id: string) => {
            const recipe = allRecipes.find(r => r._id === id);
            if (recipe) {
                const serves = recipe.servings || 1;
                const targetDay = browseTarget?.day || 'Undecided';
                const targetMeal = browseTarget?.mealType || 'Dinner';
                newRecipes.push({
                    recipe_id: recipe._id,
                    recipe_name: recipe.name,
                    servings: plan.defaultServings,
                    day: targetDay,
                    mealType: targetMeal,
                    carbType: recipe.carbType || 'Uncategorized',
                    isLeftover: false,
                    id: newTempId()
                });

                if (serves > plan.defaultServings) {
                    newRecipes.push({
                        recipe_id: recipe._id,
                        recipe_name: `${recipe.name} (Leftovers)`,
                        servings: serves - plan.defaultServings,
                        day: 'Undecided',
                        mealType: 'Lunch',
                        carbType: recipe.carbType || 'Uncategorized',
                        isLeftover: true,
                        id: newTempId()
                    });
                }
            }
        });

        setPlan(prev => ({
            ...prev,
            plannedRecipes: [...prev.plannedRecipes, ...newRecipes]
        }));
        setShowRecipeModal(false);
    }, [modalSelectedRecipeIds, allRecipes, plan.defaultServings, browseTarget, newEverydayQty, numDays]);

    const removePlannedRecipe = useCallback((idToRemove: string) => {
        setPlan(prev => ({
            ...prev,
            plannedRecipes: prev.plannedRecipes.filter(r => r.id !== idToRemove && r._id !== idToRemove)
        }));
    }, []);

    // Add an "Average Meal" placeholder to the pool. It's counted at average
    // meal values in analysis once placed on a day (and contributes nothing
    // while left Undecided).
    const addAverageMeal = useCallback(() => {
        setPlan(prev => ({
            ...prev,
            plannedRecipes: [
                ...prev.plannedRecipes,
                {
                    recipe_name: 'Average Meal',
                    servings: prev.defaultServings,
                    day: 'Undecided',
                    mealType: 'Dinner',
                    isAverageMeal: true,
                    id: newTempId()
                }
            ]
        }));
    }, []);

    // Merge two specific plan items (same recipe + day) into one block, adding servings
    // Button-based split: split an item in half (or by given amount)
    const splitRecipe = useCallback((id: string, amount?: number) => {
        setPlan(prev => {
            const item = prev.plannedRecipes.find(r => makeKey(r) === id);
            if (!item) return prev;
            const total = Number(item.servings) || 0;
            if (total < 2) return prev;
            const splitAmount = amount && amount > 0 && amount < total
                ? amount
                : Math.ceil(total / 2);
            const recipe = allRecipes.find(r => r._id === item.recipe_id);
            const baseName = recipe ? recipe.name : String(item.recipe_name || '').replace(/\s*\(Leftovers\)\s*$/i, '');
            const splitBlock = {
                ...item,
                recipe_name: `${baseName} (Leftovers)`,
                servings: splitAmount,
                mealType: 'Lunch',
                isLeftover: true,
                _id: undefined,
                id: newTempId()
            };
            const updated = prev.plannedRecipes.map(r => {
                if (makeKey(r) === id) {
                    return { ...r, servings: total - splitAmount };
                }
                return r;
            });
            return { ...prev, plannedRecipes: [...updated, splitBlock] };
        });
    }, [allRecipes]);

    const mergeTwoItems = useCallback((keyA: string, keyB: string) => {
        if (keyA === keyB) return;
        setPlan(prev => {
            const a = prev.plannedRecipes.find(r => makeKey(r) === keyA);
            const b = prev.plannedRecipes.find(r => makeKey(r) === keyB);
            if (!a || !b) return prev;
            if (!a.recipe_id || a.recipe_id !== b.recipe_id || a.day !== b.day) return prev;
            const keeper = { ...a, servings: (Number(a.servings) || 0) + (Number(b.servings) || 0), isLeftover: false, id: newTempId() };
            const removeKeys = [keyA, keyB];
            return {
                ...prev,
                plannedRecipes: [
                    ...prev.plannedRecipes.filter(r => {
                        const k = makeKey(r);
                        return !removeKeys.includes(k);
                    }),
                    keeper
                ]
            };
        });
    }, []);

    // --- Drag and Drop ---
    const handleDragStart = useCallback((e, recipeItem) => {
        e.dataTransfer.setData('text/plain', makeKey(recipeItem));
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
    }, []);

    const handleDrop = useCallback((e, targetDay: string, targetMealType: string | null = null) => {
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
    }, []);

    // Drag an item onto the Split zone to split it in half
    const handleSplitDrop = useCallback((e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId) return;
        setPlan(prev => {
            const item = prev.plannedRecipes.find(r => makeKey(r) === draggedId);
            if (!item) return prev;
            const total = Number(item.servings) || 0;
            if (total < 2) return prev;
            const splitAmount = Math.ceil(total / 2);
            const recipe = allRecipes.find(r => r._id === item.recipe_id);
            const baseName = recipe ? recipe.name : String(item.recipe_name || '').replace(/\s*\(Leftovers\)\s*$/i, '');
            const splitBlock = {
                ...item,
                recipe_name: `${baseName} (Leftovers)`,
                servings: splitAmount,
                mealType: 'Lunch',
                isLeftover: true,
                _id: undefined,
                id: newTempId()
            };
            const updated = prev.plannedRecipes.map(r => {
                if (makeKey(r) === draggedId) {
                    return { ...r, servings: total - splitAmount };
                }
                return r;
            });
            return { ...prev, plannedRecipes: [...updated, splitBlock] };
        });
    }, [allRecipes]);

    // Drag TWO items onto the Combine zone to add their quantities
    const handleCombineDrop = useCallback((e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId) return;
        const item = plan.plannedRecipes.find(r => makeKey(r) === draggedId);
        if (!item || !item.recipe_id) return;

        if (!combinePendingId || combinePendingId === draggedId) {
            setCombinePendingId(draggedId);
            return;
        }

        const pendingItem = plan.plannedRecipes.find(r => makeKey(r) === combinePendingId);
        if (!pendingItem || pendingItem.recipe_id !== item.recipe_id || pendingItem.day !== item.day) {
            setCombinePendingId(null);
            return;
        }
        mergeTwoItems(combinePendingId, draggedId);
        setCombinePendingId(null);
    }, [plan.plannedRecipes, combinePendingId, mergeTwoItems]);

    // --- Carb Guidance ---
    const getCarbSuggestions = useCallback(() => {
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
    }, [plan.plannedRecipes, allRecipes]);

    const carbSuggestions = useMemo(() => getCarbSuggestions(), [getCarbSuggestions]);

    const recipeOptions = useMemo(() => allRecipes.map(r => ({ label: r.name, value: r._id })), [allRecipes]);

    const undecidedRecipes = useMemo(() => plan.plannedRecipes.filter(r => r.day === 'Undecided'), [plan.plannedRecipes]);

    const pendingItem = useMemo(() => {
        if (!combinePendingId) return null;
        return plan.plannedRecipes.find(r => makeKey(r) === combinePendingId) || null;
    }, [combinePendingId, plan.plannedRecipes]);

    const isPendingCard = useCallback((r) => {
        return !!combinePendingId && makeKey(r) === combinePendingId;
    }, [combinePendingId]);

    return {
        isAuthed,
        loading,
        saving: saveStatus === 'saving',
        saveStatus,
        exporting,
        analyzing,
        analysis,
        allRecipes,
        recipeOptions,
        plan,
        startDate,
        numDays,
        dates,
        endDate,
        draftStart,
        setDraftStart,
        draftEnd,
        setDraftEnd,
        rangeError,
        setRangeError,
        changeStart,
        applyPreset,
        applyDraftRange,
        onRangeKeyDown,
        handleSave,
        handleExport,
        addEverydayItem,
        updateEverydayQty,
        removeEverydayItem,
        togglePantryPlacement,
        newEverydayQty,
        setNewEverydayQty,
        showRecipeModal,
        openModal,
        closeModal,
        modalOnlySnacks,
        setModalOnlySnacks,
        modalGroupBy,
        setModalGroupBy,
        modalMealFilters,
        setModalMealFilters,
        toggleMealFilter,
        modalSearch,
        setModalSearch,
        modalSelectedRecipeIds,
        handleToggleModalRecipe,
        confirmModalRecipes,
        browseTarget,
        removePlannedRecipe,
        addAverageMeal,
        mergeTwoItems,
        splitRecipe,
        combinePendingId,
        setCombinePendingId,
        pendingItem,
        isPendingCard,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleSplitDrop,
        handleCombineDrop,
        carbSuggestions,
        undecidedRecipes,
        mobilePoolOpen,
        setMobilePoolOpen,
        setPlan
    };
}
