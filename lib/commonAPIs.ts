export async function getGroceryStoreProducts(ingredient: any, results = 1, enabledSuppliers: string[], Token: string) {
    let skipConversion = localStorage.getItem('skipConversion') === 'true';

    // Max size settings — read from localStorage, fallback to defaults
    const maxSizeRaw = localStorage.getItem('maxSizeOverrides');
    let maxSizeParams = '';
    if (maxSizeRaw) {
        try {
            const overrides = JSON.parse(maxSizeRaw);
            // Use the ingredient's category or the generic each/weight fallback
            const category = ingredient.category_simple?.toLowerCase() || ingredient.category?.toLowerCase() || '';
            const matchedOverride = overrides[category] || overrides[ingredient.quantity_type] || null;
            if (matchedOverride) {
                maxSizeParams = `&maxSize=${matchedOverride.quantity}&maxSizeUnit=${matchedOverride.unit}`;
            }
        } catch {
            // ignore parse errors
        }
    }

    let data = await (await fetch(
        `/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=${results}&quantity=${ingredient.quantity}&supplier=${enabledSuppliers.join(',')}&skipConversion=${skipConversion}${maxSizeParams}`, {
        headers: { 'edgetoken': Token }
    })).json()

    let updatedIngredient = ingredient
    updatedIngredient.options = []
    if (data.success === true && data.res.length > 0) {
        updatedIngredient.options = data.res
        updatedIngredient.supplier = data.res.length > 0 ? data.res[0].source : ""
        updatedIngredient.price_category = determinePriceCategory(data.res[0].price)
    } else {
        updatedIngredient.supplier = ""
        updatedIngredient.price_category = ""
    }
    return updatedIngredient
}

export async function handleDeleteIngredient(id: string, Token: string) {
    try {
        const response = await fetch(`/api/Ingredients?id=${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': Token
            }
        });

        if (response.ok) {
            return id
        } else {
            let error = await response.json()
            console.log(error)
            alert(error.message)
            return
        }
    } catch (error) {
        alert(error)
        return
    }
};

function determinePriceCategory(price: number | undefined) {
    if (price === undefined) {
        return ""
    }
    if (price < 5) return "Cheap"
    if (price < 10) return "Reasonable"
    return "Expensive"
}

export async function getRecipeDetails(recipe_id: string | number) {
    let data = await (await fetch("/api/Recipe/" + String(recipe_id), {
        headers: { 'edgetoken': localStorage.getItem('Token') || "" }
    })).json()
    return (data.res)
}

export async function getShoppingListItems(list_id: string | number) {
    let data = await (await fetch("/api/ShoppingList/" + String(list_id), {
        headers: { 'edgetoken': localStorage.getItem('Token') || "" }
    })).json()
    return (data.res)
}

export async function filterValidEntries(filteredDataArray: any[], search_term: string, EDGEtoken: string) {
    const allNames = filteredDataArray.map((entry) => entry.name);
    try {
        let response = await fetch(`http://localhost:8080/api/ai/determine_bad_entries?search_term=${search_term}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': EDGEtoken
            },
            body: JSON.stringify({ returned_terms: allNames })
        });
        let responseParsed = await response.json();
        if (responseParsed.success !== true) {
            console.error("API returned fail:", responseParsed);
            return filteredDataArray;
        }

        let data = responseParsed.data
        if (data && Array.isArray(data)) {
            const validEntries = filteredDataArray.filter((entry) => data.includes(entry.name));
            return validEntries;
        } else {
            console.error("Unexpected response format from AI API:", data);
            return filteredDataArray;
        }
    } catch (error) {
        console.error("Error fetching AI response:", error);
        return filteredDataArray;
    }
}
