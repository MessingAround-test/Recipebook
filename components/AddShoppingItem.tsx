import React, { useState, useEffect, FormEvent } from 'react'
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
}

export default function AddShoppingItem({ shoppingListId, handleSubmit, hideCategories = false, onCancel }: AddShoppingItemProps) {
    const [formData, setFormData] = useState({
        name: "",
        quantity: 1 as number | string,
        quantity_type: "each",
        note: "",
        shoppingListId: shoppingListId,
        category: ""
    });

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [fieldsRevealed, setFieldsRevealed] = useState(false);

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
    };

    const [knownIngredients, setKnownIngredients] = useState<any[]>([])

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNameSubmit = async () => {
        if (fieldsRevealed || isAiLoading) return;
        if (formData.name !== undefined && formData.name !== "") {
            await determineDefaults(formData.name)
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
        try {
            const token = localStorage.getItem('Token')
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
            } else {
                let aiResponse = await (await fetch(`/api/ai/determine_default_categories?search_term=${name}`, {
                    headers: { 'edgetoken': token || "" }
                })).json()

                if (aiResponse.success) {
                    const { category, quantity, unit } = aiResponse.data;
                    setFormData(prev => ({
                        ...prev,
                        category: isValidCategory(categories, category) ? category : prev.category,
                        quantity: quantity || prev.quantity,
                        quantity_type: unit || prev.quantity_type
                    }));
                }
                setFieldsRevealed(true);
            }
        } catch (error) {
            console.log(error)
            setFieldsRevealed(true);
        } finally {
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
    }, []);

    return (
        <div className="glass-card w-full max-w-[500px] mx-auto mb-4 p-8 border border-[var(--glass-border)] relative">
            {onCancel && (
                <button
                    type="button"
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
            )}
            <form onSubmit={handleSubmitLocal} className="flex flex-col gap-6">
                <div>
                    <h3 className="text-center font-bold uppercase text-2xl tracking-tight text-white mb-2">Add New Item</h3>
                    <div className="h-1 w-16 bg-[var(--accent)] mx-auto rounded-full"></div>
                </div>

                <input name="name" id="ingredName" type="text" placeholder={shoppingListId} disabled hidden />

                <div className="flex flex-col gap-2">
                    <label className="label-modern text-white">Item Name</label>
                    <SearchableDropdown
                        options={knownIngredients}
                        placeholder={"Enter Ingredient Name"}
                        onChange={handleChange}
                        name={"name"}
                        value={formData.name}
                        onComplete={handleNameSubmit}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="label-modern text-white">Note (optional)</label>
                    <input
                        name="note"
                        id="ingredNote"
                        type="text"
                        placeholder="Note"
                        onChange={handleChange}
                        value={formData.note}
                        className="input-modern"
                    />
                </div>

                {isAiLoading && (
                    <div className="flex justify-center items-center gap-2 py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent)]"></div>
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-widest">AI is thinking...</span>
                    </div>
                )}

                {fieldsRevealed && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex flex-row gap-4">
                            <div className="flex-1 flex flex-col gap-2">
                                <label className="label-modern text-white">Quantity</label>
                                <input
                                    name="quantity"
                                    id="ingredAmount"
                                    type="text"
                                    placeholder="Amount"
                                    required
                                    onChange={handleChange}
                                    value={formData.quantity}
                                    className="input-modern"
                                />
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                                <label className="label-modern text-white">Unit</label>
                                <select
                                    name="quantity_type"
                                    id="quantity_type"
                                    onChange={handleChange}
                                    value={formData.quantity_type}
                                    required
                                    className="input-modern bg-[var(--bg-secondary)]"
                                >
                                    {Object.keys(quantity_unit_conversions)
                                        .filter(item => !["can", "bottle", "package", "stick", "bunch", "head", "stalk", "stem", "bag", "box", "tray", "tub"].includes(item))
                                        .map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </div>
                        </div>

                        {!hideCategories && (
                            <div className="flex flex-col gap-2">
                                <label className="label-modern text-white">Category</label>
                                <SearchableDropdown
                                    options={categories.map((cat) => cat.name)}
                                    placeholder={"Category"}
                                    onChange={handleChange}
                                    name={"category"}
                                    value={formData.category}
                                    onComplete={() => { }}
                                />
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-4 flex justify-center">
                    <Button className="w-full font-bold uppercase tracking-wider text-base py-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02]" type="submit">
                        {fieldsRevealed ? 'Add to List' : 'Search Item'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
