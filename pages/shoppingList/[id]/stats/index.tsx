import Head from 'next/head'
import { Layout } from '../../../../components/Layout'
import { PageHeader } from '../../../../components/PageHeader'
import { useEffect, useState } from 'react'
import { Button } from '../../../../components/ui/button'
import Router, { useRouter } from 'next/router'
import IngredientNutrientGraph from '../../../../components/IngredientNutrientGraph'

export default function Home() {
    const router = useRouter()
    const { id } = router.query
    const [list, setlist] = useState<any>({})
    const [listIngreds, setlistIngreds] = useState<any[]>([])
    const [matchedListIngreds, setMatchedListIngreds] = useState<any[]>([])
    const [enabledSuppliers, setEnabledSuppliers] = useState(["WW", "Panetta", "IGA", "Aldi", "Coles"])

    useEffect(() => {
        if (!localStorage.getItem('Token')) {
            Router.push("/login")
        }
        if (id) {
            getRecipeDetails()
        }
    }, [id])

    useEffect(() => {
        if (list._id !== undefined) {
            getShoppingListItems()
        }
    }, [list])

    const reloadAllIngredients = async () => {
        let updatedListIngreds = listIngreds.map((ingred) => ({
            ...ingred,
            options: [],
            loading: true,
        }));
        setMatchedListIngreds(updatedListIngreds);

        for (let i = 0; i < updatedListIngreds.length; i++) {
            try {
                const updatedIngredient = await getGroceryStoreProducts(updatedListIngreds[i]);
                updatedListIngreds[i] = {
                    ...updatedIngredient,
                    loading: false,
                };
                setMatchedListIngreds([...updatedListIngreds]);
            } catch (error: any) {
                console.error(`Error updating ingredient: ${error.message}`);
            }
        }
    };

    useEffect(() => {
        if (listIngreds.length > 0) {
            reloadAllIngredients()
        }
    }, [listIngreds])

    async function getGroceryStoreProducts(ingredient: any) {
        let res = await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=1&supplier=${enabledSuppliers.join(',')}&EDGEtoken=${localStorage.getItem('Token')}`)
        let data = await res.json()
        if (data.loadedSource) {
            let resLoaded = await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=1&supplier=${enabledSuppliers.join(',')}&EDGEtoken=${localStorage.getItem('Token')}`)
            data = await resLoaded.json()
        }

        let updatedIngredient = ingredient
        updatedIngredient.options = []
        if (data.success === true && data.res.length > 0) {
            updatedIngredient.options = data.res
        }
        return updatedIngredient
    }

    async function getShoppingListItems() {
        let res = await fetch(`/api/ShoppingListItem/?shoppingListId=${id}&EDGEtoken=${localStorage.getItem('Token')}`)
        let data = await res.json()
        setlistIngreds(data.res || [])
    }

    async function getRecipeDetails() {
        let res = await fetch("/api/ShoppingList/" + String(id) + "?EDGEtoken=" + localStorage.getItem('Token'))
        let data = await res.json()
        setlist(data.res || {})
    }

    useEffect(() => {
        if (listIngreds.length > 0) {
            reloadAllIngredients();
        }
    }, [enabledSuppliers]);

    function convertIngredientToOldFormat(ingredientList: any[]) {
        return ingredientList.map((ingred) => ({
            ...ingred,
            "Name": ingred.name,
            "Amount": ingred.quantity,
            "AmountType": ingred.quantity_type
        }))
    }

    return (
        <Layout title="Shopping List Stats">
            <div className="max-w-4xl mx-auto mt-8">
                <PageHeader title="List Nutrients" />
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-8 shadow-xl mt-6">
                    <IngredientNutrientGraph ingredients={convertIngredientToOldFormat(listIngreds)} />
                </div>
            </div>
        </Layout>
    )
}
