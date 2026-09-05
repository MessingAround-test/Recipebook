import Head from 'next/head'
import styles from '../../styles/Home.module.css'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import Router from 'next/router'
import ImageCard from '../../components/ImageCard'
import { useAuthGuard } from '../../lib/useAuthGuard'
import { CheckCircle, History } from 'lucide-react'

export default function Home() {
    useAuthGuard()
    const [userData, setUserData] = useState<any>({})
    const [recipes, setRecipes] = useState<any[]>([])
    const [completedRecipes, setCompletedRecipes] = useState<any[]>([])
    const [allowDelete, setAllowDelete] = useState(false)
    const [showCompleted, setShowCompleted] = useState(false)
    const [loadingCompleted, setLoadingCompleted] = useState(false)

    async function getUserDetails() {
        let res = await fetch("/api/UserDetails", {
            headers: {
                'edgetoken': localStorage.getItem('Token') || ''
            }
        })
        let data = await res.json()
        setUserData(data.res)
    }

    async function getRecipeDetails() {
        let res = await fetch("/api/ShoppingList", {
            headers: {
                'edgetoken': localStorage.getItem('Token') || ''
            }
        })
        let data = await res.json()
        let localRecipes = data.res || []
        localRecipes = localRecipes.filter((recipe: any) => (
            recipe.complete === false
        ))
        setRecipes(localRecipes)
    }

    async function getCompletedRecipeDetails() {
        setLoadingCompleted(true)
        let res = await fetch("/api/ShoppingList?complete=true", {
            headers: {
                'edgetoken': localStorage.getItem('Token') || ''
            }
        })
        let data = await res.json()
        setCompletedRecipes(data.res || [])
        setLoadingCompleted(false)
    }

    const toggleShowCompleted = async () => {
        const newShowCompleted = !showCompleted
        setShowCompleted(newShowCompleted)
        if (newShowCompleted && completedRecipes.length === 0) {
            await getCompletedRecipeDetails()
        }
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
        let res = await fetch("/api/ShoppingList/" + String(id), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': localStorage.getItem('Token') || ''
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
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button onClick={() => redirect("/shoppingList/create/")} className="flex-1 sm:flex-none">
                        + Create New List
                    </Button>
                    <Button
                        variant={showCompleted ? "default" : "outline"}
                        onClick={toggleShowCompleted}
                        disabled={loadingCompleted}
                        className="flex-1 sm:flex-none text-xs sm:text-sm"
                    >
                        {loadingCompleted ? (
                            "Loading..."
                        ) : showCompleted ? (
                            <>
                                <CheckCircle size={14} className="mr-1" />
                                Hide Completed
                            </>
                        ) : (
                            <>
                                <History size={14} className="mr-1" />
                                Show Completed
                            </>
                        )}
                    </Button>
                    {userData?.role === "admin" && (
                        <Button variant="destructive" onClick={toggleMassDelete} className="flex-1 sm:flex-none text-xs sm:text-sm">
                            Allow Mass Delete
                        </Button>
                    )}
                </div>
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
                {showCompleted && completedRecipes.map((recipe) => (
                    <div key={recipe._id} className="bg-green-100/50 opacity-80">
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
            {recipes.length === 0 && !showCompleted && (
                <div className="text-center text-muted-foreground mt-8">
                    No active shopping lists found.
                </div>
            )}
            {showCompleted && completedRecipes.length === 0 && !loadingCompleted && (
                <div className="text-center text-muted-foreground mt-8">
                    No completed shopping lists found.
                </div>
            )}
        </Layout>
    )
}
