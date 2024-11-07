import Head from 'next/head';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner'; // Import Spinner for loading
import { useEffect, useState } from 'react';
import Router from 'next/router';
import { quantity_unit_conversions } from "../lib/conversion"

const categories = [
    { name: 'Fresh Produce' },
    { name: 'Dairy and Eggs' },
    { name: 'Bakery' },
    // Add more categories as needed...
];

export default function IngredientResearchComponent() {
    const [userData, setUserData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [ingredientData, setIngredientData] = useState([]);
    const [quantity, setQuantity] = useState(1);
    const [quantityUnit, setQuantityUnit] = useState('any');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false); // Loading state

    async function getUserDetails() {
        let data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json();
        setUserData(data.res);
    }

    // useEffect(() => {
    //     if (!localStorage.getItem('Token')) {
    //         alert("Please re-log in");
    //         Router.push("/login");
    //     } else {
    //         getUserDetails();
    //     }
    // }, []);

    async function handleGetIngredient(e) {
        e.preventDefault();
        setLoading(true); // Start loading
        


        const data = await (await fetch(`/api/Ingredients/?name=${searchTerm}&qType=${quantityUnit}&quantity=${quantity}&EDGEtoken=${localStorage.getItem('Token')}`)).json();
        setLoading(false); // Stop loading

        if (data.loadedSource === true) {
            const data = await (await fetch(`/api/Ingredients/?name=${searchTerm}&qType=${quantityUnit}&quantity=${quantity}&EDGEtoken=${localStorage.getItem('Token')}`)).json();
            setIngredientData(data.res);
        } else {
            setIngredientData(data.res);
        }
    }

    return (
        <div>
            <Form onSubmit={handleGetIngredient}>
                <Form.Group className="mb-3 d-flex align-items-center">
                    <Form.Control
                        name="ingredName"
                        value={searchTerm}
                        type="text"
                        placeholder="Enter ingredient name"
                        onChange={(e) => setSearchTerm(e.target.value)}
                        required
                        className="me-2"
                        autoComplete='off'
                    />
                    <Button variant="primary" type="submit">Submit</Button>
                </Form.Group>
            </Form>

            

            {/* Extra options to select quantity and category */}
            <Form.Group className="mb-3">
                <Form.Label>Quantity</Form.Label>
                <Form.Control
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Unit</Form.Label>
                <Form.Select aria-label="Default select example" name="quantity_type" id="quantity_type" onChange={(e) => setQuantityUnit(e.target.value)} value={quantityUnit} required>
                    <option value="any">any</option>
                    {Object.keys(quantity_unit_conversions).map((item) => <option value={item}>{item}</option>)}
                </Form.Select>
            </Form.Group>

            {/* Display loading spinner while data is being fetched */}
            {loading && <Spinner animation="border" role="status"><span className="visually-hidden">Loading...</span></Spinner>}

            {/* Display the ingredient data in a table */}
            {ingredientData.length > 0 && (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Name</th>
                            <th>Source</th>
                            <th>Price</th>
                            <th>Unit Price</th>
                            <th>Quantity</th>
                            <th>Quantity Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ingredientData.map((ingredient, index) => (
                            <tr key={ingredient._id || index}>
                                <td>{ingredient.rank}</td>
                                <td>{ingredient.name}</td>
                                <td>{ingredient.source}</td>
                                <td>${ingredient.price.toFixed(2)}</td>
                                <td>
                                    {/* Code to show cents */}
                                    {ingredient.unit_price_converted < 1
                                        ? `${(ingredient.unit_price_converted * 100).toFixed(2)}¢ per ${ingredient.unit_price_converted_type}`
                                        : `$${ingredient.unit_price_converted.toFixed(2)} per ${ingredient.unit_price_converted_type}`}
                                </td>

                                <td>{ingredient.quantity}</td>
                                <td>{ingredient.quantity_unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </div>
    );
}
