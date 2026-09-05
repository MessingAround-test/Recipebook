import React, { useState, useEffect, useRef, useCallback } from 'react'
import { quantity_unit_conversions } from "../lib/conversion"
import SearchableDropdown from './SearchableDropdown'
import { Button } from './ui/button'
import { X, Check, Loader2, Sparkles, Search, Minus, Plus } from 'lucide-react'

const categories = [
    { name: 'Fresh Produce', image: 'FreshProduce.png' },
    { name: 'Dairy and Eggs', image: 'DairyandEggs.png' },
    { name: 'Bakery', image: 'Bakery.png' },
    { name: 'Meat and Seafood', image: 'MeatandSeafood.png' },
    { name: 'Canned Goods', image: 'CannedGoods.png' },
    { name: 'Pasta and Grains', image: 'PastaandGrains.png' },
    { name: 'Condiments and Sauces', image: 'CondimentsandSauces.png' },
    { name: 'Snacks', image: 'Snacks.png' },
    { name: 'Beverages', image: 'Beverages.png' },
    { name: 'Frozen Foods', image: 'FrozenFoods.png' },
    { name: 'Cereal and Breakfast Foods', image: 'CerealandBreakfastFoods.png' },
    { name: 'Baking Supplies', image: 'BakingSupplies.png' },
    { name: 'Household and Cleaning', image: 'HouseholdandCleaning.png' },
    { name: 'Personal Care', image: 'PersonalCare.png' },
    { name: 'Health and Wellness', image: 'HealthandWellness.png' },
    { name: 'International Foods', image: 'InternationalFoods.png' },
    { name: 'Deli and Prepared Foods', image: 'DeliandPreparedFoods.png' },
    { name: 'Home and Garden', image: 'HomeandGarden.png' }
]

interface AddShoppingItemProps {
    shoppingListId?: string
    handleSubmit: (e: any) => void
    hideCategories?: boolean
    onCancel?: () => void
    initialData?: {
        name: string;
        quantity: number | string;
        quantity_type: string;
        note?: string;
    }
    hideHeader?: boolean;
    hideNote?: boolean;
    hideNameInput?: boolean;
    triggerSearchOnInit?: boolean;
    variant?: 'inline' | 'overlay';
}

export default function AddShoppingItem({ shoppingListId, handleSubmit, hideCategories = false, onCancel, initialData, hideHeader = false, hideNote = false, hideNameInput = false, triggerSearchOnInit = false, variant = 'inline' }: AddShoppingItemProps) {
    const isOverlay = variant === 'overlay';

    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        quantity: initialData?.quantity || 1 as number | string,
        quantity_type: initialData?.quantity_type || "each",
        note: initialData?.note || "",
        shoppingListId: shoppingListId,
        category: ""
    });

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [fieldsRevealed, setFieldsRevealed] = useState(!triggerSearchOnInit && !!initialData);
    const [isNoteOpen, setIsNoteOpen] = useState(!!initialData?.note);
    const [showCancelOption, setShowCancelOption] = useState(false);
    const [justAdded, setJustAdded] = useState(false);
    const userChangedFields = useRef(false);
    const initialFormRef = useRef<string | null>(null);

    // Abortable lookup state (DB + AI) so the user can cancel slow requests
    const lookupGenRef = useRef(0);
    const abortRef = useRef<AbortController | null>(null);
    const slowTimerRef = useRef<any>(null);
    const justAddedTimerRef = useRef<any>(null);

    const resetForm = () => {
        setFormData({
            name: "",
            quantity: 1,
            quantity_type: "each",
            note: "",
            shoppingListId: shoppingListId,
            category: ""
        });
        setFieldsRevealed(false);
        userChangedFields.current = false;
        initialFormRef.current = null;
        setJustAdded(true);
        if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
        justAddedTimerRef.current = setTimeout(() => setJustAdded(false), 2000);
    };

    const cancelLookup = () => {
        if (abortRef.current) abortRef.current.abort();
        if (slowTimerRef.current) { clearTimeout(slowTimerRef.current); slowTimerRef.current = null; }
        setIsAiLoading(false);
        setShowCancelOption(false);
        setFieldsRevealed(true);
        // Mark as manual so any late AI/DB response is ignored
        userChangedFields.current = true;
        initialFormRef.current = JSON.stringify({ quantity: formData.quantity, quantity_type: formData.quantity_type, category: formData.category });
    };

    const adjustQuantity = (delta: number) => {
        const current = parseFloat(String(formData.quantity));
        const base = isNaN(current) ? 0 : current;
        const next = Math.max(0, Math.round((base + delta) * 100) / 100);
        setFormData(prev => ({ ...prev, quantity: next }));
        userChangedFields.current = true;
    };

    const [knownIngredients, setKnownIngredients] = useState<any[]>([])

    // Set while the submit button is being clicked, so the name-input blur it causes
    // doesn't kick off a re-lookup in the middle of submitting
    const submitIntentRef = useRef(false);

    // Begin a fresh lookup for an item: clear any previous item's metrics so the
    // quantity/unit/category shown always belong to the item being searched
    const startItemLookup = (name: string) => {
        setFieldsRevealed(false);
        userChangedFields.current = false;
        setFormData(prev => ({ ...prev, name, category: "", quantity: 1, quantity_type: "each" }));
        determineDefaults(name);
    };

    const handleChange = (e: any) => {
        const { name, value, option } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (fieldsRevealed && (name === 'quantity' || name === 'quantity_type' || name === 'category')) {
            userChangedFields.current = true;
        }

        if (option && name === 'name') {
            startItemLookup(value);
        }
    };

    const handleNameSubmit = (nameOverride?: string) => {
        if (submitIntentRef.current) {
            submitIntentRef.current = false;
            return;
        }
        const nameToUse = typeof nameOverride === 'string' ? nameOverride : formData.name;
        if (nameToUse === undefined || nameToUse === "") return;
        // Same item already shown — keep whatever the user has edited
        if (fieldsRevealed && nameToUse === formData.name) return;
        // Same lookup already running — let it finish
        if (isAiLoading && nameToUse === formData.name) return;
        // New item name — reload its metrics from the DB
        startItemLookup(nameToUse);
    };

    const handleSubmitLocal = async (e: any) => {
        e.preventDefault();
        if (!fieldsRevealed && !isAiLoading) {
            await handleNameSubmit();
            return;
        }
        submitIntentRef.current = false;
        e.value = formData
        e.resetForm = resetForm;
        handleSubmit(e)
    };

    function isValidCategory(categories: any[], to_check: string) {
        return categories.some(category => category.name === to_check);
    }

    async function determineDefaults(name: string) {
        // Always sync the searched name into the form so the submitted payload is correct
        // even if the dropdown couldn't propagate the typed text (e.g. options not loaded yet)
        setFormData(prev => ({ ...prev, name }));
        const gen = ++lookupGenRef.current;
        const controller = new AbortController();
        abortRef.current = controller;

        const isStale = () => lookupGenRef.current !== gen || controller.signal.aborted;
        const clearSlowTimer = () => {
            if (slowTimerRef.current) { clearTimeout(slowTimerRef.current); slowTimerRef.current = null; }
        };

        setIsAiLoading(true);
        setShowCancelOption(false);
        // After 1 second of waiting, offer to cancel and enter the details manually
        slowTimerRef.current = setTimeout(() => {
            if (lookupGenRef.current === gen && !controller.signal.aborted) setShowCancelOption(true);
        }, 1000);

        const token = localStorage.getItem('Token')
        try {
            let response = await (await fetch(`/api/ShoppingListItem/options?search_term=${name}`, {
                headers: { 'edgetoken': token || "" },
                signal: controller.signal
            })).json()

            if (isStale()) return;
            clearSlowTimer();

            if (response.success && response.data.category && response.data.category[0]) {
                const values = response.data
                // Fill from the matched DB record; anything it lacks keeps the current (reset) values
                setFormData(prev => ({
                    ...prev,
                    category: values.category[0] ? values.category[0].value : prev.category,
                    quantity: values.quantity[0] ? values.quantity[0].value : prev.quantity,
                    quantity_type: values.quantity_type[0] ? values.quantity_type[0].value : prev.quantity_type
                }));
                setFieldsRevealed(true);
                setIsAiLoading(false);
            } else {
                setFieldsRevealed(true);
                userChangedFields.current = false;

                fetch(`/api/ai/determine_default_categories?search_term=${name}`, {
                    headers: { 'edgetoken': token || "" },
                    signal: controller.signal
                }).then(res => res.json()).then(aiResponse => {
                    if (isStale()) return;
                    if (aiResponse.success && !userChangedFields.current) {
                        const { category, quantity, unit } = aiResponse.data;
                        setFormData(prev => ({
                            ...prev,
                            category: isValidCategory(categories, category) ? category : prev.category,
                            quantity: quantity || prev.quantity,
                            quantity_type: unit || prev.quantity_type
                        }));
                    }
                }).catch(error => {
                    if (!controller.signal.aborted) console.log(error)
                }).finally(() => {
                    if (lookupGenRef.current === gen && !controller.signal.aborted) {
                        setIsAiLoading(false);
                        setShowCancelOption(false);
                    }
                });
            }
        } catch (error) {
            if (isStale()) return;
            clearSlowTimer();
            setFieldsRevealed(true);
            setIsAiLoading(false);
        }
    }

    const getKnownIngredients = async () => {
        try {
            const token = localStorage.getItem('Token')
            let response = await (await fetch(`/api/Ingredients/defaults`, {
                headers: { 'edgetoken': token || "" }
            })).json()

            if (response.success) {
                setKnownIngredients(response.data)
            } else {
                alert(response.data)
            }
        } catch (error) {
            alert(error)
        }
    }

    // Thorough database lookup used by the name dropdown when local suggestions fall short
    const searchIngredientDatabase = useCallback(async (q: string, signal?: AbortSignal) => {
        try {
            const token = localStorage.getItem('Token')
            const response = await (await fetch(`/api/Ingredients/suggest?q=${encodeURIComponent(q)}`, {
                headers: { 'edgetoken': token || "" },
                signal
            })).json()
            return response.success ? response.data : []
        } catch (error) {
            return []
        }
    }, [])

    useEffect(() => {
        getKnownIngredients()
        if (triggerSearchOnInit && initialData?.name) {
            determineDefaults(initialData.name);
        }
    }, [triggerSearchOnInit, initialData?.name]);

    // Overlay chrome: lock body scroll, autofocus the search field, Escape to close
    const onCancelRef = useRef(onCancel);
    useEffect(() => { onCancelRef.current = onCancel; });
    useEffect(() => {
        if (!isOverlay) return;
        document.body.style.overflow = 'hidden';
        const focusTimer = setTimeout(() => {
            const el = document.querySelector<HTMLInputElement>('input[name="name"]:not(:disabled)');
            if (el) el.focus();
        }, 150);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancelRef.current?.();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = '';
            clearTimeout(focusTimer);
            window.removeEventListener('keydown', onKey);
        };
    }, [isOverlay]);

    // Abort any in-flight request on unmount
    useEffect(() => () => {
        if (abortRef.current) abortRef.current.abort();
        if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
        if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
    }, []);

    const content = (
        <form onSubmit={handleSubmitLocal} className={`flex flex-col ${isOverlay ? 'min-h-full gap-4' : 'gap-3'} relative z-10`}>
            <input name="name" id="ingredName" type="text" placeholder={shoppingListId} disabled hidden />

            {!hideHeader && !isOverlay && (
                <div className="hidden md:flex flex-col gap-1 mb-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-accent flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                        Quick Add Ingredient
                    </div>
                </div>
            )}

            {isOverlay && (
                <div className="flex items-center min-h-[22px] pr-10">
                    {justAdded ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-[0.25em] animate-in fade-in slide-in-from-top-1 duration-300">
                            <Check size={13} strokeWidth={3} />
                            Added to list
                        </div>
                    ) : (
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Add Item</div>
                    )}
                </div>
            )}

            {!hideNameInput && (
                <div className="flex flex-col gap-1.5 z-20">
                    {!isOverlay && (
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Item Name</label>
                    )}
                    <div className={`relative group/input z-30 ${isOverlay ? '[&_input]:!py-3.5 [&_input]:!text-base [&_input]:!rounded-2xl [&_input]:!font-medium' : ''}`}>
                        <SearchableDropdown
                            options={knownIngredients}
                            placeholder={isOverlay ? "Search or type a new item…" : "What are we adding?"}
                            onChange={handleChange}
                            name={"name"}
                            value={formData.name}
                            onComplete={handleNameSubmit}
                            remoteSearch={searchIngredientDatabase}
                        />
                    </div>
                </div>
            )}

            {!hideNote && (
                <div className="flex flex-col gap-1.5">
                    {isNoteOpen ? (
                        <>
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Note (optional)</label>
                                <button type="button" onClick={() => setIsNoteOpen(false)} className="text-[8px] text-muted-foreground hover:text-white uppercase font-black transition-colors">Hide</button>
                            </div>
                            <input
                                name="note"
                                id="ingredNote"
                                type="text"
                                placeholder="e.g. Extra fresh, organic..."
                                onChange={handleChange}
                                value={formData.note}
                                className="input-modern !py-2 !px-3 bg-background/40 border-white/5 focus:bg-background/60 transition-all text-xs"
                            />
                        </>
                    ) : (
                        <button 
                            type="button" 
                            onClick={() => setIsNoteOpen(true)} 
                            className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-white flex items-center gap-2 transition-colors w-fit ml-1"
                        >
                            <span className="text-accent text-xs">+</span> Add Note
                        </button>
                    )}
                </div>
            )}

            {isAiLoading && (isOverlay ? (
                <div className="flex flex-col items-center gap-2.5 py-4 px-4 bg-white/[0.03] rounded-2xl border border-white/10 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2.5">
                        <Loader2 size={14} className="animate-spin text-accent shrink-0" />
                        <span className="text-[10px] text-white/60 font-black uppercase tracking-[0.2em] text-center">
                            Looking up {formData.name ? `"${formData.name}"` : 'details'}…
                        </span>
                    </div>
                    {showCancelOption && (
                        <button
                            type="button"
                            onClick={cancelLookup}
                            className="text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-full px-4 py-2.5 transition-all active:scale-95 animate-in fade-in duration-300 min-h-[38px]"
                        >
                            Cancel — enter manually
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex justify-center items-center gap-3 py-4 bg-accent/5 rounded-2xl border border-accent/10 animate-pulse">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
                    <span className="text-[10px] text-accent font-black uppercase tracking-[0.2em]">AI is analyzing ingredient...</span>
                </div>
            ))}

            {fieldsRevealed && (
                <div className={`flex flex-col gap-3 ${isOverlay ? '' : 'animate-in fade-in slide-in-from-top-4 duration-500 pt-3 border-t border-white/5'}`}>
                    <div className={`grid grid-cols-2 ${isOverlay ? 'gap-3' : 'gap-2'}`}>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Quantity</label>
                            <div className="relative">
                                <input
                                    name="quantity"
                                    id="ingredAmount"
                                    type="text"
                                    placeholder="Amount"
                                    required
                                    onChange={handleChange}
                                    value={formData.quantity}
                                    className={`input-modern ${isOverlay
                                        ? '!py-3 !px-3.5 !pr-[5.5rem] !rounded-xl text-sm font-bold'
                                        : '!py-2 !px-3 bg-background/40 border-white/5 focus:ring-2 focus:ring-accent/20 text-xs'}`}
                                />
                                {isOverlay && (
                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => adjustQuantity(-1)}
                                            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white flex items-center justify-center active:scale-90 transition-all"
                                            tabIndex={-1}
                                            aria-label="Decrease quantity"
                                        >
                                            <Minus size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => adjustQuantity(1)}
                                            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white flex items-center justify-center active:scale-90 transition-all"
                                            tabIndex={-1}
                                            aria-label="Increase quantity"
                                        >
                                            <Plus size={13} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Unit</label>
                            <select
                                name="quantity_type"
                                id="quantity_type"
                                onChange={handleChange}
                                value={formData.quantity_type}
                                required
                                className={`input-modern ${isOverlay
                                    ? '!py-3 !px-3 !rounded-xl text-sm font-bold'
                                    : '!py-2 !px-3 bg-background/40 border-white/5 focus:ring-2 focus:ring-accent/20 text-xs'}`}
                            >
                                {Object.keys(quantity_unit_conversions)
                                    .filter(item => !["can", "bottle", "package", "stick", "bunch", "head", "stalk", "stem", "bag", "box", "tray", "tub"].includes(item))
                                    .map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </div>
                    </div>

                    {!hideCategories && (
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</label>
                            <div className={isOverlay ? '[&_input]:!py-3 [&_input]:!rounded-xl [&_input]:!text-sm' : ''}>
                                <SearchableDropdown
                                    options={categories.map((cat) => cat.name)}
                                    placeholder={"Assign a category..."}
                                    onChange={handleChange}
                                    name={"category"}
                                    value={formData.category}
                                    onComplete={() => { }}
                                    showUseAnyway={false}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className={isOverlay ? 'mt-auto pt-2' : 'mt-1'}>
                <Button
                    className={`w-full font-black uppercase tracking-[0.2em] text-[10px] ${isOverlay ? 'py-4 rounded-2xl' : 'py-3.5 rounded-xl'} transition-all active:scale-95 flex items-center justify-center gap-2.5 shadow-xl ${fieldsRevealed
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                        : 'bg-accent/20 hover:bg-accent/30 text-accent border border-accent/20 shadow-none'
                        }`}
                    type="submit"
                    onMouseDown={() => { submitIntentRef.current = true; }}
                >
                    {fieldsRevealed ? (
                        <>
                            <Sparkles size={15} /> Add to Collection
                        </>
                    ) : (
                        <>
                            <Search size={15} /> Search
                        </>
                    )}
                </Button>
            </div>
        </form>
    );

    if (isOverlay) {
        return (
            <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-5">
                <div
                    className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => onCancel?.()}
                    aria-hidden="true"
                />
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add item to shopping list"
                    className="relative z-10 w-full max-w-md h-[min(560px,calc(100dvh_-_1.5rem))] flex flex-col rounded-3xl border border-white/10 bg-[#0a0d0c] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="absolute top-3.5 right-3.5 text-white/50 hover:text-white transition-colors p-2.5 hover:bg-white/5 rounded-full flex items-center justify-center min-h-[40px] min-w-[40px] z-[70]"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    )}
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 pb-2">
                        {content}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-secondary/40 backdrop-blur-md rounded-xl md:rounded-[2rem] border border-white/10 w-full max-w-none md:max-w-[550px] mx-auto mb-3 md:mb-6 p-3 md:p-5 relative min-h-[110px] group/add-item animate-in fade-in zoom-in-95 duration-500 shadow-2xl shadow-black/20">
            {/* Improved visibility highlight */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/15 via-transparent to-accent/5 opacity-40 pointer-events-none" />
            <div className="absolute inset-0 bg-white/[0.02] pointer-events-none" />

            {onCancel && (
                <button
                    type="button"
                    onClick={onCancel}
                    className="absolute top-3 right-3 md:top-6 md:right-6 text-muted-foreground hover:text-white transition-colors z-[70] p-2.5 hover:bg-white/5 rounded-full flex items-center justify-center min-h-[40px] min-w-[40px]"
                >
                    <X size={18} />
                </button>
            )}

            {content}
        </div>
    );
}
