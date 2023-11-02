import React, { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css'; // Import CSS module
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button'
import { quantity_unit_conversions } from "../lib/conversion"
import SearchableDropdown from './SearchableDropdown';
let categories = [
    "Fresh Produce",
    "Dairy and Eggs",
    "Bakery",
    "Meat and Seafood",
    "Canned Goods",
    "Pasta and Grains",
    "Condiments and Sauces",
    "Snacks",
    "Beverages",
    "Frozen Foods",
    "Cereal and Breakfast Foods",
    "Baking Supplies",
    "Household and Cleaning",
    "Personal Care",
    "Baby Care",
    "Pet Supplies",
    "Health and Wellness",
    "International Foods",
    "Deli and Prepared Foods",
    "Home and Garden"
  ]

function AddShoppingItem() {
    const [formData, setFormData] = useState({
        ingredientName: "",
        amount: "",
        ingredAmountType: "",
        note: ""
    });

    const [knownIngredients, setKnownIngredients] = useState([])

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    // const handleSubmit = async (e) => {
    //     e.preventDefault();
    //     try {
    //         const response = await fetch(`/ASDASDapi/Transactionsasdsd/?EDGEtoken=${localStorage.getItem('Token')}`, {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //             },
    //             body: JSON.stringify(formData),
    //         });

    //         if (response.ok) {
    //             // alert(response)
    //             // Handle success, e.g., show a success message or redirect
    //         } else {
    //             // alert(response)
    //             // Handle errors, e.g., show an error message
    //         }
    //     } catch (error) {
    //         alert(error)
    //         // Handle network or other errors
    //     }
    // };

    const getKnownIngredients = async (e) => {
        // e.preventDefault();
        try {
            let response = await (await fetch(`/api/Ingredients/Categories?EDGEtoken=` + localStorage.getItem('Token'))).json()
            
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
            <h2>Add New Ingredient</h2>
            <Form onSubmit={(e) => onSubmitIngred(e)}>
                {/* <Form.Group className="mb-3" id="formBasicEmail">
                    <Form.Control name="ingredName" id="ingredName" type="text" placeholder="Enter ingredient Name" required />
                </Form.Group> */}
                <Form.Group className="mb-3" id="formIngredName">
                    <SearchableDropdown options={knownIngredients} placeholder={"Enter Ingredient Name"}></SearchableDropdown>
                </Form.Group>
                <Form.Group className="mb-3" id="formBasicEmail">
                    <Form.Control name="ingredAmount" id="ingredAmount" type="text" placeholder="Enter Amount" required />
                    <Form.Select aria-label="Default select example" name="ingredAmountType" id="ingredAmountType" required>
                        {Object.keys(quantity_unit_conversions).map((item) => <option value={item}>{item}</option>)}
                    </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3" id="formBasicPassword">
                    <Form.Control name="ingredNote" id="ingredNote" type="text" placeholder="(optional note)" />
                </Form.Group>
                <Form.Group className="mb-3" id="formCategory">
                    <SearchableDropdown options={categories} placeholder={"Category"}></SearchableDropdown>
                </Form.Group>


                <Button variant="primary" type="submit">
                    Submit
                </Button>
            </Form>
        </div>
    );
}

export default AddShoppingItem;
