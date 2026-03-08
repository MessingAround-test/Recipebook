import Head from 'next/head'
import styles from '../../styles/Home.module.css'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import Router from 'next/router'
import ImageCard from '../../components/ImageCard'
import { useAuthGuard } from '../../lib/useAuthGuard'

export default function Home() {
    useAuthGuard()
    const [userData, setUserData] = useState<any>({})
    const [recipes, setRecipes] = useState<any[]>([])
    const [allowDelete, setAllowDelete] = useState(false)

    async function getUserDetails() {
        let res = await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))
        let data = await res.json()
        setUserData(data.res)
    }

    async function getRecipeDetails() {
        let res = await fetch("/api/ShoppingList?EDGEtoken=" + localStorage.getItem('Token'))
        let data = await res.json()
        let localRecipes = data.res || []
        localRecipes = localRecipes.filter((recipe: any) => (
            recipe.complete === false
        ))
        setRecipes(localRecipes)
    }

    useEffect(() => {
        if (localStorage.getItem('Token')) {
            getUserDetails()
            getRecipeDetails()
        }
    }, [])

    const redirect = async function (page: string) {
        Router.push(page)
    }

    const deleteRecipe = async function (id: string) {
        let res = await fetch("/api/ShoppingList/" + String(id) + "?EDGEtoken=" + localStorage.getItem('Token'), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })
        let data = await res.json()
        if (data.success === false || data.success === undefined) {
            if (data.message !== undefined) {
                alert(data.message)
            } else {
                alert("failed, unexpected error")
            }
        } else {
            let localRecipes = recipes.filter(function (obj) {
                return obj._id !== id
            });
            setRecipes(localRecipes)
        }
    }

    const toggleMassDelete = async function () {
        setAllowDelete(!allowDelete)
    }

    return (
        <Layout title="Shopping Lists">
            <PageHeader title="Shopping Lists">
                <Button onClick={() => redirect("/shoppingList/create/")}>
                    + Create New List
                </Button>
                {userData.role === "admin" && (
                    <Button variant="destructive" onClick={toggleMassDelete}>
                        Allow Mass Delete
                    </Button>
                )}
            </PageHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
                {recipes.map((recipe) => (
                    <div key={recipe._id} className={recipe.complete ? "bg-green-100" : ""}>
                        <ImageCard
                            recipe={recipe}
                            allowDelete={allowDelete}
                            onDelete={deleteRecipe}
                            onRedirect={redirect}
                            cardHeight={'5rem'}
                        />
                    </div>
                ))}
            </div>
            {recipes.length === 0 && (
                <div className="text-center text-muted-foreground mt-8">
                    No active shopping lists found.
                </div>
            )}
        </Layout>
    )
}
