import Head from 'next/head'
import styles from '../../styles/Home.module.css'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import Router from 'next/router'
import ImageCard from '../../components/ImageCard'
import { useFeatureGuard } from '../../lib/useFeatureGuard'
import { CheckCircle, History, Plus, ShoppingCart } from 'lucide-react'
import pageShell from '../../styles/PageShell.module.css'

export default function Home() {
    useFeatureGuard('shoppingList')
    const [userData, setUserData] = useState<any>({})
    const [recipes, setRecipes] = useState<any[]>([])
    const [completedRecipes, setCompletedRecipes] = useState<any[]>([])
    const [allowDelete, setAllowDelete] = useState(false)
    const [showCompleted, setShowCompleted] = useState(false)
    const [loadingCompleted, setLoadingCompleted] = useState(false)
    const [loadingShopping, setLoadingShopping] = useState(true)

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
        setLoadingShopping(false)
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
            <div className={`pb-24 md:pb-8 ${pageShell.shell}`}>
            <PageHeader
                title="Shopping Lists"
                icon={<ShoppingCart size={18} />}
                accent="water"
                subtitle={!loadingShopping ? `${recipes.length} active list${recipes.length === 1 ? '' : 's'}` : undefined}
            >
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button onClick={() => redirect("/shoppingList/create/")} className="flex-1 sm:flex-none bg-water text-primary-foreground hover:bg-water/85">
                        + Create New List
                    </Button>
                    <Button
                        variant={showCompleted ? "default" : "outline"}
                        onClick={toggleShowCompleted}
                        disabled={loadingCompleted}
                        className={`flex-1 sm:flex-none text-xs sm:text-sm rounded-xl ${showCompleted ? "bg-water text-primary-foreground hover:bg-water/85" : ""}`}
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
                        <Button variant="destructive" onClick={toggleMassDelete} className="flex-1 sm:flex-none text-xs sm:text-sm rounded-xl bg-berry/10 text-berry hover:bg-berry/20">
                            Allow Mass Delete
                        </Button>
                    )}
                </div>
            </PageHeader>

            {loadingShopping ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mt-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-foreground/[0.05] rounded-2xl" style={{ height: '8rem', animationDelay: `${i * 50}ms` }} />
                    ))}
                </div>
            ) : (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mt-2">
                    {recipes.map((recipe) => (
                        <div key={recipe._id}>
                            <ImageCard
                                recipe={recipe}
                                allowDelete={allowDelete}
                                onDelete={deleteRecipe}
                                onRedirect={redirect}
                                cardHeight={'6rem'}
                                hidePlaceholderName
                            />
                        </div>
                    ))}
                </div>
                {recipes.length === 0 && !showCompleted && (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6 border border-dashed border-border rounded-3xl bg-muted/40">
                        <div className="w-16 h-16 bg-water/10 rounded-full flex items-center justify-center mb-4 text-3xl">
                            🛒
                        </div>
                        <h2 className="text-lg font-bold mb-1.5">No active shopping lists</h2>
                        <p className="text-sm text-muted-foreground max-w-[300px] mb-5">
                            Start a fresh list and it shows up here while you shop.
                        </p>
                        <Button onClick={() => redirect("/shoppingList/create/")} className="rounded-xl bg-water text-primary-foreground hover:bg-water/85">
                            + Create a list
                        </Button>
                    </div>
                )}
                {showCompleted && (
                    <>
                        {completedRecipes.length > 0 && (
                            <div className="mt-6 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Completed</div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 opacity-60">
                            {completedRecipes.map((recipe) => (
                                <div key={recipe._id} className="grayscale-[30%]">
                                    <ImageCard
                                        recipe={recipe}
                                        allowDelete={allowDelete}
                                        onDelete={deleteRecipe}
                                        onRedirect={redirect}
                                        cardHeight={'6rem'}
                                        hidePlaceholderName
                                    />
                                </div>
                            ))}
                        </div>
                        {completedRecipes.length === 0 && !loadingCompleted && (
                            <div className="flex flex-col items-center justify-center py-10 text-center px-6 border border-dashed border-border rounded-3xl bg-muted/40">
                                <div className="w-16 h-16 bg-water/10 rounded-full flex items-center justify-center mb-4 text-3xl">
                                    📝
                                </div>
                                <h2 className="text-lg font-bold mb-1.5">No completed lists yet</h2>
                                <p className="text-sm text-muted-foreground max-w-[300px]">
                                    Finish a shopping run and the list lands here for reference.
                                </p>
                            </div>
                        )}
                    </>
                )}
                </>
            )}

            {/* Mobile Floating Action Button — one-hand reach for a new list */}
            <Button
                onClick={() => redirect("/shoppingList/create/")}
                className="fixed bottom-24 sm:bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl shadow-water/40 bg-water text-primary-foreground hover:scale-110 active:scale-95 transition-all z-50 p-0"
                aria-label="Create new shopping list"
            >
                <Plus size={28} />
            </Button>
            </div>
        </Layout>
    )
}
