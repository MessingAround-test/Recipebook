import React, { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css'; // Import CSS module
import { quantity_unit_conversions } from "../lib/conversion"
import SearchableImageDropdown from './SearchableImageDropdown';
import SearchableDropdown from './SearchableDropdown';

let categories = [
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


function AddShoppingItem({ shoppingListId, handleSubmit, hideCategories = false }) {
    const [formData, setFormData] = useState({
        name: "",
        quantity: 1,
        quantity_type: "any",
        note: "",
        "shoppingListId": shoppingListId,
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

    const [knownIngredients, setKnownIngredients] = useState([])

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleNameSubmit = async function (e) {
        if (formData.name !== undefined && formData.name !== "") {
            await determineDefaults(formData.name)
        }

    };

    const handleSubmitLocal = async (e) => {
        e.preventDefault();
        e.value = formData
        e.resetForm = resetForm;
        handleSubmit(e)
    };

    function isValidCategory(categories, to_check) {
        return categories.some(category => category.name === to_check);
    }

    async function determineDefaults(name) {
        try {
            let response = await (await fetch(`/api/ShoppingListItem/options?search_term=${name}&EDGEtoken=` + localStorage.getItem('Token'))).json()

            if (response.success) {
                const values = response.data

                if (values.category[0]) {
                    let category = values.category[0] ? values.category[0].value : formData.category
                    let quantity = values.quantity[0] ? values.quantity[0].value : formData.quantity
                    let quantity_type = values.quantity_type[0] ? values.quantity_type[0].value : formData.quantity_type
                    setFormData({ ...formData, category: category, quantity: quantity, quantity_type: quantity_type });
                } else {
                    let response = await (await fetch(`/api/ai/determine_default_categories?search_term=${name}&EDGEtoken=` + localStorage.getItem('Token'))).json()
                    if (!response.success) {
                        console.error('Error fetching data:', response.statusText);
                        return;
                    }

                    const category = response.data;

                    if (isValidCategory(categories, category)) {
                        setFormData({ ...formData, category: category });
                    } else {
                        console.log("The response is not a valid category.");
                    }

                }
            } else {
                return
            }
        } catch (error) {
            console.log(error)
            return
        }
    }

    const getKnownIngredients = async (e) => {
        try {
            let response = await (await fetch(`/api/Ingredients/defaults?EDGEtoken=` + localStorage.getItem('Token'))).json()

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
        getKnownIngredients({})
    }, []);

    return (
        <div className="receipt" style={{ maxWidth: '450px', margin: '1rem auto' }}>
            <form onSubmit={handleSubmitLocal}>
                <h3 className="text-center bold uppercase mb-3" style={{ borderBottom: '2px dashed black', paddingBottom: '0.5rem' }}>New Item</h3>

                <input name="name" id="ingredName" type="text" placeholder={shoppingListId} disabled hidden />

                <div className="mb-3">
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

                <div className="flex-row gap-2 mb-3">
                    <div className="flex-col w-full">
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
                    <div className="flex-col w-full">
                        <label className="label-paper">Unit</label>
                        <select
                            name="quantity_type"
                            id="quantity_type"
                            onChange={handleChange}
                            value={formData.quantity_type}
                            required
                            className="input-paper"
                        >
                            <option value="any">any</option>
                            {Object.keys(quantity_unit_conversions).map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </div>
                </div>

                <div className="mb-3">
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
                    <div className="mb-3">
                        <label className="label-paper">Category</label>
                        <SearchableDropdown
                            options={categories.map((cat) => cat.name)}
                            placeholder={"Category"}
                            onChange={handleChange}
                            name={"category"}
                            value={formData.category}
                        />
                    </div>
                )}

                <div className="mt-4 text-center">
                    <button className="btn-paper align-center justify-center w-full" type="submit">
                        Add to List
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AddShoppingItem;
