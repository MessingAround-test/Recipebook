import Head from 'next/head'
import styles from '../../styles/Home.module.css'
import { Layout } from '../../components/Layout'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import Router from 'next/router'
import ImageCard from '../../components/ImageCard'
import { useFeatureGuard } from '../../lib/useFeatureGuard'
import { History, Search, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
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
    const [searchTerm, setSearchTerm] = useState('')

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

    const matchesSearch = (recipe: any) => {
        const q = searchTerm.trim().toLowerCase()
        return !q || (recipe.name || '').toLowerCase().includes(q)
    }

    const activeLists = recipes.filter(matchesSearch)
    const completedLists = completedRecipes.filter(matchesSearch)

    return (
        <Layout title="Shopping Lists">
            <div className={`pb-24 md:pb-8 ${pageShell.shell}`}>
            {/* Header — same anatomy as /recipes: cursive title + icon chip,
                controls in a search row below */}
            <header className="flex flex-col gap-2.5 md:mt-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-water/15 text-water">
                            <ShoppingCart size={18} />
                        </span>
                        <div className="min-w-0">
                            <h1 className="font-cursive truncate text-2xl leading-tight text-foreground md:text-3xl">Shopping Lists</h1>
                            {!loadingShopping && (
                                <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                    {activeLists.length} active list{activeLists.length === 1 ? '' : 's'}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            onClick={() => redirect("/shoppingList/create/")}
                            className="hidden md:inline-flex bg-water text-primary-foreground hover:bg-water/85"
                        >
                            + Create New List
                        </Button>
                        {userData?.role === "admin" && (
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleMassDelete}
                                    className={allowDelete ? "text-primary-foreground bg-water" : "text-muted-foreground"}
                                >
                                    {allowDelete ? "Done" : "Bulk Actions"}
                                </Button>
                            </div>
                        )}
                        <Button
                            size="icon"
                            variant="secondary"
                            onClick={toggleShowCompleted}
                            disabled={loadingCompleted}
                            className="h-10 w-10 rounded-xl shrink-0 bg-foreground/[0.06] hover:bg-water/15 hover:text-water transition-colors"
                            title={showCompleted ? "Hide completed lists" : "Show completed lists"}
                        >
                            {showCompleted ? <X size={18} /> : <History size={18} />}
                        </Button>
                    </div>
                </div>

                {/* Search Row */}
                {!loadingShopping && (
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-water" size={18} />
                            <input
                                type="text"
                                placeholder="Search lists..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-10 rounded-xl bg-foreground/[0.05] pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-water/50"
                            />
                        </div>
                    </div>
                )}

                {/* Active bulk-delete notice bar */}
                {allowDelete && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-berry/10 px-3 py-2">
                        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-berry">
                            <Trash2 size={12} /> Mass delete on — tap 🗑️ to remove lists
                        </span>
                        <button onClick={toggleMassDelete} className="text-[10px] font-bold uppercase tracking-widest text-berry hover:opacity-70">
                            Turn off
                        </button>
                    </div>
                )}
            </header>

            {loadingShopping ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mt-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-foreground/[0.05] rounded-2xl" style={{ height: '8rem', animationDelay: `${i * 50}ms` }} />
                    ))}
                </div>
            ) : (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mt-2">
                    {activeLists.map((recipe) => (
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
                {activeLists.length === 0 && !showCompleted && (
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
                        {completedLists.length > 0 && (
                            <div className="mt-6 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Completed</div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 opacity-60">
                            {completedLists.map((recipe) => (
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
                        {completedLists.length === 0 && !loadingCompleted && (
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
