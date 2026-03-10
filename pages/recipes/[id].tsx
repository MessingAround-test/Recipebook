import Head from 'next/head'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import Router, { useRouter } from 'next/router'
import IngredientNutrientGraph from '../../components/IngredientNutrientGraph'
import IngredientCard from '../../components/IngredientCard'
import { IngredientSearchList } from '../../components/IngredientSearchList'
import Modal from 'react-modal'

export default function Home() {
    const router = useRouter()
    const { id } = router.query

    const [recipe, setRecipe] = useState<any>(undefined)
    const [listIngreds, setlistIngreds] = useState<any[]>([])
    const [matchedListIngreds, setMatchedListIngreds] = useState<any[]>([])
    const [instructions, setInstructions] = useState<any[]>([])
    const [imageData, setImageData] = useState<string>("")
    const [recipeName, setRecipeName] = useState("")
    const [modalIsOpen, setIsOpen] = useState(false)
    const [selectedIngred, setSelectedIngred] = useState("")
    const [filters, setFilters] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    async function openModal(ingredName: string) {
        setIsOpen(true)
        setSelectedIngred(ingredName)
    }

    async function closeModal() {
        setIsOpen(false)
    }

    const reloadAllIngredients = async () => {
        let updatedListIngreds = listIngreds.map((ingred) => ({
            ...ingred,
            options: [],
            loading: true,
        }))
        setMatchedListIngreds(updatedListIngreds)

        for (let i = 0; i < updatedListIngreds.length; i++) {
            if (updatedListIngreds[i].complete === true) {
                updatedListIngreds[i].loading = false
                continue
            }
            try {
                const updatedIngredient = await getGroceryStoreProducts(updatedListIngreds[i], 1, [], localStorage.getItem('Token') || '')
                updatedListIngreds[i] = {
                    ...updatedIngredient,
                    loading: false,
                }
                setMatchedListIngreds([...updatedListIngreds])
            } catch (error: any) {
                console.error(`Error updating ingredient: ${error.message}`)
            }
        }
    }

    async function getGroceryStoreProducts(ingredient: any, returnN: number, enabledSuppliers: string[], token: string) {
        let res = await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=${returnN}&supplier=${enabledSuppliers.join(',')}`, {
            headers: { 'edgetoken': token }
        })
        let data = await res.json()
        if (data.loadedSource) {
            let resLoaded = await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=${returnN}&supplier=${enabledSuppliers.join(',')}`, {
                headers: { 'edgetoken': token }
            })
            data = await resLoaded.json()
        }

        let updatedIngredient = ingredient
        updatedIngredient.options = []
        if (data.success === true && data.res.length > 0) {
            updatedIngredient.options = data.res
        }
        return updatedIngredient
    }

    const deleteRecipe = async function () {
        let res = await fetch("/api/Recipe/" + String(router.query.id), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': localStorage.getItem('Token') || ""
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
        if (!id) return
        let res = await fetch("/api/Recipe/" + String(id), {
            headers: { 'edgetoken': localStorage.getItem('Token') || "" }
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

    const compressImage = async (base64String: string | ArrayBuffer | null): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (typeof base64String !== 'string') return reject("Invalid input");
            const img = new window.Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const maxResolution = 800
                let width = img.width
                let height = img.height

                if (width > maxResolution || height > maxResolution) {
                    const aspectRatio = width / height
                    if (width > height) {
                        width = maxResolution
                        height = width / aspectRatio
                    } else {
                        height = maxResolution
                        width = height * aspectRatio
                    }
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (ctx) ctx.drawImage(img, 0, 0, width, height)
                resolve(canvas.toDataURL('image/jpeg'))
            }
            img.onerror = reject
            img.src = base64String
        })
    }

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            try {
                const reader = new FileReader()
                reader.readAsDataURL(file)
                reader.onload = async () => {
                    let base64String = reader.result
                    if (file.size > 1024 * 1024) {
                        base64String = await compressImage(reader.result)
                    }

                    try {
                        const response = await fetch(`/api/Recipe/${encodeURIComponent(String(id))}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'edgetoken': localStorage.getItem('Token') || ""
                            },
                            body: JSON.stringify({ image: base64String }),
                        })

                        if (response.ok) {
                            window.location.reload()
                        } else {
                            console.error('Failed to update the image')
                        }
                    } catch (error) {
                        console.error('Error updating image:', error)
                    }
                }
            } catch (error) {
                console.error('Error converting file to Base64:', error)
            }
        }
    }

    useEffect(() => {
        if (listIngreds && listIngreds.length > 0) {
            reloadAllIngredients()
        }
    }, [listIngreds])

    useEffect(() => {
        if (!localStorage.getItem('Token')) {
            Router.push("/login")
        }
        if (router.isReady) {
            getRecipeDetails()
        }
    }, [router.isReady])

    const handleClick = () => {
        document.querySelector<HTMLInputElement>('input[type="file"]')?.click()
    }

    if (recipe === undefined) {
        return (
            <Layout title="Recipes">
                <div className="flex h-[50vh] items-center justify-center">
                    <p className="text-muted-foreground text-xl">Loading recipe {id}...</p>
                </div>
            </Layout>
        )
    }

    return (
        <Layout title={recipeName || "Recipe"}>
            <div className="max-w-6xl mx-auto mt-6 pb-12">
                <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-sm p-8 mb-8">
                    <h1 className="text-4xl font-bold mb-8 pb-4 border-b border-border">{recipeName}</h1>

                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Ingredients</h2>
                        <label className="flex items-center gap-3 cursor-pointer text-sm font-semibold">
                            <input
                                type="checkbox"
                                checked={filters.includes("supplier")}
                                onChange={() => filters.includes("supplier") ? setFilters([]) : setFilters(["supplier"])}
                                className="w-5 h-5 rounded border-input text-primary focus:ring-primary"
                            />
                            Show Grocery Products
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                        {loading && (
                            <div className="col-span-full flex justify-center py-8">
                                <object type="image/svg+xml" data="/loading.svg" className="w-12 h-12">loading...</object>
                            </div>
                        )}
                        {matchedListIngreds.map((ingred, idx) => (
                            <IngredientCard key={idx} ingredient={ingred} filters={filters} openModal={openModal} />
                        ))}
                    </div>

                    <div className="bg-muted/30 rounded-lg p-6 mb-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Total Approximate Cost</p>
                            <h3 className="text-3xl font-bold">${getAproxTotalRecipeCost()}</h3>
                        </div>
                        <div className="h-12 w-px bg-border hidden md:block"></div>
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Estimated Unit Usage Cost</p>
                            <h3 className="text-3xl font-bold text-primary">${getAproxTotalRecipeCostUnit()}</h3>
                        </div>
                        <div className="ml-auto">
                            <Button onClick={() => reloadAllIngredients()} variant="outline">Refresh Grocery Data</Button>
                        </div>
                    </div>

                    {instructions.length > 0 && (
                        <div className="mb-12">
                            <h2 className="text-2xl font-bold mb-6">Instructions</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {instructions.map((instruction, index) => (
                                    <div key={index} className="bg-muted/10 rounded-xl p-6 border border-border/50">
                                        <div className="text-primary font-bold mb-3 uppercase tracking-wider text-sm">Step {index + 1}</div>
                                        <p className="text-foreground/90 leading-relaxed text-sm">{instruction.Text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-6">Nutrients</h2>
                        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                            <IngredientNutrientGraph ingredients={matchedListIngreds} />
                        </div>
                    </div>

                    {imageData && (
                        <div className="mb-12">
                            <h2 className="text-2xl font-bold mb-6">Recipe Image</h2>
                            <div className="group relative rounded-xl overflow-hidden border border-border shadow-md max-w-2xl cursor-pointer" onClick={handleClick}>
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                    <span className="text-white font-semibold">Change Image</span>
                                </div>
                                <img src={imageData} alt={recipeName} className="w-full h-auto object-cover" />
                            </div>
                        </div>
                    )}

                    <input
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept="image/*"
                    />

                    <div className="flex justify-between items-center mt-12 pt-8 border-t border-border">
                        <span className="text-xs text-muted-foreground font-mono">ID: {id}</span>
                        <Button variant="destructive" onClick={deleteRecipe}>
                            Delete Recipe
                        </Button>
                    </div>

                </div>

                <Modal
                    isOpen={modalIsOpen}
                    onRequestClose={closeModal}
                    style={{
                        content: {
                            backgroundColor: 'var(--background)',
                            borderColor: 'var(--border)',
                            color: 'var(--foreground)',
                            maxWidth: '1000px',
                            margin: '0 auto',
                            padding: '2rem',
                            borderRadius: '0.75rem'
                        },
                        overlay: {
                            backgroundColor: 'rgba(0, 0, 0, 0.75)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 50
                        }
                    }}
                    contentLabel="Ingredient Research Modal"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Ingredient Research</h2>
                        <button
                            onClick={closeModal}
                            className="bg-muted hover:bg-muted/80 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                        >
                            <img src="/cross.png" className="w-4 h-4 invert-[.25] dark:invert" alt="close" />
                        </button>
                    </div>
                    <IngredientSearchList search_term={selectedIngred} />
                </Modal>
            </div>
        </Layout>
    )
}
