import React, { useState, useEffect, useRef } from 'react';
import { Col, Row } from 'react-bootstrap';
import styles from '../styles/Home.module.css'
import 'chart.js/auto';
import { Doughnut, Line, Radar, Bar } from 'react-chartjs-2';

function IngredientNutrientGraph({ ingredients }) {
    const chartRef = useRef(null);
    const [ingredientNutrient, setIngredientNutrient] = useState({});
    const [selectedIngredient, setSelectedIngredient] = useState('');
    let filteredIngredients = selectedIngredient ? ingredients.filter(ingredient => ingredient.Name === selectedIngredient) : ingredients;

    const handleDropdownChange = async (event) => {
        setSelectedIngredient(event.target.value);
        let filteredIngredientsLocal = event.target.value ? ingredients.filter(ingredient => ingredient.Name === event.target.value) : ingredients;

        resetNutrientCount()
        Object.keys(filteredIngredientsLocal).forEach(element => {
            let ingredient = filteredIngredientsLocal[element]
            let name = ingredient.Name ? ingredient.Name : ingredient.name
            let quantity = ingredient.Amount ? ingredient.Amount : ingredient.quantity_type
            let quantity_type = ingredient.AmountType ? ingredient.AmountType : ingredient.quantity_type
            getNutrientData(name, quantity, quantity_type);
        });
    };

    const [totalNutrient, setTotalNutrient] = useState({
        protein: 0,   // in grams (for muscle repair and maintenance)
        fat: 0,       // in grams (for energy and hormonal balance)
        carbohydrates: 0,  // in grams (for energy)
        fiber: 0,     // in grams (for digestive health)
        iron: 0,         // in milligrams (vital for oxygen transport in the blood));
    })
    const dailyNutrientRequirements = {
        protein: 80,   // in grams (for muscle repair and maintenance)
        fat: 90,       // in grams (for energy and hormonal balance)
        carbohydrates: 200,  // in grams (for energy)
        fiber: 30,     // in grams (for digestive health)
        iron: 18,         // in milligrams (vital for oxygen transport in the blood)
    };
    const labels = Object.keys(dailyNutrientRequirements);
    const data = {
        labels,
        datasets: [
            {
                label: '% of Daily Recommended',
                data: Object.keys(totalNutrient).map((key) => totalNutrient[key] / dailyNutrientRequirements[key] * 100),
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
            },
        ],
    };


    async function getNutrientData(ingredientName, amount, qType) {
        if (ingredientName === undefined) {
            return;
        }

        try {
            let data = await (
                await fetch(`/api/Nutrition?search_term=${ingredientName}&quantity=${amount}&qType=${qType}&EDGEtoken=${localStorage.getItem('Token')}`)
            ).json();

            if (data.data.length > 0) {
                setIngredientNutrient(prevState => ({
                    ...prevState,
                    [ingredientName]: data.data[0],
                }));

                let nutrientInfo = data.data[0].nutrition_info;
                let protein = parseFloat(nutrientInfo.protein);  // Parse as float
                let fat = parseFloat(nutrientInfo.fat);
                let carbohydrates = parseFloat(nutrientInfo.carbohydrates);
                let fiber = parseFloat(nutrientInfo.fiber);
                let iron = parseFloat(nutrientInfo.iron);
                // these are amount / 100 becuase the API returns in 100 g always
                setTotalNutrient(prevState => ({
                    ...prevState,
                    "protein": prevState.protein + protein,
                    fat: prevState.fat + fat,
                    carbohydrates: prevState.carbohydrates + carbohydrates,
                    fiber: prevState.fiber + fiber,
                    iron: prevState.iron + iron,
                }));
            } else {
                setIngredientNutrient(prevState => ({
                    ...prevState,
                    [ingredientName]: {},
                }));
            }

        } catch (error) {
            console.error(`Error fetching nutrient data for ${ingredientName}: ${error.message}`);
        }
    }

    function resetNutrientCount() {
        setTotalNutrient({
            protein: 0,   // in grams (for muscle repair and maintenance)
            fat: 0,       // in grams (for energy and hormonal balance)
            carbohydrates: 0,  // in grams (for energy)
            fiber: 0,     // in grams (for digestive health)
            iron: 0,         // in milligrams (vital for oxygen transport in the blood));
        })
    }

    useEffect(() => {
        // Reset it...
        resetNutrientCount()
        Object.keys(filteredIngredients).forEach(element => {
            let ingredient = filteredIngredients[element]
            let name = ingredient.Name ? ingredient.Name : ingredient.name
            let quantity = ingredient.Amount ? ingredient.Amount : ingredient.quantity_type
            let quantity_type = ingredient.AmountType ? ingredient.AmountType : ingredient.quantity_type
            getNutrientData(name, quantity, quantity_type);
        });



    }, [ingredients]);


    useEffect(() => {

    }, [filteredIngredients]);



    return (
        <div>
            <div>

                <select
                    id="ingredientDropdown"
                    value={selectedIngredient}
                    onChange={handleDropdownChange}
                >
                    <option value="">Select an ingredient to filter graph</option>

                    {Object.keys(ingredientNutrient).map((ingredient, index) => (
                        Object.keys(ingredientNutrient[ingredient]).length > 0  ?
                            (
                                <option key={index} value={ingredient}>
                                    {ingredient}
                                </option>
                                
                            ) : null
                    ))}

                </select>


            </div>

            {Object.keys(dailyNutrientRequirements).map((nutrientKey) => {
                return (
                    <Row className={styles.Row} style={{ "font-size": "1rem" }}>
                        {nutrientKey} : {totalNutrient[nutrientKey].toFixed(2)} / {dailyNutrientRequirements[nutrientKey]}
                    </Row>
                )
            })}

            {Object.keys(ingredientNutrient).map((nutrientKey) => {
                ingredientNutrient[nutrientKey].length > 0 ? <Row className={styles.Row}>
                </Row> : <Row className={styles.Row}>

                </Row>

            })}


            <Bar data={data} options={{ "color": "white" }} />

            {/* {JSON.stringify(ingredientNutrient)} */}


        </div>
    );
}

export default IngredientNutrientGraph;
