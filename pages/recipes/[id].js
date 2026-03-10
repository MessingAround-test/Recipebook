import Head from 'next/head'
import styles from '../../styles/Home.module.css'
import Image from 'next/image'
import { Toolbar } from '../Toolbar'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import Router, { useRouter } from 'next/router'
import { IngredientSearchList } from '../../components/IngredientSearchList'
import Modal from 'react-modal';
import IngredientNutrientGraph from '../../components/IngredientNutrientGraph'
import IngredientCard from '../../components/IngredientCard'

export default function Home() {
    const [userData, setUserData] = useState({})
    const [recipe, setRecipe] = useState({})
    const router = useRouter()
    const { id } = router.query

    const [listIngreds, setlistIngreds] = useState([])
    const [matchedListIngreds, setMatchedListIngreds] = useState([])
    const [instructions, setInstructions] = useState([])
    const [imageData, setImageData] = useState()
    const [recipeName, setRecipeName] = useState("")
    const [modalIsOpen, setIsOpen] = useState(false);
    const [selectedIngred, setSelectedIngred] = useState("")
    const [filters, setFilters] = useState([])
    const [loading, setLoading] = useState(false)

    async function openModal(ingredName) {
        setIsOpen(true);
        setSelectedIngred(ingredName)
    }

    async function closeModal() {
        setIsOpen(false);
    }

    async function getUserDetails() {
        let res = await fetch("/api/UserDetails", {
            headers: { 'edgetoken': localStorage.getItem('Token') || '' }
        })
        let data = await res.json()
        setUserData(data.res)
    }

    const reloadAllIngredients = async () => {
        let updatedListIngreds = listIngreds.map((ingred) => ({
            ...ingred,
            options: [],
            loading: true,
        }));
        setMatchedListIngreds(updatedListIngreds);

        for (let i = 0; i < updatedListIngreds.length; i++) {
            try {
                if (updatedListIngreds[i].complete === true) {
                    updatedListIngreds[i].loading = false
                    continue
                }
                // Placeholder for getGroceryStoreProducts logic
                updatedListIngreds[i].loading = false
                setMatchedListIngreds([...updatedListIngreds]);
            } catch (error) {
                console.error(`Error updating ingredient: ${error.message}`);
            }
        }
    };

    const deleteRecipe = async function () {
        let res = await fetch("/api/Recipe/" + String(router.query.id), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': localStorage.getItem('Token') || ''
            },
            body: JSON.stringify({})
        })
        let data = await res.json()
        if (data.success === false || data.success === undefined) {
            alert(data.message || "failed, unexpected error")
        } else {
            Router.push("/recipes")
        }
    }

    async function getRecipeDetails() {
        if (!router.query.id) return
        let res = await fetch("/api/Recipe/" + String(router.query.id), {
            headers: { 'edgetoken': localStorage.getItem('Token') || '' }
        })
        let data = await res.json()
        setRecipe(data.res)
        setImageData(data.res.image)
        setlistIngreds(data.res.ingredients)
        setInstructions(data.res.instructions)
        setRecipeName(data.res.name)
    }

    const getAproxTotalRecipeCostUnit = () => {
        let total = 0
        for (let ingredient in matchedListIngreds) {
            let current = matchedListIngreds[ingredient].options[0]
            if (current !== undefined) {
                total = total + current.total_price
            }
        }
        return total.toFixed(2)
    }

    const getAproxTotalRecipeCost = () => {
        let total = 0
        for (let ingredient in matchedListIngreds) {
            let current = matchedListIngreds[ingredient].options[0]
            if (current !== undefined) {
                total = total + current.total_price / current.match_efficiency * 100
            }
        }
        return total.toFixed(2)
    }

    useEffect(() => {
        if (listIngreds.length > 0) {
            reloadAllIngredients()
        }
    }, [listIngreds])

    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            Router.push("/login")
        }
        if (router.isReady) {
            getRecipeDetails()
        }
    }, [router.isReady])

    const handleClick = () => {
        document.querySelector('input[type="file"]')?.click();
    };

    if (!recipe || Object.keys(recipe).length === 0) {
        return (
            <div>
                <Toolbar />
                <div className={styles.container}>
                    <Head>
                        <title>Loading Recipe | Recipebook</title>
                        <link rel="icon" href="/avo.ico" />
                    </Head>
                    <main className={styles.main}>
                        <div className="flex h-[50vh] items-center justify-center">
                            <p className="text-xl text-muted-foreground animate-pulse">Loading Recipe {id}...</p>
                        </div>
                    </main>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Toolbar />
            <div className={styles.container}>
                <Head>
                    <title>{`${recipeName || 'Loading...'} | Recipebook`}</title>
                    <link rel="icon" href="/avo.ico" />
                </Head>
                <main className={styles.main}>
                    <div className="max-w-6xl mx-auto w-full px-4 text-black dark:text-white">
                        <h1 className="text-4xl font-bold mb-8 bg-white dark:bg-black p-4 rounded-xl shadow-sm border border-border">{recipeName}</h1>

                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-semibold">Ingredients</h2>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="showGrocery"
                                    checked={filters.includes("supplier")}
                                    onChange={() => filters.includes("supplier") ? setFilters([]) : setFilters(["supplier"])}
                                    className="w-5 h-5 accent-primary"
                                />
                                <label htmlFor="showGrocery" className="text-sm font-medium cursor-pointer">Show Grocery Products</label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                            {loading && (
                                <div className="col-span-full flex justify-center p-8">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                                </div>
                            )}
                            {matchedListIngreds.map((ingred, index) => (
                                <IngredientCard key={index} ingredient={ingred} filters={filters} openModal={openModal} />
                            ))}
                        </div>

                        <div className="bg-muted p-6 rounded-2xl mb-8 flex flex-col md:flex-row gap-8 items-start md:items-center border border-border shadow-sm">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Total Approximate Cost</p>
                                <p className="text-3xl font-bold">${getAproxTotalRecipeCost()}</p>
                            </div>
                            <div className="h-10 w-px bg-border hidden md:block" />
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Actual Usage Cost</p>
                                <p className="text-3xl font-bold text-primary">${getAproxTotalRecipeCostUnit()}</p>
                            </div>
                            <div className="flex-grow" />
                            <Button onClick={() => reloadAllIngredients()}>Refresh Prices</Button>
                        </div>

                        {instructions.length > 0 && (
                            <div className="mb-12">
                                <h2 className="text-2xl font-semibold mb-6">Instructions</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {instructions.map((instruction, index) => (
                                        <div key={index} className="bg-card border border-border p-6 rounded-xl shadow-sm">
                                            <div className="text-primary font-bold mb-2 uppercase text-xs tracking-widest">Step {index + 1}</div>
                                            <p className="text-sm leading-relaxed">{instruction.Text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mb-12">
                            <h2 className="text-2xl font-semibold mb-6">Nutrients</h2>
                            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                                <IngredientNutrientGraph ingredients={matchedListIngreds} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 items-start">
                            <div className="space-y-6">
                                <h2 className="text-2xl font-semibold">Recipe Image</h2>
                                <Card className="overflow-hidden border-border shadow-md transition-all hover:shadow-lg">
                                    <div className="relative group cursor-pointer" onClick={handleClick}>
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium z-10">
                                            Click to Change Image
                                        </div>
                                        <img src={imageData} className="w-full h-auto object-cover max-h-[30rem]" alt={recipeName} />
                                    </div>
                                    <input type="file" className="hidden" accept="image/*" />
                                </Card>
                            </div>

                            <div className="flex flex-col gap-4 self-end">
                                <Button variant="destructive" className="w-full" onClick={() => deleteRecipe()}>
                                    Delete Recipe
                                </Button>
                                <p className="text-xs text-muted-foreground text-center font-mono">ID: {id}</p>
                            </div>
                        </div>

                    </div>
                </main>

                <footer className={styles.footer}>
                    &copy; {new Date().getFullYear()} Recipebook
                </footer>
            </div>

            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                className="fixed inset-4 md:inset-20 bg-background border border-border rounded-2xl shadow-2xl p-8 z-50 overflow-auto outline-none"
                overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Ingredient Research</h2>
                    <Button variant="ghost" size="icon" onClick={closeModal}>
                        <img src="/cross.png" className="w-4 h-4 dark:invert" alt="close" />
                    </Button>
                </div>
                <IngredientSearchList search_term={selectedIngred} />
            </Modal>
        </div>
    )
}
