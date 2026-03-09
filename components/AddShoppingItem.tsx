import React, { useState, useEffect, FormEvent } from 'react'
import { quantity_unit_conversions } from "../lib/conversion"
import SearchableImageDropdown from './SearchableImageDropdown'
import SearchableDropdown from './SearchableDropdown'
import { FormField } from './FormField'
import { Button } from './ui/button'

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
}

export default function AddShoppingItem({ shoppingListId, handleSubmit, hideCategories = false }: AddShoppingItemProps) {
    const [formData, setFormData] = useState({
        name: "",
        quantity: 1 as number | string,
        quantity_type: "any",
        note: "",
        shoppingListId: shoppingListId,
        category: ""
    });

    const resetForm = () => {
        setFormData({
            name: "",
            quantity: 1,
            quantity_type: "any",
            note: "",
            shoppingListId: shoppingListId,
            category: ""
        });
    };

    const [knownIngredients, setKnownIngredients] = useState<any[]>([])

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNameSubmit = async () => {
        if (formData.name !== undefined && formData.name !== "") {
            await determineDefaults(formData.name)
        }
    };

    const handleSubmitLocal = async (e: any) => {
        e.preventDefault();
        e.value = formData
        e.resetForm = resetForm;
        handleSubmit(e)
    };

    function isValidCategory(categories: any[], to_check: string) {
        return categories.some(category => category.name === to_check);
    }

    async function determineDefaults(name: string) {
        try {
            const token = localStorage.getItem('Token')
            let response = await (await fetch(`/api/ShoppingListItem/options?search_term=${name}`, {
                headers: { 'edgetoken': token || "" }
            })).json()

            if (response.success) {
                const values = response.data

                if (values.category && values.category[0]) {
                    let category = values.category[0] ? values.category[0].value : formData.category
                    let quantity = values.quantity[0] ? values.quantity[0].value : formData.quantity
                    let quantity_type = values.quantity_type[0] ? values.quantity_type[0].value : formData.quantity_type
                    setFormData(prev => ({ ...prev, category, quantity, quantity_type }));
                } else {
                    let response = await (await fetch(`/api/ai/determine_default_categories?search_term=${name}`, {
                        headers: { 'edgetoken': token || "" }
                    })).json()
                    if (!response.success) {
                        console.error('Error fetching data:', response.statusText);
                        return;
                    }

                    const category = response.data;

                    if (isValidCategory(categories, category)) {
                        setFormData(prev => ({ ...prev, category }));
                    } else {
                        console.log("The response is not a valid category.");
                    }
                }
            }
        } catch (error) {
            console.log(error)
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
        <div className="glass-card w-full max-w-[500px] mx-auto mb-4 p-8 border border-[var(--glass-border)]">
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
                            <option value="any">any</option>
                            {Object.keys(quantity_unit_conversions).map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </div>
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

                <div className="mt-4 flex justify-center">
                    <Button className="w-full font-bold uppercase tracking-wider text-base py-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02]" type="submit">
                        Add to List
                    </Button>
                </div>
            </form>
        </div>
    );
}
