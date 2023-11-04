import React, { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css'; // Import CSS module
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button'
import { quantity_unit_conversions } from "../lib/conversion"
import SearchableDropdown from './SearchableDropdown';

function GenericForm({ formInitialState, handleSubmitProp }) {
    const [formData, setFormData] = useState(formInitialState);

    const handleChange = (e) => {
        const { name, value } = e.target;
        console.log(e)
        console.log(formData)
        console.log(name)
        console.log(value)
        let currentVal = formData[name]
        currentVal.value = value
        
        setFormData({ ...formData, [name]: currentVal });
    };



    const handleSubmit = async (e) => {
        e.preventDefault();
        e.formData =formData
        let keyValuePairs = {};
        Object.keys(formData).forEach((key) => {
            keyValuePairs[key] = formData[key].value;
        });

        e.value = keyValuePairs

        handleSubmitProp(e)
    };

    useEffect(() => {
    }, []);

    return (
        <div className={styles['centered']}>
            <Form onSubmit={(e) => handleSubmit(e)}>
                {Object.keys(formData).map((key) => {
                    if (Array.isArray(formData[key].options)) {
                        return (
                            <Form.Group className="mb-3" id={`form-searchable-${key}`}>
                                <SearchableDropdown options={formData[key].options} placeholder={key} onChange={handleChange} name={key}></SearchableDropdown>
                            </Form.Group>
                        )
                    } else {
                        return (
                            <Form.Group className="mb-3" id={`form-${key}`}>
                                <Form.Control name={key} id={key} type="text" placeholder={key} onChange={handleChange} />
                            </Form.Group>
                        )
                    }
                })}
                {/* <Form.Group className="mb-3" id="formBasicEmail">
                    <Form.Control name="name" id="ingredName" type="text" placeholder={shoppingListId} disabled />
                </Form.Group>
                <Form.Group className="mb-3" id="formIngredName">
                    <SearchableDropdown options={knownIngredients} placeholder={"Enter Ingredient Name"} onChange={handleChange} name={"name"}></SearchableDropdown>
                </Form.Group>
                <Form.Group className="mb-3" id="formBasicEmail">
                    <Form.Control name="quantity" id="ingredAmount" type="text" placeholder="Enter Amount" required onChange={handleChange}/>
                    <Form.Select aria-label="Default select example" name="quantity_type" id="quantity_type" onChange={handleChange} required>
                        {Object.keys(quantity_unit_conversions).map((item) => <option value={item}>{item}</option>)}
                    </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3" id="formBasicPassword">
                    <Form.Control name="note" id="ingredNote" type="text" placeholder="(optional note)" onChange={handleChange}/>
                </Form.Group>
                <Form.Group className="mb-3" id="formCategory">
                    <SearchableDropdown options={categories} placeholder={"Category"} onChange={handleChange} name={"category"}></SearchableDropdown>
                </Form.Group> */}


                <Button variant="primary" type="submit">
                    Submit
                </Button>
                <Button variant="primary" onClick={() => console.log(formData)}>
                    show state
                </Button>
            </Form>
        </div>
    );
}

export default GenericForm;
