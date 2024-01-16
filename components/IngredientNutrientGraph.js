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


    async function getNutrientData(ingredientName, amount) {
        if (ingredientName === undefined) {
            return;
        }

        try {
            let data = await (
                await fetch(`/api/Nutrition?search_term=${ingredientName}&EDGEtoken=${localStorage.getItem('Token')}`)
            ).json();

            if (data.data.length > 0) {
                setIngredientNutrient(prevState => ({
                    ...prevState,
                    [ingredientName]: data.data[0],
                }));

                let nutrientInfo = data.data[0].nutrition_info
                // these are amount / 100 becuase the API returns in 100 g always
                setTotalNutrient(prevState => ({
                    ...prevState,
                    "protein": prevState.protein + (amount / 100 * parseFloat(nutrientInfo["Protein (g)"])),
                    fat: prevState.fat + (amount / 100 * parseFloat(nutrientInfo["Fat, total (g)"])),
                    carbohydrates: prevState.carbohydrates + (amount / 100 * parseFloat(nutrientInfo["Available carbohydrate, with sugar alcohols (g)"])),
                    fiber: prevState.fiber + (amount / 100 * parseFloat(nutrientInfo["Total dietary fibre (g)"])),
                    iron: prevState.iron + (amount / 100 * parseFloat(nutrientInfo["Iron (Fe) (mg)"])),
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
            if (ingredients[element].AmountType == "gram" || ingredients[element].AmountType == "g") {
                getNutrientData(ingredients[element].Name, ingredients[element].Amount);
            }

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
