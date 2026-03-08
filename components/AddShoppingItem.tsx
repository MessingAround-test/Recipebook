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
            let response = await (await fetch(`/api/ShoppingListItem/options?search_term=${name}&EDGEtoken=${token}`)).json()

            if (response.success) {
                const values = response.data

                if (values.category && values.category[0]) {
                    let category = values.category[0] ? values.category[0].value : formData.category
                    let quantity = values.quantity[0] ? values.quantity[0].value : formData.quantity
                    let quantity_type = values.quantity_type[0] ? values.quantity_type[0].value : formData.quantity_type
                    setFormData(prev => ({ ...prev, category, quantity, quantity_type }));
                } else {
                    let response = await (await fetch(`/api/ai/determine_default_categories?search_term=${name}&EDGEtoken=${token}`)).json()
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
            let response = await (await fetch(`/api/Ingredients/defaults?EDGEtoken=${token}`)).json()

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
        <div className="receipt w-full max-w-[450px] mx-auto mb-4 p-6">
            <form onSubmit={handleSubmitLocal}>
                <h3 className="text-center font-bold uppercase mb-4 text-xl border-b-2 border-dashed border-black pb-2 text-black">New Item</h3>

                <input name="name" id="ingredName" type="text" placeholder={shoppingListId} disabled hidden />

                <div className="mb-4">
                    <label className="label-paper">Item Name</label>
                    <SearchableDropdown
                        options={knownIngredients}
                        placeholder={"Enter Ingredient Name"}
                        onChange={handleChange}
                        name={"name"}
                        value={formData.name}
                        onComplete={handleNameSubmit}
                    />
                </div>

                <div className="flex flex-row gap-4 mb-4">
                    <div className="flex-1">
                        <label className="label-paper">Quantity</label>
                        <input
                            name="quantity"
                            id="ingredAmount"
                            type="text"
                            placeholder="Amount"
                            required
                            onChange={handleChange}
                            value={formData.quantity}
                            className="input-paper"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="label-paper">Unit</label>
                        <select
                            name="quantity_type"
                            id="quantity_type"
                            onChange={handleChange}
                            value={formData.quantity_type}
                            required
                            className="input-paper !text-black"
                        >
                            <option value="any">any</option>
                            {Object.keys(quantity_unit_conversions).map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="label-paper">Note (optional)</label>
                    <input
                        name="note"
                        id="ingredNote"
                        type="text"
                        placeholder="Note"
                        onChange={handleChange}
                        value={formData.note}
                        className="input-paper"
                    />
                </div>

                {!hideCategories && (
                    <div className="mb-4">
                        <label className="label-paper">Category</label>
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

                <div className="mt-6 flex justify-center">
                    <Button className="w-full font-bold uppercase rounded" type="submit">
                        Add to List
                    </Button>
                </div>
            </form>
        </div>
    );
}
