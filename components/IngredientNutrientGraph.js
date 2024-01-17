import React, { useState, useEffect, useRef } from 'react';
import { Col, Row } from 'react-bootstrap';
import styles from '../styles/Home.module.css'
import 'chart.js/auto';
import { Doughnut, Line, Radar, Bar } from 'react-chartjs-2';

function IngredientNutrientGraph({ ingredients }) {
    const chartRef = useRef(null);
    const [ingredientNutrient, setIngredientNutrient] = useState({});
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

                let nutrientInfo = data.data[0].nutrition_info
                let protein = parseFloat(nutrientInfo["Protein (g)"])
                let fat = parseFloat(nutrientInfo["Fat, total (g)"])
                let carbohydrates = parseFloat(nutrientInfo["Available carbohydrate, with sugar alcohols (g)"])
                let fiber = parseFloat(nutrientInfo["Total dietary fibre (g)"])
                let iron = parseFloat(nutrientInfo["Iron (Fe) (mg)"])
                // these are amount / 100 becuase the API returns in 100 g always
                setTotalNutrient(prevState => ({
                    ...prevState,
                    "protein": prevState.protein + protein,
                    fat: prevState.fat + fat,
                    carbohydrates: prevState.carbohydrates + carbohydrates,
                    fiber: prevState.fiber + fiber,
                    iron: prevState.iron + iron,
                }))
            } else {
                setIngredientNutrient(prevState => ({
                    ...prevState,
                    [ingredientName]: data.data,
                }));
            }

        } catch (error) {
            console.error(`Error fetching nutrient data for ${ingredientName}: ${error.message}`);
        }
    }

    useEffect(() => {
        // Reset it...
        setTotalNutrient({
            protein: 0,   // in grams (for muscle repair and maintenance)
            fat: 0,       // in grams (for energy and hormonal balance)
            carbohydrates: 0,  // in grams (for energy)
            fiber: 0,     // in grams (for digestive health)
            iron: 0,         // in milligrams (vital for oxygen transport in the blood));
        })
        Object.keys(ingredients).forEach(element => {
            console.log(ingredients[element])
            getNutrientData(ingredients[element].Name, ingredients[element].Amount, ingredients[element].AmountType);
        });



    }, [ingredients]);



    return (
        <div>

            {Object.keys(dailyNutrientRequirements).map((nutrientKey) => {
                return (
                    <Row className={styles.Row}>
                        {nutrientKey} : {totalNutrient[nutrientKey].toFixed(2)} / {dailyNutrientRequirements[nutrientKey]}
                    </Row>
                )
            })}

            {Object.keys(ingredientNutrient).map((nutrientKey) => {
                ingredientNutrient[nutrientKey].length > 0 ? <Row className={styles.Row}>
                </Row> : <Row className={styles.Row}>

                </Row>

            })}


            <Bar data={data} />

            {/* {JSON.stringify(ingredientNutrient)} */}


        </div>
    );
}

export default IngredientNutrientGraph;
