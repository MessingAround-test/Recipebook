import React, { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css'; // Import CSS module
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button'
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
        console.log("HAPPENED")
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
        
        console.log(formData)
        console.log(name)
        console.log(value)
        setFormData({ ...formData, [name]: value });
    };

    const handleNameSubmit = async function (e) {
        if (formData.name !== undefined && formData.name !== "") {
            await determineDefaults(formData.name)
        }

    };

    const handleSubmitLocal = async (e) => {
        e.value = formData
        e.resetForm = resetForm; // Reset the form data after successful submission
        handleSubmit(e)
    };

    async function determineDefaults(name) {
        try {
            let response = await (await fetch(`/api/ShoppingListItem/options?search_term=${name}&EDGEtoken=` + localStorage.getItem('Token'))).json()

            console.log(response)

            if (response.success) {
                const values = response.data

                let category = values.category[0] ?  values.category[0].value  : formData.category
                let quantity = values.quantity[0] ? values.quantity[0].value : formData.quantity
                let quantity_type = values.quantity_type[0] ? values.quantity_type[0].value : formData.quantity_type

                setFormData({ ...formData, category: category, quantity: quantity, quantity_type: quantity_type });


                // alert(response)
                // Handle success, e.g., show a success message or redirect
            } else {
                console.log(response.data)
                return
                // alert(response.data)
                // Handle errors, e.g., show an error message
            }
        } catch (error) {
            console.log(error)
            return
            // alert(error)
            // Handle network or other errors
        }
    }



    const getKnownIngredients = async (e) => {
        // e.preventDefault();
        try {
            let response = await (await fetch(`/api/Ingredients/defaults?EDGEtoken=` + localStorage.getItem('Token'))).json()

            console.log(response)

            if (response.success) {

                setKnownIngredients(response.data)
                // alert(response)
                // Handle success, e.g., show a success message or redirect
            } else {
                alert(response.data)
                // Handle errors, e.g., show an error message
            }
        } catch (error) {
            alert(error)
            // Handle network or other errors
        }
    }

    useEffect(() => {
        getKnownIngredients({})
    }, []);

    return (
        <div className={styles['centered']}>

            <Form onSubmit={(e) => handleSubmitLocal(e)}>
                <Form.Group className="mb-3" id="ingredName">
                    <Form.Control name="name" id="ingredName" type="text" placeholder={shoppingListId} disabled hidden />
                </Form.Group>

                <Form.Group className="mb-3" id="formIngredName">
                    <SearchableDropdown options={knownIngredients} placeholder={"Enter Ingredient Name"} onChange={handleChange} name={"name"} value={formData.name} onComplete={handleNameSubmit}></SearchableDropdown>
                </Form.Group>
                <Form.Group className="mb-3" id="formBasicEmail">
                    <Form.Control name="quantity" id="ingredAmount" type="text" placeholder="Enter Amount" required onChange={handleChange} value={formData.quantity} />
                    <Form.Select aria-label="Default select example" name="quantity_type" id="quantity_type" onChange={handleChange} value={formData.quantity_type} required>
                        <option value="any">any</option>
                        {Object.keys(quantity_unit_conversions).map((item) => <option value={item}>{item}</option>)}
                    </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3" id="formBasicPassword">
                    <Form.Control name="note" id="ingredNote" type="text" placeholder="(optional note)" onChange={handleChange} value={formData.note} />
                </Form.Group>
                {hideCategories ? <></> : <><Form.Group className="mb-3" id="formCategory">
                    <SearchableDropdown options={categories.map((cat)=>cat.name)} placeholder={"Category"} onChange={handleChange} name={"category"} value={formData.category}></SearchableDropdown>
                </Form.Group></>}



                <Button variant="success" type="submit">
                    Submit
                </Button>
                {/* <Button variant="primary" onClick={() => console.log(formData)}>
                    show state
                </Button> */}
            </Form>
        </div>
    );
}

export default AddShoppingItem;
