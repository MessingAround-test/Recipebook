import React, { useState, useEffect, FormEvent } from 'react';
import { quantity_unit_conversions, MAX_SIZE_DEFAULTS, CATEGORY_MAX_SIZES, normalizeToGrams } from "../lib/conversion";
import { Button } from "../components/ui/button"
import 'chart.js/auto';
import { Bar } from 'react-chartjs-2';
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import axios from 'axios';
import SearchableDropdown from './SearchableDropdown';

interface IngredientResearchComponentProps {
    initialSearchTerm?: string;
    initialQuantity?: number | string;
    initialQuantityUnit?: string;
    autoSearch?: boolean;
    excludeTop3?: boolean;
    showForm?: boolean;
    showCharts?: boolean;
    showTable?: boolean;
    isAdmin?: boolean;
    initialViewMode?: 'price' | 'nutrition';
    autoSwitchToNutrition?: boolean;
}

export default function IngredientResearchComponent({
    initialSearchTerm = '',
    initialQuantity = 1,
    initialQuantityUnit = 'each',
    autoSearch = false,
    excludeTop3 = false,
    showForm = true,
    showCharts = true,
    showTable = true,
    isAdmin = false,
    initialViewMode = 'price',
    autoSwitchToNutrition = false
}: IngredientResearchComponentProps) {
    const getCanonicalUnit = (unit: string) => {
        if (!unit || unit === 'any') return 'each';
        const lowerUnit = unit.toLowerCase();

        // Check if it's already a key
        if (quantity_unit_conversions[lowerUnit]) return lowerUnit;

        // Check synonyms and shorthand
        for (const [key, config] of Object.entries(quantity_unit_conversions)) {
            if (config.synonyms.includes(lowerUnit) || config.shorthand.toLowerCase() === lowerUnit) {
                return key;
            }
        }

        return 'each';
    };

    const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
    const [ingredientData, setIngredientData] = useState<any[]>([]);
    const [quantity, setQuantity] = useState<number | string>(initialQuantity);
    const [quantityUnit, setQuantityUnit] = useState(getCanonicalUnit(initialQuantityUnit));
    const [loading, setLoading] = useState(false);
    const [selectedBinIndex, setSelectedBinIndex] = useState<number>(-1);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [chosenProductId, setChosenProductId] = useState<string | null>(null);
    const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(['WW', 'Coles', 'Aldi', 'IGA', 'Panetta']);
    const [skipConversion, setSkipConversion] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('skipConversion') === 'true';
        }
        return false;
    });
    const [comparisonView, setComparisonView] = useState<'table' | 'cards'>('cards');
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [showMoreNutrients, setShowMoreNutrients] = useState(false);
    const [viewMode, setViewMode] = useState<'price' | 'nutrition'>(initialViewMode);
    const [nutritionData, setNutritionData] = useState<any[]>([]);
    const [editingNutrition, setEditingNutrition] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<any>({});
    const [scalingReferenceGrams, setScalingReferenceGrams] = useState<number>(0);
    const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);

    // Max size overrides — persisted in localStorage
    const [maxSizeOverrides, setMaxSizeOverrides] = useState<Record<string, { quantity: number; unit: string }>>(() => {
        if (typeof window !== 'undefined') {
            try { return JSON.parse(localStorage.getItem('maxSizeOverrides') || '{}'); } catch { return {}; }
        }
        return {};
    });

    const deletingIds = useState<Set<string>>(new Set())[0];
    const [deletingIdsState, setDeletingIds] = useState<Set<string>>(new Set());
    const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());

    const executeSearch = async (term: string, unit: string, qty: number | string, skipConv: boolean = false, modeOverride?: 'price' | 'nutrition') => {
        const activeMode = modeOverride || viewMode;
        setLoading(true);
        if (activeMode === 'price') {
            setSelectedBinIndex(-1);
            setSelectedProductId(null);
            setChosenProductId(null);
            setDeletingIds(new Set());
            setSelectedDeleteIds(new Set());

            let url = `/api/Ingredients?name=${encodeURIComponent(term)}&qType=${unit}&quantity=${qty}&supplier=${selectedSuppliers.join(',')}`;
            if (skipConv) url += `&skipConversion=true`;

            // Attach max size params — look up by unit type
            const unitType = unit === 'each' ? 'each' : (unit === 'gram' || unit === 'kilogram' ? 'weight' : 'volume');
            const maxSizeKey = Object.keys(maxSizeOverrides).find(k => k === unitType || k === unit) || null;
            const maxSizeVal = maxSizeKey ? maxSizeOverrides[maxSizeKey] : null;
            if (maxSizeVal) {
                url += `&maxSize=${maxSizeVal.quantity}&maxSizeUnit=${maxSizeVal.unit}`;
            }

            const res = await fetch(url, {
                headers: { 'edgetoken': localStorage.getItem('Token') || "" }
            });
            const data = await res.json();

            if (data.loadedSource === true) {
                const resLoaded = await fetch(url, {
                    headers: { 'edgetoken': localStorage.getItem('Token') || "" }
                });
                const dataLoaded = await resLoaded.json();
                setIngredientData(dataLoaded.res || []);
            } else {
                setIngredientData(data.res || []);
            }
        } else {
            // Nutrition mode
            try {
                const res = await fetch(`/api/Nutrition/admin?search=${encodeURIComponent(term)}`, {
                    headers: { 'edgetoken': localStorage.getItem('Token') || "" }
                });
                const data = await res.json();
                setNutritionData(data.data || []);
            } catch (err) {
                console.error("Error fetching nutrition data:", err);
            }
        }
        setLoading(false);

        if (activeMode === 'price' && autoSwitchToNutrition) {
            setViewMode('nutrition');
            // Re-trigger search for nutrition mode
            executeSearch(term, unit, qty, skipConv, 'nutrition');
        }
    };

    async function handleGetIngredient(e: FormEvent) {
        e.preventDefault();
        await executeSearch(searchTerm, quantityUnit, quantity, skipConversion);
    }

    useEffect(() => {
        const fetchAvailableIngredients = async () => {
            try {
                const res = await fetch('/api/Ingredients/list', {
                    headers: { 'edgetoken': localStorage.getItem('Token') || "" }
                });
                const data = await res.json();
                if (data.success) {
                    setAvailableIngredients(data.data);
                }
            } catch (err) {
                console.error("Failed to fetch ingredient list:", err);
            }
        };
        fetchAvailableIngredients();

        if (autoSearch && initialSearchTerm) {
            const canonicalUnit = getCanonicalUnit(initialQuantityUnit);
            setQuantityUnit(canonicalUnit);
            executeSearch(initialSearchTerm, canonicalUnit, initialQuantity, skipConversion);
        }
    }, [autoSearch, initialSearchTerm, initialQuantity, initialQuantityUnit, skipConversion]);

    async function deleteIngredient(ids: string | string[]) {
        const idArray = Array.isArray(ids) ? ids : [ids];
        if (idArray.length === 0) return;

        if (!confirm(`Are you sure you want to delete ${idArray.length} product(s)? They will be removed from the database.`)) return;

        idArray.forEach(id => setDeletingIds(prev => new Set(prev).add(id)));

        try {
            const idString = idArray.join(',');
            const res = await fetch(`/api/Ingredients/?id=${idString}`, {
                method: 'DELETE',
                headers: { 'edgetoken': localStorage.getItem('Token') || "" }
            });
            const data = await res.json();
            if (data.success) {
                setIngredientData(prev => prev.filter(item => !idArray.includes(item.id)));
                setSelectedDeleteIds(prev => {
                    const next = new Set(prev);
                    idArray.forEach(id => next.delete(id));
                    return next;
                });
            } else {
                alert("Failed to delete: " + data.message);
            }
        } catch (err) {
            alert("Error deleting product(s)");
        } finally {
            idArray.forEach(id => setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            }));
        }
    }

    async function deleteNutritionRecord(id: string, name: string) {
        if (!confirm(`Are you sure you want to delete "${name}"? This will also remove all search logs and cached products for this term. (It will remain on existing shopping lists)`)) return;

        try {
            const res = await fetch(`/api/Nutrition/admin?id=${id}`, {
                method: 'DELETE',
                headers: { 'edgetoken': localStorage.getItem('Token') || "" }
            });
            const data = await res.json();
            if (data.success) {
                setNutritionData(prev => prev.filter(item => item._id !== id));
            } else {
                alert("Failed to delete: " + data.message);
            }
        } catch (err) {
            alert("Error deleting nutrition record");
        }
    }

    async function toggleRecommendation(id: string, currentStatus: boolean | undefined) {
        try {
            const res = await fetch(`/api/Nutrition/admin`, {
                method: 'PUT',
                headers: {
                    'edgetoken': localStorage.getItem('Token') || "",
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, should_recommend: currentStatus === false })
            });
            const data = await res.json();
            if (data.success) {
                setNutritionData(prev => prev.map(item => item._id === id ? { ...item, should_recommend: currentStatus === false } : item));
            } else {
                alert("Failed to update recommendation status: " + data.message);
            }
        } catch (err) {
            alert("Error updating recommendation status");
        }
    }

    async function saveNutrition(id: string) {
        try {
            const res = await fetch(`/api/Nutrition/admin`, {
                method: 'PUT',
                headers: {
                    'edgetoken': localStorage.getItem('Token') || "",
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, ...editForm })
            });
            const data = await res.json();
            if (data.success) {
                setNutritionData(prev => prev.map(item => item._id === id ? data.data : item));
                setEditingNutrition(null);
            } else {
                alert("Failed to save: " + data.message);
            }
        } catch (err) {
            alert("Error saving nutrition data");
        }
    }

    const scaleNutrients = (newGrams: number) => {
        if (!scalingReferenceGrams || !newGrams || scalingReferenceGrams === newGrams) return;
        const ratio = newGrams / scalingReferenceGrams;
        
        const nutrientKeys = [
            'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g', 'energy_kcal',
            'vitamin_a_ug', 'vitamin_b1_mg', 'vitamin_b2_mg', 'vitamin_b3_mg', 'vitamin_b6_mg', 'vitamin_b12_ug', 'vitamin_c_mg', 'vitamin_d_ug', 'vitamin_e_mg', 'vitamin_k_ug',
            'calcium_mg', 'iron_mg', 'magnesium_mg', 'phosphorus_mg', 'potassium_mg', 'sodium_mg', 'zinc_mg'
        ];

        const updatedForm = { ...editForm };
        nutrientKeys.forEach(key => {
            if (typeof (updatedForm as any)[key] === 'number') {
                (updatedForm as any)[key] = (updatedForm as any)[key] * ratio;
            }
        });
        setEditForm(updatedForm);
        setScalingReferenceGrams(newGrams);
    };

    const renderNutritionMode = () => {
        if (!nutritionData || nutritionData.length === 0) {
            if (!searchTerm) return null;
            return (
                <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-muted-foreground">No nutritional records found for "{searchTerm}"</p>
                    {isAdmin && (
                        <Button className="mt-4" onClick={() => {
                            // Logic to create new? Maybe later.
                        }}>
                            Add New Ingredient
                        </Button>
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Nutritional Records for {quantity} {quantityUnit}</h3>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {nutritionData.map((item) => {
                        const isEditing = editingNutrition === item._id;
                        
                        // Calculate scale factor based on searched quantity and unit
                        // Use editForm values if editing to allow real-time scaling updates
                        const currentGramsPerEach = isEditing ? editForm.grams_per_each : item.grams_per_each;
                        const { value: totalGrams } = normalizeToGrams(quantityUnit, Number(quantity), currentGramsPerEach);
                        const scaleFactor = totalGrams !== null ? totalGrams / 100 : 1;

                        const formatVal = (val: number) => {
                            const scaled = val * scaleFactor;
                            return scaled < 0.1 ? scaled.toFixed(3) : scaled.toFixed(1);
                        };

                        return (
                            <div key={item._id} className={`p-6 rounded-xl border transition-all duration-300 bg-card ${isEditing ? 'ring-2 ring-primary border-primary/50' : 'border-border hover:border-primary/30'}`}>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex-1">
                                        <div>
                                            {isEditing ? (
                                                <input
                                                    className="text-xl font-bold bg-background border border-input rounded px-2 py-1 w-full"
                                                    value={editForm.ingredient_name}
                                                    onChange={e => setEditForm({ ...editForm, ingredient_name: e.target.value })}
                                                />
                                            ) : (
                                                <h4 className="text-xl font-bold capitalize">{item.ingredient_name}</h4>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Version: {item.nutrients_version} | Last Updated: {new Date(item.last_updated).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {isAdmin && (
                                            isEditing ? (
                                                <>
                                                    <Button size="sm" variant="default" onClick={() => saveNutrition(item._id)}>Save</Button>
                                                    <Button size="sm" variant="outline" onClick={() => setEditingNutrition(null)}>Cancel</Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button size="sm" variant="outline" onClick={() => {
                                                        setEditingNutrition(item._id);
                                                        setEditForm({ ...item });
                                                        setScalingReferenceGrams(item.grams_per_each);
                                                    }}>Edit</Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className={`transition-all ${item.should_recommend !== false ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-rose-500 hover:bg-rose-500/10 opacity-40 hover:opacity-100'}`} 
                                                        onClick={() => toggleRecommendation(item._id, item.should_recommend)}
                                                        title={item.should_recommend !== false ? "Click to flag as 'Do not recommend'" : "Click to recommend"}
                                                    >
                                                        {item.should_recommend !== false ? '✅' : '❌'}
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="text-destructive hover:bg-destructive/10" 
                                                        onClick={() => deleteNutritionRecord(item._id, item.ingredient_name)}
                                                        title="Delete this ingredient and all related search data"
                                                    >
                                                        🗑️
                                                    </Button>
                                                </>
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Energy (kcal)</Label>
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                className="w-full bg-background border border-input rounded px-2 py-1 text-sm" 
                                                value={(editForm.energy_kcal * scaleFactor).toFixed(1)} 
                                                onChange={e => setEditForm({ ...editForm, energy_kcal: Number(e.target.value) / scaleFactor })} 
                                            />
                                        ) : (
                                            <div className="text-lg font-semibold">{formatVal(item.energy_kcal)} kcal</div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Protein (g)</Label>
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                className="w-full bg-background border border-input rounded px-2 py-1 text-sm" 
                                                value={(editForm.protein_g * scaleFactor).toFixed(1)} 
                                                onChange={e => setEditForm({ ...editForm, protein_g: Number(e.target.value) / scaleFactor })} 
                                            />
                                        ) : (
                                            <div className="text-lg font-semibold text-blue-400">{formatVal(item.protein_g)}g</div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Fat (g)</Label>
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                className="w-full bg-background border border-input rounded px-2 py-1 text-sm" 
                                                value={(editForm.fat_g * scaleFactor).toFixed(1)} 
                                                onChange={e => setEditForm({ ...editForm, fat_g: Number(e.target.value) / scaleFactor })} 
                                            />
                                        ) : (
                                            <div className="text-lg font-semibold text-yellow-500">{formatVal(item.fat_g)}g</div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Carbs (g)</Label>
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                className="w-full bg-background border border-input rounded px-2 py-1 text-sm" 
                                                value={(editForm.carbohydrates_g * scaleFactor).toFixed(1)} 
                                                onChange={e => setEditForm({ ...editForm, carbohydrates_g: Number(e.target.value) / scaleFactor })} 
                                            />
                                        ) : (
                                            <div className="text-lg font-semibold text-green-400">{formatVal(item.carbohydrates_g)}g</div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4 opacity-80">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Grams/Each</span>
                                        {isEditing ? (
                                            <div className="flex gap-1 items-center">
                                                <input 
                                                    type="number" 
                                                    className="w-full bg-background border border-input rounded px-1 py-0.5 text-xs" 
                                                    value={editForm.grams_per_each} 
                                                    onChange={e => setEditForm({ ...editForm, grams_per_each: Number(e.target.value) })} 
                                                />
                                                <Button 
                                                    size="icon" 
                                                    variant="outline" 
                                                    className="h-6 w-6 shrink-0" 
                                                    title="Scale nutrients by change in grams/each"
                                                    onClick={() => scaleNutrients(editForm.grams_per_each)}
                                                >
                                                    ⚖️
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="text-sm font-medium">{item.grams_per_each}g</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Fiber</span>
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                className="w-full bg-background border border-input rounded px-1 py-0.5 text-xs" 
                                                value={(editForm.fiber_g * scaleFactor).toFixed(1)} 
                                                onChange={e => setEditForm({ ...editForm, fiber_g: Number(e.target.value) / scaleFactor })} 
                                            />
                                        ) : (
                                            <span className="text-sm font-medium">{formatVal(item.fiber_g)}g</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Iron (mg)</span>
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                className="w-full bg-background border border-input rounded px-1 py-0.5 text-xs" 
                                                value={(editForm.iron_mg * scaleFactor).toFixed(1)} 
                                                onChange={e => setEditForm({ ...editForm, iron_mg: Number(e.target.value) / scaleFactor })} 
                                            />
                                        ) : (
                                            <span className="text-sm font-medium">{formatVal(item.iron_mg)}mg</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Sodium (mg)</span>
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                className="w-full bg-background border border-input rounded px-1 py-0.5 text-xs" 
                                                value={(editForm.sodium_mg * scaleFactor).toFixed(1)} 
                                                onChange={e => setEditForm({ ...editForm, sodium_mg: Number(e.target.value) / scaleFactor })} 
                                            />
                                        ) : (
                                            <span className="text-sm font-medium">{formatVal(item.sodium_mg)}mg</span>
                                        )}
                                    </div>
                                </div>

                                {showMoreNutrients && (
                                    <>
                                        <div className="mt-8 mb-2">
                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 border-b border-border pb-1">Vitamins</h5>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 opacity-80">
                                            {[
                                                { key: 'vitamin_a_ug', label: 'Vit A (ug)' },
                                                { key: 'vitamin_b1_mg', label: 'Vit B1 (mg)' },
                                                { key: 'vitamin_b2_mg', label: 'Vit B2 (mg)' },
                                                { key: 'vitamin_b3_mg', label: 'Vit B3 (mg)' },
                                                { key: 'vitamin_b6_mg', label: 'Vit B6 (mg)' },
                                                { key: 'vitamin_b12_ug', label: 'Vit B12 (ug)' },
                                                { key: 'vitamin_c_mg', label: 'Vit C (mg)' },
                                                { key: 'vitamin_d_ug', label: 'Vit D (ug)' },
                                                { key: 'vitamin_e_mg', label: 'Vit E (mg)' },
                                                { key: 'vitamin_k_ug', label: 'Vit K (ug)' },
                                            ].map((vit) => (
                                                <div key={vit.key} className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold">{vit.label}</span>
                                                    {isEditing ? (
                                                        <input 
                                                            type="number" 
                                                            className="w-full bg-background border border-input rounded px-1 py-0.5 text-xs" 
                                                            value={(editForm[vit.key as keyof typeof editForm] as number * scaleFactor).toFixed(2)} 
                                                            onChange={e => setEditForm({ ...editForm, [vit.key]: Number(e.target.value) / scaleFactor })} 
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-medium">{formatVal(item[vit.key])}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-8 mb-2">
                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 border-b border-border pb-1">Minerals</h5>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 opacity-80">
                                            {[
                                                { key: 'calcium_mg', label: 'Calcium (mg)' },
                                                { key: 'magnesium_mg', label: 'Magnesium (mg)' },
                                                { key: 'phosphorus_mg', label: 'Phosphorus (mg)' },
                                                { key: 'potassium_mg', label: 'Potassium (mg)' },
                                                { key: 'zinc_mg', label: 'Zinc (mg)' },
                                            ].map((min) => (
                                                <div key={min.key} className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold">{min.label}</span>
                                                    {isEditing ? (
                                                        <input 
                                                            type="number" 
                                                            className="w-full bg-background border border-input rounded px-1 py-0.5 text-xs" 
                                                            value={(editForm[min.key as keyof typeof editForm] as number * scaleFactor).toFixed(2)} 
                                                            onChange={e => setEditForm({ ...editForm, [min.key]: Number(e.target.value) / scaleFactor })} 
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-medium">{formatVal(item[min.key])}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                <div className="mt-6 flex justify-center">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-primary"
                                        onClick={() => setShowMoreNutrients(!showMoreNutrients)}
                                    >
                                        {showMoreNutrients ? 'Hide Details ▲' : 'Show More Vitamins & Minerals ▼'}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const toggleSelectAll = () => {
        // Find items that pass the current filter
        const visibleItems = ingredientData.filter(product => {
            const inSelectedBin = isFiltered(product.total_price);
            const isSelectedProduct = selectedProductId === product.id;

            // If no filter active, all items are visible
            if (selectedBinIndex === -1 && !selectedProductId) return true;

            // Otherwise, only items that match the highlight criteria
            return isSelectedProduct || (selectedBinIndex !== -1 && inSelectedBin);
        });

        const visibleIds = visibleItems.map(item => item.id);
        const allVisibleSelected = visibleIds.every(id => selectedDeleteIds.has(id));

        if (allVisibleSelected) {
            // Deselect only the visible ones
            setSelectedDeleteIds(prev => {
                const next = new Set(prev);
                visibleIds.forEach(id => next.delete(id));
                return next;
            });
        } else {
            // Select all visible ones
            setSelectedDeleteIds(prev => {
                const next = new Set(prev);
                visibleIds.forEach(id => next.add(id));
                return next;
            });
        }
    }

    function getTopProducts() {
        const sortedProducts = [...ingredientData].sort((a, b) => a.rank - b.rank);
        return sortedProducts.slice(0, 3);
    }

    const renderComparisonChart = () => {
        if (!ingredientData || ingredientData.length === 0) return null;

        // Take top 8 cheapest items for comparison
        const topItems = [...ingredientData]
            .filter(item => item.total_price !== undefined)
            .sort((a, b) => a.rank - b.rank)
            .slice(0, 8);

        if (topItems.length === 0) return null;

        const rank1Item = topItems[0];
        const labels = topItems.map(item => item.name.length > 20 ? item.name.substring(0, 17) + '...' : item.name);
        const percentages = topItems.map(item => {
            if (item.rank === 1) return 0;
            return ((item.total_price - rank1Item.total_price) / rank1Item.total_price) * 100;
        });

        // Pre-load images for the plugin
        const images: { [key: string]: HTMLImageElement } = {};
        topItems.forEach(item => {
            if (!images[item.source]) {
                const img = new Image();
                img.src = `/${item.source}.png`;
                images[item.source] = img;
            }
        });

        const logoPlugin = {
            id: 'logoPlugin',
            afterDraw: (chart: any) => {
                const ctx = chart.ctx;
                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;

                chart.data.datasets[0].data.forEach((value: number, index: number) => {
                    const x = xAxis.getPixelForValue(index);
                    const y = yAxis.getPixelForValue(value);
                    const source = topItems[index].source;
                    const img = images[source];

                    if (img && img.complete) {
                        const size = 24;
                        ctx.drawImage(img, x - size / 2, y - size - 5, size, size);
                    }
                });
            }
        };

        const data = {
            labels,
            datasets: [
                {
                    label: '% Price Difference',
                    data: percentages,
                    backgroundColor: topItems.map(item =>
                        item.rank === 1 ? 'rgba(34, 197, 94, 0.7)' :
                            (selectedProductId === item.id ? 'rgba(147, 51, 234, 0.8)' : 'rgba(59, 130, 246, 0.4)')
                    ),
                    borderColor: topItems.map(item =>
                        item.rank === 1 ? 'rgb(34, 197, 94)' :
                            (selectedProductId === item.id ? 'rgb(147, 51, 234)' : 'rgba(59, 130, 246, 0.8)')
                    ),
                    borderWidth: 1,
                    borderRadius: 4,
                }
            ]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (_event: any, elements: any[]) => {
                if (elements && elements.length > 0) {
                    const { index } = elements[0];
                    const product = topItems[index];
                    setSelectedProductId(prev => prev === product.id ? null : product.id);
                    setSelectedBinIndex(-1); // Clear bin filter
                } else {
                    setSelectedProductId(null);
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            const item = topItems[context.dataIndex];
                            return [
                                ` Price: $${(item.total_price || 0).toFixed(2)}`,
                                ` Diff: +${context.raw.toFixed(1)}%`
                            ];
                        },
                        title: (items: any) => topItems[items[0].dataIndex].name
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 9 } }
                },
                y: {
                    title: { display: true, text: '% Difference vs Rank #1', color: 'rgba(255,255,255,0.6)', font: { size: 10 } },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: 'rgba(255,255,255,0.6)', callback: (val: any) => `${val}%` }
                }
            }
        };

        return (
            <div className="mb-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-foreground">Top Deals Comparison</h3>
                        <p className="text-xs text-muted-foreground italic">
                            Relative price difference compared to the cheapest option
                        </p>
                    </div>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 h-[320px] cursor-pointer">
                    <Bar data={data} options={options} plugins={[logoPlugin]} />
                </div>
            </div>
        );
    };

    const renderHistogram = () => {
        if (!ingredientData || ingredientData.length === 0) return null;

        // Extract total prices
        let allPrices = ingredientData
            .map(item => item.total_price)
            .filter(price => price !== undefined && price !== null)
            .sort((a, b) => a - b);

        if (allPrices.length === 0) return null;

        // Detect Outliers using IQR method
        const q1 = allPrices[Math.floor(allPrices.length * 0.25)];
        const q3 = allPrices[Math.floor(allPrices.length * 0.75)];
        const iqr = q3 - q1;
        const upperLimit = iqr === 0 ? Math.max(...allPrices) : q3 + (iqr * 1.5);

        const normalPrices = allPrices.filter(p => p <= upperLimit);
        const outlierCount = allPrices.filter(p => p > upperLimit).length;

        if (normalPrices.length === 0) return null;

        const minPrice = normalPrices[0];
        const maxPrice = normalPrices[normalPrices.length - 1];
        const range = maxPrice - minPrice;

        // Initial binning to find majority range
        let tempBinCount = Math.min(10, normalPrices.length);
        let tempBinWidth = range === 0 ? 1 : range / tempBinCount;
        let tempBins = Array(tempBinCount).fill(0);
        normalPrices.forEach(p => {
            let idx = Math.floor((p - minPrice) / tempBinWidth);
            if (idx >= tempBinCount) idx = tempBinCount - 1;
            tempBins[idx]++;
        });

        // If one bin has the majority (> 40% of normal), increase overall bin count for more granularity
        const maxInBin = Math.max(...tempBins);
        const binCount = (maxInBin / normalPrices.length > 0.4) ? Math.min(20, normalPrices.length) : Math.min(12, normalPrices.length);
        const binWidth = range === 0 ? 1 : range / binCount;

        const bins = Array(range === 0 ? 1 : binCount).fill(0);
        const binRanges = bins.map((_, i) => {
            const start = minPrice + i * binWidth;
            const end = start + binWidth;
            return { start, end };
        });

        const binLabels = binRanges.map(r => `$${r.start.toFixed(2)}-${r.end.toFixed(2)}`);

        normalPrices.forEach(price => {
            let binIndex = Math.floor((price - minPrice) / binWidth);
            if (binIndex >= binCount) binIndex = binCount - 1;
            if (binIndex < 0) binIndex = 0;
            bins[binIndex]++;
        });

        // Add Outlier Bin if exists
        if (outlierCount > 0) {
            bins.push(outlierCount);
            binLabels.push(`> $${upperLimit.toFixed(2)}`);
            binRanges.push({ start: upperLimit, end: Infinity });
        }

        // Find cheapest item bin
        const cheapestItem = ingredientData.find(item => item.rank === 1);
        const cheapestBinIndex = cheapestItem && cheapestItem.total_price <= upperLimit
            ? Math.min(binCount - 1, Math.max(0, Math.floor((cheapestItem.total_price - minPrice) / binWidth)))
            : (cheapestItem && cheapestItem.total_price > upperLimit ? bins.length - 1 : -1);

        const maxFreq = Math.max(...bins);
        const mostCommonBinIndex = bins.indexOf(maxFreq);

        const backgroundColors = bins.map((_, i) => {
            if (i === selectedBinIndex) return 'rgba(147, 51, 234, 0.8)'; // Purple for selected
            if (i === cheapestBinIndex) return 'rgba(34, 197, 94, 0.7)'; // Emerald/Green for cheapest
            if (i === bins.length - 1 && outlierCount > 0) return 'rgba(239, 68, 68, 0.4)'; // Reddish for outliers
            if (i === mostCommonBinIndex) return 'rgba(59, 130, 246, 0.7)'; // Blue for most common
            return 'rgba(255, 255, 255, 0.2)';
        });

        const borderColors = bins.map((_, i) => {
            if (i === selectedBinIndex) return 'rgb(147, 51, 234)';
            if (i === cheapestBinIndex) return 'rgb(34, 197, 94)';
            if (i === bins.length - 1 && outlierCount > 0) return 'rgb(239, 68, 68)';
            if (i === mostCommonBinIndex) return 'rgb(59, 130, 246)';
            return 'rgba(255, 255, 255, 0.4)';
        });

        const data = {
            labels: binLabels,
            datasets: [
                {
                    label: 'Number of Products',
                    data: bins,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        };

        const onClick = (_event: any, elements: any[]) => {
            if (elements && elements.length > 0) {
                const { index } = elements[0];
                setSelectedBinIndex(prev => prev === index ? -1 : index);
            } else {
                setSelectedBinIndex(-1);
            }
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            onClick,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context: any) => ` ${context.raw} Products (Click to filter)`,
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false, color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 9 }, maxRotation: 45, minRotation: 45 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: 'rgba(255,255,255,0.6)', stepSize: 1 }
                }
            }
        };

        const selectedRange = selectedBinIndex !== -1 ? binRanges[selectedBinIndex] : null;

        return (
            <div className="mb-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground italic">
                            {selectedRange
                                ? `Showing $${selectedRange.start.toFixed(2)}${selectedRange.end === Infinity ? '+' : ' - $' + selectedRange.end.toFixed(2)} range`
                                : `Comparing ${quantity} ${quantityUnit} - ${allPrices.length} results`}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-wider font-semibold">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-sm bg-purple-500"></div>
                            <span>Selected</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-sm bg-green-500/70"></div>
                            <span>Cheapest</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-sm bg-blue-500/70"></div>
                            <span>Common</span>
                        </div>
                        {outlierCount > 0 && (
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-red-500/40"></div>
                                <span>Outliers</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 h-[320px] cursor-pointer">
                    <Bar data={data} options={options} />
                </div>
                {
                    selectedBinIndex !== -1 && (
                        <div className="mt-2 text-center">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedBinIndex(-1)} className="text-xs">
                                Clear Filter
                            </Button>
                        </div>
                    )
                }
            </div >
        );
    };

    const isFiltered = (price: number) => {
        if (selectedBinIndex === -1) return true;

        // Need to re-calculate bins for filtering
        let allPrices = ingredientData
            .map(item => item.total_price)
            .filter(price => price !== undefined && price !== null)
            .sort((a, b) => a - b);

        const q1 = allPrices[Math.floor(allPrices.length * 0.25)];
        const q3 = allPrices[Math.floor(allPrices.length * 0.75)];
        const iqr = q3 - q1;
        const upperLimit = iqr === 0 ? Math.max(...allPrices) : q3 + (iqr * 1.5);
        const normalPrices = allPrices.filter(p => p <= upperLimit);

        const minPrice = normalPrices[0];
        const maxPrice = normalPrices[normalPrices.length - 1];
        const range = maxPrice - minPrice;

        let tempBinCount = Math.min(10, normalPrices.length);
        let tempBinWidth = range === 0 ? 1 : range / tempBinCount;
        let tempBins = Array(tempBinCount).fill(0);
        normalPrices.forEach(p => {
            let idx = Math.floor((p - minPrice) / tempBinWidth);
            if (idx >= tempBinCount) idx = tempBinCount - 1;
            tempBins[idx]++;
        });

        const maxInBin = Math.max(...tempBins);
        const binCount = (maxInBin / normalPrices.length > 0.4) ? Math.min(20, normalPrices.length) : Math.min(12, normalPrices.length);
        const binWidth = range === 0 ? 1 : range / binCount;

        if (price > upperLimit) {
            return selectedBinIndex === binCount; // Outlier bin is always binCount if it exists
        }

        let binIndex = Math.floor((price - minPrice) / binWidth);
        if (binIndex >= binCount) binIndex = binCount - 1;
        if (binIndex < 0) binIndex = 0;

        return binIndex === selectedBinIndex;
    };

    return (
        <div className="w-full">
            <div className="flex justify-center mb-8">
                <ToggleGroup type="single" value={viewMode} onValueChange={(val) => val && setViewMode(val as 'price' | 'nutrition')} className="bg-white/5 p-1 rounded-lg border border-white/10">
                    <ToggleGroupItem value="price" className="flex-1 md:flex-none px-2 md:px-6 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-md transition-all whitespace-nowrap text-xs md:text-sm">
                        💰 Price Research
                    </ToggleGroupItem>
                    <ToggleGroupItem value="nutrition" className="flex-1 md:flex-none px-2 md:px-6 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-md transition-all whitespace-nowrap text-xs md:text-sm">
                        🥗 Nutrition Data
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            {showForm && (
                <form onSubmit={handleGetIngredient} className="flex flex-col gap-4 mb-8">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <label className="text-sm font-semibold mb-1 block">Ingredient</label>
                            <SearchableDropdown
                                name="ingredName"
                                value={searchTerm}
                                placeholder="Enter ingredient name"
                                onChange={(e: any) => setSearchTerm(e.target.value)}
                                options={availableIngredients}
                                onComplete={(val: string) => setSearchTerm(val)}
                            />
                        </div>
                        <div className="grid grid-cols-2 md:flex gap-4">
                            <div className="md:w-24">
                                <label className="text-sm font-semibold mb-1 block">Qty</label>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                            </div>
                            <div className="md:w-32">
                                <label className="text-sm font-semibold mb-1 block">Unit</label>
                                <select
                                    name="quantity_type"
                                    onChange={(e) => setQuantityUnit(e.target.value)}
                                    value={quantityUnit}
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                                >
                                    {Object.keys(quantity_unit_conversions).filter(unit => unit !== 'any').map((item) => (
                                        <option className="bg-background text-foreground" key={item} value={item}>{item}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2 md:flex md:items-end">
                                <Button type="submit" className="h-10 w-full md:w-auto md:px-8 font-bold">
                                    {loading ? 'Searching...' : 'Execute Search'}
                                </Button>
                            </div>
                        </div>
                    </div>
                    {viewMode === 'price' && (
                        <div className="mt-4 border border-border rounded-md overflow-hidden">
                        {/* Settings header toggle */}
                        <button
                            type="button"
                            onClick={() => setShowSettings(s => !s)}
                            className="w-full flex items-center justify-between px-4 py-2 bg-card text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <span>⚙️ Search Options</span>
                            <span className="text-xs opacity-60">{showSettings ? '▲ collapse' : '▼ expand'}</span>
                        </button>

                        {showSettings && (
                            <div className="p-4 bg-card/50 flex flex-col gap-5">

                                {/* Skip Conversion */}
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="skip-conversion"
                                        checked={skipConversion}
                                        onCheckedChange={(checked) => {
                                            setSkipConversion(!!checked);
                                            localStorage.setItem('skipConversion', String(!!checked));
                                        }}
                                    />
                                    <Label htmlFor="skip-conversion" className="text-sm font-medium">Skip Unified Conversion (show raw results)</Label>
                                </div>

                                {/* Max Size Overrides */}
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                        Max Comparison Size <span className="text-[10px] font-normal normal-case">(price comparison is scaled to this quantity)</span>
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {[
                                            { key: 'each', label: 'Each items (default: 20x)', defaultQ: MAX_SIZE_DEFAULTS.each.quantity, defaultU: MAX_SIZE_DEFAULTS.each.unit },
                                            { key: 'weight', label: 'Weight items (default: 1kg)', defaultQ: MAX_SIZE_DEFAULTS.weight.quantity, defaultU: MAX_SIZE_DEFAULTS.weight.unit },
                                            { key: 'volume', label: 'Volume items (default: 1L)', defaultQ: MAX_SIZE_DEFAULTS.volume.quantity, defaultU: MAX_SIZE_DEFAULTS.volume.unit },
                                        ].map(({ key, label, defaultQ, defaultU }) => {
                                            const override = maxSizeOverrides[key];
                                            return (
                                                <div key={key} className="flex flex-col gap-1 p-2 rounded border border-border bg-background">
                                                    <span className="text-[11px] text-muted-foreground">{label}</span>
                                                    <div className="flex gap-1">
                                                        <input
                                                            type="number"
                                                            className="flex h-8 w-20 rounded border border-input bg-background px-2 py-1 text-sm"
                                                            value={override?.quantity ?? defaultQ}
                                                            min={1}
                                                            onChange={e => {
                                                                const updated = { ...maxSizeOverrides, [key]: { quantity: Number(e.target.value), unit: override?.unit ?? defaultU } };
                                                                setMaxSizeOverrides(updated);
                                                                localStorage.setItem('maxSizeOverrides', JSON.stringify(updated));
                                                            }}
                                                        />
                                                        <select
                                                            className="flex h-8 flex-1 rounded border border-input bg-background px-2 text-sm text-foreground"
                                                            value={override?.unit ?? defaultU}
                                                            onChange={e => {
                                                                const updated = { ...maxSizeOverrides, [key]: { quantity: override?.quantity ?? defaultQ, unit: e.target.value } };
                                                                setMaxSizeOverrides(updated);
                                                                localStorage.setItem('maxSizeOverrides', JSON.stringify(updated));
                                                            }}
                                                        >
                                                            {Object.keys(quantity_unit_conversions).filter(u => u !== 'any').map(u => (
                                                                <option key={u} value={u}>{u}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Category overrides */}
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-3 mb-2">Category Overrides</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {Object.entries(CATEGORY_MAX_SIZES).map(([cat, def]) => {
                                            const override = maxSizeOverrides[cat];
                                            return (
                                                <div key={cat} className="flex flex-col gap-1 p-2 rounded border border-border bg-background">
                                                    <span className="text-[11px] text-muted-foreground capitalize">{cat}</span>
                                                    <div className="flex gap-1">
                                                        <input
                                                            type="number"
                                                            className="flex h-8 w-20 rounded border border-input bg-background px-2 py-1 text-sm"
                                                            value={override?.quantity ?? def.quantity}
                                                            min={1}
                                                            onChange={e => {
                                                                const updated = { ...maxSizeOverrides, [cat]: { quantity: Number(e.target.value), unit: override?.unit ?? def.unit } };
                                                                setMaxSizeOverrides(updated);
                                                                localStorage.setItem('maxSizeOverrides', JSON.stringify(updated));
                                                            }}
                                                        />
                                                        <select
                                                            className="flex h-8 flex-1 rounded border border-input bg-background px-2 text-sm text-foreground"
                                                            value={override?.unit ?? def.unit}
                                                            onChange={e => {
                                                                const updated = { ...maxSizeOverrides, [cat]: { quantity: override?.quantity ?? def.quantity, unit: e.target.value } };
                                                                setMaxSizeOverrides(updated);
                                                                localStorage.setItem('maxSizeOverrides', JSON.stringify(updated));
                                                            }}
                                                        >
                                                            {Object.keys(quantity_unit_conversions).filter(u => u !== 'any').map(u => (
                                                                <option key={u} value={u}>{u}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
                                        onClick={() => {
                                            setMaxSizeOverrides({});
                                            localStorage.removeItem('maxSizeOverrides');
                                        }}
                                    >
                                        ↩ Reset to defaults
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    )}
                </form>
            )}

            {loading && (
                <div className="flex justify-center my-8 text-primary">
                    <object type="image/svg+xml" data="/loading.svg" className="w-12 h-12">loading...</object>
                </div>
            )}

            {ingredientData.length > 0 && !excludeTop3 && viewMode === 'price' && (
                <div className="mb-12">
                    <h3 className="text-xl font-bold mb-6 text-foreground">Top 3 Products</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {getTopProducts().map((product, index) => {
                            const barColors = ['bg-yellow-400', 'bg-slate-300', 'bg-amber-600'];
                            const rankColor = barColors[index] || 'bg-border';
                            const isSelectedProduct = selectedProductId === product.id;
                            const isChosen = chosenProductId === product.id;
                            return (
                                <div
                                    key={index}
                                    className={`rounded-xl border transition-all duration-300 bg-card text-card-foreground shadow-sm overflow-hidden relative cursor-pointer ${isChosen ? 'ring-4 ring-yellow-400 scale-[1.05] z-10' : (isSelectedProduct ? 'ring-2 ring-purple-500 scale-[1.02]' : 'border-border hover:border-primary/50')}`}
                                    onClick={() => setSelectedProductId(prev => prev === product.id ? null : product.id)}
                                >
                                    {isChosen && (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[10px] font-black px-3 py-0.5 rounded-b-md uppercase tracking-wider shadow-lg">
                                            Best Choice
                                        </div>
                                    )}
                                    <div className={`h-2 w-full ${rankColor}`}></div>
                                    <div className="p-6">
                                        <div className="flex flex-col gap-1 mb-4">
                                            <span className="text-2xl font-bold opacity-80">#{index + 1}</span>
                                            <h5 className="text-xl font-semibold leading-none tracking-tight pr-12">{product.name}</h5>
                                        </div>
                                        <div className="absolute top-6 right-4 w-12 h-12 bg-white rounded-md p-1 border border-border flex items-center justify-center">
                                            <img
                                                src={`/${product.source}.png`}
                                                alt={product.source}
                                                className="max-w-full max-h-full object-contain"
                                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                                            />
                                        </div>
                                        <div className="text-sm text-muted-foreground text-center mb-4">{product.source}</div>
                                        <div className="space-y-2 text-sm mb-6">
                                            <div className="flex justify-between border-b border-border pb-2">
                                                <strong className="text-muted-foreground">Price:</strong>
                                                <span className="font-medium">${Number(product.price).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-border pb-2">
                                                <strong className="text-muted-foreground">Unit Price:</strong>
                                                <span className="font-medium">
                                                    {product.unit_price_converted < 1
                                                        ? `${(product.unit_price_converted * 100).toFixed(2)}¢`
                                                        : `$${Number(product.unit_price_converted).toFixed(2)}`}
                                                </span>
                                            </div>
                                            <div className="flex justify-between pb-2">
                                                <strong className="text-muted-foreground">Total:</strong>
                                                <span className="font-bold text-primary">${(product.total_price || 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <Button
                                            className={`w-full ${isChosen ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : ''}`}
                                            variant={isChosen ? "default" : "outline"}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setChosenProductId(isChosen ? null : product.id);
                                            }}
                                        >
                                            {isChosen ? 'Selected' : 'Select as Best'}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {viewMode === 'nutrition' ? renderNutritionMode() : (
                <>
                    {showCharts && renderComparisonChart()}
                    {showCharts && renderHistogram()}
                </>
            )}

            {ingredientData.length > 0 && viewMode === 'price' && (
                <div className="md:hidden space-y-4 mb-8">
                    {ingredientData.map((product, idx) => {
                        const isChosen = chosenProductId === product.id;
                        const isSelected = selectedProductId === product.id;
                        const rank1 = ingredientData.find(p => p.rank === 1);
                        const percentDiff = rank1 && product.total_price ? ((product.total_price - rank1.total_price) / rank1.total_price) * 100 : 0;

                        return (
                            <div 
                                key={idx} 
                                className={`p-4 rounded-xl border bg-card transition-all ${isChosen ? 'border-yellow-400 ring-1 ring-yellow-400' : (isSelected ? 'border-purple-500 ring-1 ring-purple-500' : 'border-border')}`}
                                onClick={() => setSelectedProductId(prev => prev === product.id ? null : product.id)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold text-sm line-clamp-1 flex-1 pr-2">{product.name}</div>
                                    <div className="text-xs font-bold whitespace-nowrap">${Number(product.price).toFixed(2)}</div>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground mb-3">
                                    <div className="flex items-center gap-2">
                                        <img src={`/${product.source}.png`} alt="" className="w-3 h-3 object-contain" />
                                        <span>{product.source}</span>
                                    </div>
                                    <div className={`px-1.5 py-0.5 rounded ${percentDiff === 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/10 text-red-400'}`}>
                                        {percentDiff === 0 ? 'CHEAPEST' : `+${percentDiff.toFixed(1)}%`}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px]">
                                        Unit: <span className="font-medium text-foreground">
                                            {product.unit_price_converted < 1
                                                ? `${(product.unit_price_converted * 100).toFixed(2)}¢`
                                                : `$${Number(product.unit_price_converted).toFixed(2)}`}
                                        </span>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        variant={isChosen ? "default" : "outline"}
                                        className={`h-7 text-[10px] px-3 ${isChosen ? 'bg-yellow-400 hover:bg-yellow-500 text-black border-none' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setChosenProductId(isChosen ? null : product.id);
                                        }}
                                    >
                                        {isChosen ? 'Selected' : 'Select'}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {ingredientData.length > 0 && showTable && viewMode === 'price' && (
                <div className="hidden md:block relative rounded-md border border-border overflow-x-auto w-full">
                    {selectedDeleteIds.size > 0 && (
                        <div className="absolute top-2 right-4 z-20 animate-in fade-in slide-in-from-top-2">
                            <Button
                                variant="destructive"
                                size="sm"
                                className="shadow-lg h-8 px-4 text-xs font-bold bg-red-600 hover:bg-red-700"
                                onClick={() => deleteIngredient(Array.from(selectedDeleteIds))}
                            >
                                Delete Selected ({selectedDeleteIds.size})
                            </Button>
                        </div>
                    )}
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-12">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-white/20 bg-white/5 accent-primary cursor-pointer"
                                        checked={selectedDeleteIds.size === ingredientData.length && ingredientData.length > 0}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Product Name</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Price</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">% Diff</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">Unit Price</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Quantity</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Derivation</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Source</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Rank</th>
                                <th className="h-10 px-4 text-center align-middle font-medium text-muted-foreground">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ingredientData.map((product, idx) => {
                                const inSelectedBin = isFiltered(product.total_price);
                                const isSelectedProduct = selectedProductId === product.id;
                                const isChosen = chosenProductId === product.id;
                                const isRowChecked = selectedDeleteIds.has(product.id);

                                const rank1 = ingredientData.find(p => p.rank === 1);
                                const percentDiff = rank1 && product.total_price ? ((product.total_price - rank1.total_price) / rank1.total_price) * 100 : 0;

                                const shouldHighlight = isSelectedProduct || (selectedBinIndex !== -1 && inSelectedBin);
                                const isTotallyHidden = (selectedProductId && !isSelectedProduct) || (selectedBinIndex !== -1 && !inSelectedBin);

                                return (
                                    <tr
                                        key={idx}
                                        className={`border-b transition-all duration-200 hover:bg-muted/50 cursor-pointer 
                                            ${isChosen ? 'bg-yellow-400/20 border-yellow-400/50' :
                                                (isTotallyHidden || deletingIds.has(product.id) ? 'opacity-20 grayscale-[0.8]' :
                                                    (isRowChecked ? 'bg-primary/20' :
                                                        (shouldHighlight ? 'bg-purple-500/20' : 'bg-primary/5')))}`}
                                        onClick={() => !deletingIds.has(product.id) && setSelectedProductId(prev => prev === product.id ? null : product.id)}
                                    >
                                        <td className="p-4 align-middle" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-primary cursor-pointer"
                                                checked={isRowChecked}
                                                onChange={(e) => {
                                                    const next = new Set(selectedDeleteIds);
                                                    if (e.target.checked) next.add(product.id);
                                                    else next.delete(product.id);
                                                    setSelectedDeleteIds(next);
                                                }}
                                                disabled={deletingIds.has(product.id)}
                                            />
                                        </td>
                                        <td className="p-4 align-middle font-medium">
                                            <div className="flex items-center gap-2">
                                                {isChosen && <div className="w-2 h-2 rounded-full bg-yellow-400"></div>}
                                                {product.name}
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle font-bold">${Number(product.price).toFixed(2)}</td>
                                        <td className="p-4 align-middle">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${percentDiff === 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/10 text-red-400'}`}>
                                                {percentDiff === 0 ? 'CHEAPEST' : `+${percentDiff.toFixed(1)}%`}
                                            </span>
                                        </td>
                                        <td className="p-4 align-middle">
                                            {product.unit_price_converted < 1
                                                ? `${(product.unit_price_converted * 100).toFixed(2)}¢`
                                                : `$${Number(product.unit_price_converted).toFixed(2)}`}
                                        </td>
                                        <td className="p-4 align-middle">{product.quantity} {product.quantity_unit}</td>
                                        <td className="p-4 align-middle">
                                            {product.conversion_source && (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${product.conversion_source === 'explicit' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                                    {product.conversion_source === 'explicit' ? 'EXPLICIT' : 'AI ESTIMATE'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 align-middle">{product.source}</td>
                                        <td className="p-4 align-middle">{product.rank}</td>
                                        <td className="p-4 align-middle text-center">
                                            <Button
                                                size="sm"
                                                variant={isChosen ? "default" : "outline"}
                                                className={isChosen ? "bg-yellow-400 hover:bg-yellow-500 text-black border-none h-7 text-[10px]" : "h-7 text-[10px]"}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChosenProductId(isChosen ? null : product.id);
                                                }}
                                            >
                                                {isChosen ? 'Selected' : 'Select'}
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
