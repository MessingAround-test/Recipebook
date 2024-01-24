export async function getGroceryStoreProducts(ingredient, results = 1, enabledSuppliers, Token) {
    let data = await (await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=${results}&quantity=${ingredient.quantity}&supplier=${enabledSuppliers.join(',')}&EDGEtoken=${Token}`)).json()
    if (data.loadedSource) {
        //     // We extract again if the source was loaded... our response is returning some weird stuff... 
        data = await (await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=${results}&quantity=${ingredient.quantity}&supplier=${enabledSuppliers.join(',')}&EDGEtoken=${Token}`)).json()
    }

    let updatedIngredient = ingredient
    updatedIngredient.options = []
    if (data.success === true && data.res.length > 0) {
        // updatedIngredient = { ...ingredient, ...data.res[0] }
        updatedIngredient.options = data.res

        updatedIngredient.supplier = data.res.length > 0 ? data.res[0].source : ""
        updatedIngredient.price_category = determinePriceCategory(data.res[0].price)

    } else {
        updatedIngredient.supplier = ""
        updatedIngredient.price_category = ""
    }
    return updatedIngredient
}


export async function handleDeleteIngredient(id, Token) {
    // e.preventDefault();

    try {
        const response = await fetch(`/api/Ingredients?id=${id}&EDGEtoken=${Token}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.ok) {

            return id
        } else {
            // console.log()
            let error = await response.json()
            console.log(error)
            alert(error.message)
            return
            // Handle errors, e.g., show an error message
        }
    } catch (error) {
        alert(error)
        return
        // Handle network or other errors
    }
};

function determinePriceCategory(price) {
    if (price === undefined) {
        return ""
    }

    if (price < 5) {
        return "Cheap"
    }
    if (price < 10) {
        return "Reasonable"
    }

    return "Expensive"

}

export async function getRecipeDetails(recipe_id) {
    let data = await (await fetch("/api/Recipe/" + String(recipe_id) + "?EDGEtoken=" + localStorage.getItem('Token'))).json()
    return (data.res)
}


export async function getShoppingListItems(list_id) {
    let data = await (await fetch("/api/ShoppingList/" + String(list_id) + "?EDGEtoken=" + localStorage.getItem('Token'))).json()
    return (data.res)
}