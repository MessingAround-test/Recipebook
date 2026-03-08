import React, { useState, useEffect } from 'react';
import IngredientCard from './IngredientCard'

interface Ingredient {
    _id?: string
    name: string
    quantity: string | number
    quantity_type_shorthand?: string
    complete?: boolean
    category?: string
    options?: any[]
    loading?: boolean
}

interface IngredientListCompProps {
    ingredients: Ingredient[]
    handleCheckboxChange?: (ingredient: Ingredient) => void
    reload?: () => void
    availableColumns?: any[]
    handleDeleteItem?: (id: string) => void
    modifyColumnName?: string
    sortFunction?: (ingredients: Ingredient[]) => void
}

export default function IngredientListComp({
    ingredients,
    handleCheckboxChange,
    reload,
    availableColumns,
    handleDeleteItem,
    modifyColumnName,
    sortFunction
}: IngredientListCompProps) {
    const [ingredientData, setIngredientData] = useState<Ingredient[]>(ingredients);
    const [essential, setEssential] = useState(true)

    function sortIngredientsSimple(ingredientList: Ingredient[]) {
        let sortedIngreds = [...ingredientList]
        sortedIngreds.sort((a, b) => {
            if (a.complete && !b.complete) return 1;
            if (!a.complete && b.complete) return -1;

            const sourceA = a.category ? a.category.toLowerCase() : '';
            const sourceB = b.category ? b.category.toLowerCase() : '';

            if (sourceA < sourceB) return -1;
            if (sourceA > sourceB) return 1;

            const searchTermA = a.name ? a.name.toLowerCase() : '';
            const searchTermB = b.name ? b.name.toLowerCase() : '';

            if (searchTermA < searchTermB) return -1;
            if (searchTermA > searchTermB) return 1;

            return 0;
        });
        return sortedIngreds
    }

    function sortIngredients(ingredientList: Ingredient[]) {
        let sortedIngreds = [...ingredientList]
        sortedIngreds.sort((a, b) => {
            if (a.complete && !b.complete) return 1;
            if (!a.complete && b.complete) return -1;

            const sourceA = a.options && a.options.length > 0 ? a.options[0].source.toLowerCase() : '';
            const sourceB = b.options && b.options.length > 0 ? b.options[0].source.toLowerCase() : '';

            if (sourceA < sourceB) return -1;
            if (sourceA > sourceB) return 1;

            const catA = a.category ? a.category.toLowerCase() : '';
            const catB = b.category ? b.category.toLowerCase() : '';

            if (catA < catB) return -1;
            if (catA > catB) return 1;

            const searchTermA = a.name ? a.name.toLowerCase() : '';
            const searchTermB = b.name ? b.name.toLowerCase() : '';

            if (searchTermA < searchTermB) return -1;
            if (searchTermA > searchTermB) return 1;

            return 0;
        });
        return sortedIngreds
    }

    const markAsIncorrect = async function (ingredientId: string, ingredName: string) {
        const token = localStorage.getItem('Token')
        const res = await fetch("/api/Ingredients/?id=" + ingredientId + "&EDGEtoken=" + token, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
        const data = await res.json()
        if (data.success === false || data.success === undefined) {
            alert(data.message || "failed, unexpected error")
        } else {
            if (reload) reload()
        }
    }

    useEffect(() => {
        if (sortFunction === undefined) {
            setIngredientData(sortIngredientsSimple(ingredients));
        } else {
            sortFunction(ingredients)
            setIngredientData([...ingredients])
        }
    }, [ingredients, sortFunction]);

    return (
        <div className="flex flex-col gap-4 w-full">
            {ingredientData.map((ingred, index) => (
                <IngredientCard
                    key={ingred._id || index}
                    ingredient={ingred}
                    essential={essential}
                    openModal={() => { }}
                    handleCheckboxChange={handleCheckboxChange}
                    markAsIncorrect={markAsIncorrect}
                    filters={[]}
                    modalVersion={false}
                />
            ))}
        </div>
    );
}
