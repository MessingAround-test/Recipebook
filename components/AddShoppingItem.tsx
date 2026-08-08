import React, { useState, useEffect, useRef } from 'react'
import { quantity_unit_conversions } from "../lib/conversion"
import SearchableImageDropdown from './SearchableImageDropdown'
import SearchableDropdown from './SearchableDropdown'
import { FormField } from './FormField'
import { Button } from './ui/button'
import { X } from 'lucide-react'

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
}

export default function AddShoppingItem({ shoppingListId, handleSubmit, hideCategories = false, onCancel, initialData, hideHeader = false, hideNote = false, hideNameInput = false, triggerSearchOnInit = false }: AddShoppingItemProps) {
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
    const userChangedFields = useRef(false);
    const initialFormRef = useRef<string | null>(null);

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
    };

    const [knownIngredients, setKnownIngredients] = useState<any[]>([])

    const handleChange = (e: any) => {
        const { name, value, option } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (fieldsRevealed && (name === 'quantity' || name === 'quantity_type' || name === 'category')) {
            userChangedFields.current = true;
        }

        if (option && name === 'name') {
            setFieldsRevealed(false);
            userChangedFields.current = false;
            setFormData(prev => ({ ...prev, category: "", quantity: 1, quantity_type: "each" }));
            determineDefaults(value);
        }
    };

    const handleNameSubmit = async (nameOverride?: string) => {
        if (fieldsRevealed || isAiLoading) return;
        const nameToUse = typeof nameOverride === 'string' ? nameOverride : formData.name;
        if (nameToUse !== undefined && nameToUse !== "") {
            await determineDefaults(nameToUse)
        }
    };

    const handleSubmitLocal = async (e: any) => {
        e.preventDefault();
        if (!fieldsRevealed && !isAiLoading) {
            await handleNameSubmit();
            return;
        }
        e.value = formData
        e.resetForm = resetForm;
        handleSubmit(e)
    };

    function isValidCategory(categories: any[], to_check: string) {
        return categories.some(category => category.name === to_check);
    }

    async function determineDefaults(name: string) {
        setIsAiLoading(true);
        const token = localStorage.getItem('Token')
        try {
            let response = await (await fetch(`/api/ShoppingListItem/options?search_term=${name}`, {
                headers: { 'edgetoken': token || "" }
            })).json()

            if (response.success && response.data.category && response.data.category[0]) {
                const values = response.data
                let category = values.category[0] ? values.category[0].value : formData.category
                let quantity = values.quantity[0] ? values.quantity[0].value : formData.quantity
                let quantity_type = values.quantity_type[0] ? values.quantity_type[0].value : formData.quantity_type
                setFormData(prev => ({ ...prev, category, quantity, quantity_type }));
                setFieldsRevealed(true);
                setIsAiLoading(false);
            } else {
                setFieldsRevealed(true);
                userChangedFields.current = false;
                initialFormRef.current = JSON.stringify({ quantity: formData.quantity, quantity_type: formData.quantity_type, category: formData.category });

                fetch(`/api/ai/determine_default_categories?search_term=${name}`, {
                    headers: { 'edgetoken': token || "" }
                }).then(res => res.json()).then(aiResponse => {
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
                    console.log(error)
                }).finally(() => {
                    setIsAiLoading(false);
                });
            }
        } catch (error) {
            console.log(error)
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

    useEffect(() => {
        getKnownIngredients()
        if (triggerSearchOnInit && initialData?.name) {
            determineDefaults(initialData.name);
        }
    }, [triggerSearchOnInit, initialData?.name]);

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

            <form onSubmit={handleSubmitLocal} className="flex flex-col gap-3 relative z-10">
                {!hideHeader && (
                    <div className="hidden md:flex flex-col gap-1 mb-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-accent flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                            Quick Add Ingredient
                        </div>
                    </div>
                )}

                <input name="name" id="ingredName" type="text" placeholder={shoppingListId} disabled hidden />

                {!hideNameInput && (
                    <div className="flex flex-col gap-1 z-20">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Item Name</label>
                        <div className="relative group/input z-30">
                            <SearchableDropdown
                                options={knownIngredients}
                                placeholder={"What are we adding?"}
                                onChange={handleChange}
                                name={"name"}
                                value={formData.name}
                                onComplete={handleNameSubmit}
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

                {isAiLoading && (
                    <div className="flex justify-center items-center gap-3 py-4 bg-accent/5 rounded-2xl border border-accent/10 animate-pulse">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
                        <span className="text-[10px] text-accent font-black uppercase tracking-[0.2em]">AI is analyzing ingredient...</span>
                    </div>
                )}

                {fieldsRevealed && (
                    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-500 pt-3 border-t border-white/5">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Quantity</label>
                                <input
                                    name="quantity"
                                    id="ingredAmount"
                                    type="text"
                                    placeholder="Amount"
                                    required
                                    onChange={handleChange}
                                    value={formData.quantity}
                                    className="input-modern !py-2 !px-3 bg-background/40 border-white/5 focus:ring-2 focus:ring-accent/20 text-xs"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Unit</label>
                                <select
                                    name="quantity_type"
                                    id="quantity_type"
                                    onChange={handleChange}
                                    value={formData.quantity_type}
                                    required
                                    className="input-modern !py-2 !px-3 bg-background/40 border-white/5 focus:ring-2 focus:ring-accent/20 text-xs"
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
                                <SearchableDropdown
                                    options={categories.map((cat) => cat.name)}
                                    placeholder={"Assign a category..."}
                                    onChange={handleChange}
                                    name={"category"}
                                    value={formData.category}
                                    onComplete={() => { }}
                                />
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-1">
                    <Button
                        className={`w-full font-black uppercase tracking-[0.2em] text-[10px] py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl ${fieldsRevealed
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                            : 'bg-accent/20 hover:bg-accent/30 text-accent border border-accent/20 shadow-none'
                            }`}
                        type="submit"
                    >
                        {fieldsRevealed ? (
                            <>
                                <span className="text-lg">✨</span> Add to Collection
                            </>
                        ) : (
                            <>
                                <span className="text-lg">🔍</span> Search
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
