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

function AddShoppingItem({shoppingListId, handleSubmit}) {
    const [formData, setFormData] = useState({
        name: "",
        quantity: "",
        quantity_type: "",
        note: "",
        "shoppingListId": shoppingListId
    });

    const resetForm = () => {
        console.log("HAPPENED")
        setFormData({
          name: "",
          quantity: "",
          quantity_type: "",
          note: "",
          shoppingListId: shoppingListId,
        });
      };
      

    
    const [knownIngredients, setKnownIngredients] = useState([])

    const handleChange = (e) => {
        const { name, value } = e.target;
        console.log(e)
        console.log(formData)
        console.log(name)
        console.log(value)
        setFormData({ ...formData, [name]: value });  
    };

    const handleSubmitLocal = async (e) => {
        e.value = formData
        e.resetForm = resetForm; // Reset the form data after successful submission
        handleSubmit(e)
    };

    

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
            <Form onSubmit={(e) => handleSubmitLocal(e)}>
                <Form.Group className="mb-3" id="formBasicEmail">
                    <Form.Control name="name" id="ingredName" type="text" placeholder={shoppingListId} disabled hidden />
                </Form.Group>
                <Form.Group className="mb-3" id="formIngredName">
                    <SearchableDropdown options={knownIngredients} placeholder={"Enter Ingredient Name"} onChange={handleChange} name={"name"} value={formData.name} ></SearchableDropdown>
                </Form.Group>
                <Form.Group className="mb-3" id="formBasicEmail">
                    <Form.Control name="quantity" id="ingredAmount" type="text" placeholder="Enter Amount" required onChange={handleChange} value={formData.quantity}/>
                    <Form.Select aria-label="Default select example" name="quantity_type" id="quantity_type" onChange={handleChange} value={formData.quantity_type} required>
                    <option></option>
                        {Object.keys(quantity_unit_conversions).map((item) => <option value={item}>{item}</option>)}
                    </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3" id="formBasicPassword">
                    <Form.Control name="note" id="ingredNote" type="text" placeholder="(optional note)" onChange={handleChange} value={formData.note}/>
                </Form.Group>
                <Form.Group className="mb-3" id="formCategory">
                    <SearchableDropdown options={categories} placeholder={"Category"} onChange={handleChange} name={"category"} value={formData.category}></SearchableDropdown>
                </Form.Group>


                <Button variant="success" type="submit">
                    Submit
                </Button>
                {/* <Button variant="primary" onClick={()=>console.log(formData)}>
                    show state
                </Button> */}
            </Form>
        </div>
    );
}

export default AddShoppingItem;
