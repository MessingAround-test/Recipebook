import React, { useState, useEffect } from 'react';
import 'chart.js/auto';
import { Bar } from 'react-chartjs-2';

interface NutrientData {
    protein: number;
    fat: number;
    carbohydrates: number;
    fiber: number;
    iron: number;
    [key: string]: number;
}

export default function IngredientNutrientGraph({ ingredients }: { ingredients: any[] }) {
    const [ingredientNutrient, setIngredientNutrient] = useState<Record<string, any>>({});
    const [selectedIngredient, setSelectedIngredient] = useState('');

    let filteredIngredients = selectedIngredient
        ? ingredients.filter(ingredient => (ingredient.Name || ingredient.name) === selectedIngredient)
        : ingredients;

    const [totalNutrient, setTotalNutrient] = useState<NutrientData>({
        protein: 0,
        fat: 0,
        carbohydrates: 0,
        fiber: 0,
        iron: 0,
    });

    const dailyNutrientRequirements: Record<string, number> = {
        protein: 80,
        fat: 90,
        carbohydrates: 200,
        fiber: 30,
        iron: 18,
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

    const handleDropdownChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedIngredient(event.target.value);
    };

    async function getNutrientData(ingredientName: string, amount: string | number, qType: string) {
        if (!ingredientName) return;
        try {
            const token = localStorage.getItem('Token');
            if (!token) return;

            const res = await fetch(`/api/Nutrition?search_term=${ingredientName}&quantity=${amount}&qType=${qType}&EDGEtoken=${token}`);
            const data = await res.json();

            if (data.data && data.data.length > 0) {
                setIngredientNutrient(prevState => ({
                    ...prevState,
                    [ingredientName]: data.data[0],
                }));

                const nutrientInfo = data.data[0].nutrition_info;
                setTotalNutrient(prevState => ({
                    ...prevState,
                    protein: prevState.protein + (parseFloat(nutrientInfo.protein) || 0),
                    fat: prevState.fat + (parseFloat(nutrientInfo.fat) || 0),
                    carbohydrates: prevState.carbohydrates + (parseFloat(nutrientInfo.carbohydrates) || 0),
                    fiber: prevState.fiber + (parseFloat(nutrientInfo.fiber) || 0),
                    iron: prevState.iron + (parseFloat(nutrientInfo.iron) || 0),
                }));
            } else {
                setIngredientNutrient(prevState => ({
                    ...prevState,
                    [ingredientName]: {},
                }));
            }
        } catch (error: any) {
            console.error(`Error fetching nutrient data for ${ingredientName}: ${error.message}`);
        }
    }

    function resetNutrientCount() {
        setTotalNutrient({
            protein: 0,
            fat: 0,
            carbohydrates: 0,
            fiber: 0,
            iron: 0,
        });
    }

    useEffect(() => {
        resetNutrientCount();
        filteredIngredients.forEach(ingredient => {
            const name = ingredient.Name || ingredient.name;
            const quantity = ingredient.Amount || ingredient.quantity;
            const quantity_type = ingredient.AmountType || ingredient.quantity_type;
            getNutrientData(name, quantity, quantity_type);
        });
    }, [ingredients, selectedIngredient]);

    return (
        <div className="w-full">
            <div className="mb-6">
                <select
                    id="ingredientDropdown"
                    value={selectedIngredient}
                    onChange={handleDropdownChange}
                    className="flex h-10 w-full md:w-1/2 items-center justify-between rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                    <option className="text-black" value="">All ingredients combined</option>
                    {Object.keys(ingredientNutrient).map((ingredient, index) => (
                        Object.keys(ingredientNutrient[ingredient] || {}).length > 0 ? (
                            <option className="text-black" key={index} value={ingredient}>
                                {ingredient}
                            </option>
                        ) : null
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                {Object.keys(dailyNutrientRequirements).map((nutrientKey) => (
                    <div key={nutrientKey} className="bg-muted/30 rounded-lg p-4 border border-border">
                        <div className="text-sm font-medium text-muted-foreground capitalize mb-1">{nutrientKey}</div>
                        <div className="text-xl font-bold">
                            {totalNutrient[nutrientKey].toFixed(2)}
                            <span className="text-sm font-normal text-muted-foreground ml-1">
                                / {dailyNutrientRequirements[nutrientKey]}g
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <Bar
                    data={data}
                    options={{
                        color: 'gray',
                        responsive: true,
                        plugins: {
                            legend: {
                                labels: { color: 'gray' }
                            }
                        },
                        scales: {
                            x: {
                                ticks: { color: 'gray' },
                                grid: { color: 'rgba(255,255,255,0.1)' }
                            },
                            y: {
                                ticks: { color: 'gray' },
                                grid: { color: 'rgba(255,255,255,0.1)' }
                            }
                        }
                    }}
                />
            </div>
        </div>
    );
}
