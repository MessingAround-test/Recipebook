import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useEffect, useState, useRef } from 'react'
import { Button } from '../../components/ui/button'
import { Flame, DollarSign, Clock, Utensils, Trash2, ChefHat, Check, ChevronRight, ChevronLeft } from 'lucide-react'
import Router, { useRouter } from 'next/router'
import IngredientNutrientGraph from '../../components/IngredientNutrientGraph'
import IngredientCard from '../../components/IngredientCard'
import { IngredientSearchList } from '../../components/IngredientSearchList'
import Modal from 'react-modal'

const PRICE_THRESHOLDS = { cheap: 15, expensive: 35 }

const timeLabelMap: Record<string, { label: string; icon: string; color: string }> = {
    short: { label: 'Quick', icon: '⚡', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    medium: { label: 'Medium', icon: '⏱️', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    long: { label: 'Slow Cook', icon: '🍲', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' }
}

const priceLabelMap: Record<string, { label: string; color: string }> = {
    cheap: { label: '$ Cheap', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    medium: { label: '$$ Mid-range', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    expensive: { label: '$$$ Pricey', color: 'bg-red-500/15 text-red-400 border-red-500/30' }
}

function getPriceCategory(cost: number): 'cheap' | 'medium' | 'expensive' {
    if (cost < PRICE_THRESHOLDS.cheap) return 'cheap'
    if (cost <= PRICE_THRESHOLDS.expensive) return 'medium'
    return 'expensive'
}

export default function RecipeDetail() {
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
    const [isCookingMode, setIsCookingMode] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)

    // Metadata fields
    const [recipeTime, setRecipeTime] = useState<string>('')
    const [recipeGenre, setRecipeGenre] = useState<string>('')
    const [recipePriceCategory, setRecipePriceCategory] = useState<string>('')
    const [approxCost, setApproxCost] = useState<number | null>(null)
    const [aiFilledFields, setAiFilledFields] = useState<string[]>([])
    const [timesCooked, setTimesCooked] = useState(0)
    const [feedback, setFeedback] = useState("")
    const [isSavingFeedback, setIsSavingFeedback] = useState(false)

    // Add to shopping list modal
    const [shopModalOpen, setShopModalOpen] = useState(false)
    const [shoppingLists, setShoppingLists] = useState<any[]>([])
    const [shopListLoading, setShopListLoading] = useState(false)
    const [addingToList, setAddingToList] = useState(false)
    const [addSuccess, setAddSuccess] = useState<string | null>(null)

    const costSavedRef = useRef(false)

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
        const supplierParam = enabledSuppliers.length > 0 ? `&supplier=${enabledSuppliers.join(',')}` : '';
        let res = await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&quantity=${ingredient.quantity}&returnN=${returnN}${supplierParam}`, {
            headers: { 'edgetoken': token }
        })
        let data = await res.json()
        if (data.loadedSource) {
            let resLoaded = await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&quantity=${ingredient.quantity}&returnN=${returnN}${supplierParam}`, {
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
        setRecipeTime(data.res.time || '')
        setRecipeGenre(data.res.genre || '')
        setRecipePriceCategory(data.res.priceCategory || '')
        setTimesCooked(data.res.timesCooked || 0)
        setFeedback(data.res.feedback || "")
        if (data.res.approxCost != null) setApproxCost(data.res.approxCost)
        costSavedRef.current = false // allow re-save on each page load
    }

    const getAproxTotalRecipeCost = (ingreds?: any[]) => {
        const list = ingreds || matchedListIngreds
        let total = 0
        for (const ingredient of list) {
            const current = ingredient.options?.[0]
            if (current !== undefined && current.total_price !== undefined) {
                total += Number(current.total_price)
            }
        }
        return isNaN(total) ? 0 : parseFloat(total.toFixed(2))
    }

    const getAproxTotalRecipeCostUnit = () => {
        let total = 0
        for (const ingredient of matchedListIngreds) {
            const current = ingredient.options?.[0]
            if (current !== undefined && current.total_price !== undefined) {
                const efficiency = Number(current.match_efficiency) || 100
                total += Number(current.total_price) * (efficiency / 100)
            }
        }
        return isNaN(total) ? "0.00" : total.toFixed(2)
    }

    // Save approxCost + priceCategory after ingredients load
    const saveCostToRecipe = async (ingreds: any[]) => {
        if (costSavedRef.current || !id) return
        const total = getAproxTotalRecipeCost(ingreds)
        if (total === 0) return
        costSavedRef.current = true

        const category = getPriceCategory(total)
        setApproxCost(total)
        setRecipePriceCategory(category)

        const token = localStorage.getItem('Token') || ""
        await fetch(`/api/Recipe/${String(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'edgetoken': token },
            body: JSON.stringify({ approxCost: total, priceCategory: category })
        })
    }

    // AI auto-fill missing time/genre
    const autoFillMetadata = async (name: string, ingreds: any[]) => {
        if (!id) return
        const missingTime = !recipeTime
        const missingGenre = !recipeGenre
        if (!missingTime && !missingGenre) return

        try {
            const token = localStorage.getItem('Token') || ""
            const ingredNames = ingreds.map(i => i.name).join(', ')
            const res = await fetch(`/api/ai/auto_fill_recipe?recipeName=${encodeURIComponent(name)}&ingredients=${encodeURIComponent(ingredNames)}`, {
                headers: { 'edgetoken': token }
            })
            const data = await res.json()
            if (!data.success || !data.data) return

            const updates: any = {}
            const filled: string[] = []

            if (missingTime && data.data.time) {
                setRecipeTime(data.data.time)
                updates.time = data.data.time
                filled.push('time')
            }
            if (missingGenre && data.data.genre) {
                setRecipeGenre(data.data.genre)
                updates.genre = data.data.genre
                filled.push('genre')
            }

            if (Object.keys(updates).length > 0) {
                setAiFilledFields(filled)
                await fetch(`/api/Recipe/${String(id)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                    body: JSON.stringify(updates)
                })
            }
        } catch (e) {
            console.error('Auto-fill failed:', e)
        }
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

    // Shopping list helpers
    const openShopModal = async () => {
        setShopModalOpen(true)
        setAddSuccess(null)
        setShopListLoading(true)
        try {
            const token = localStorage.getItem('Token') || ""
            const res = await fetch('/api/ShoppingList', { headers: { 'edgetoken': token } })
            const data = await res.json()
            setShoppingLists((data.res || []).filter((l: any) => !l.complete && !l.deleted))
        } catch (e) {
            console.error('Failed to load shopping lists', e)
        } finally {
            setShopListLoading(false)
        }
    }

    const addToExistingList = async (listId: string) => {
        setAddingToList(true)
        try {
            const token = localStorage.getItem('Token') || ""
            const res = await fetch('/api/Recipe/addToShoppingList', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({ recipeId: id, shoppingListId: listId })
            })
            const data = await res.json()
            if (data.success) {
                setAddSuccess(`✅ Added ${data.added} items successfully!`)
            } else {
                setAddSuccess(`❌ Failed: ${data.message}`)
            }
        } catch (e) {
            setAddSuccess('❌ An error occurred')
        } finally {
            setAddingToList(false)
        }
    }

    const createListAndAdd = async () => {
        setAddingToList(true)
        try {
            const token = localStorage.getItem('Token') || ""
            const today = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
            const listName = `${recipeName} — ${today}`

            const createRes = await fetch('/api/ShoppingList', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({ name: listName })
            })
            const createData = await createRes.json()
            if (!createData.success) throw new Error(createData.message)

            const newListId = createData.data._id
            await addToExistingList(newListId)
        } catch (e: any) {
            setAddSuccess(`❌ Failed to create list: ${e.message}`)
            setAddingToList(false)
        }
    }

    const updateTimesCooked = async (newVal: number) => {
        if (newVal < 0) return
        setTimesCooked(newVal)
        const token = localStorage.getItem('Token') || ""
        await fetch(`/api/Recipe/${String(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'edgetoken': token },
            body: JSON.stringify({ timesCooked: newVal })
        })
    }

    const saveFeedback = async (value: string) => {
        setIsSavingFeedback(true)
        const token = localStorage.getItem('Token') || ""
        try {
            await fetch(`/api/Recipe/${String(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({ feedback: value })
            })
        } catch (e) {
            console.error("Failed to save feedback")
        }
        setIsSavingFeedback(false)
    }

    useEffect(() => {
        if (listIngreds && listIngreds.length > 0) {
            reloadAllIngredients()
        }
    }, [listIngreds])

    // When ingredients finish loading: save cost + AI auto-fill
    useEffect(() => {
        const allLoaded = matchedListIngreds.length > 0 && matchedListIngreds.every(i => !i.loading)
        if (allLoaded) {
            saveCostToRecipe(matchedListIngreds)
        }
    }, [matchedListIngreds])

    useEffect(() => {
        if (recipe && listIngreds.length > 0) {
            autoFillMetadata(recipe.name, listIngreds)
        }
    }, [recipe])

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

    const displayCost = approxCost ?? getAproxTotalRecipeCost()
    const displayPriceCategory = recipePriceCategory || (displayCost > 0 ? getPriceCategory(displayCost) : null)

    return (
        <Layout title={recipeName || "Recipe"}>
            <div className="max-w-4xl mx-auto pb-12">
                <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-sm p-4 sm:p-6 md:p-8 mb-8">

                    {/* Header — title + actions */}
                    <div className="mb-6 pb-4 border-b border-border">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">{recipeName}</h1>

                        {/* Metadata badges */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {recipeTime && timeLabelMap[recipeTime] && (
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${timeLabelMap[recipeTime].color}`}>
                                    {timeLabelMap[recipeTime].icon} {timeLabelMap[recipeTime].label}
                                    {aiFilledFields.includes('time') && <span title="AI generated" className="ml-1 opacity-60">✨</span>}
                                </span>
                            )}
                            {recipeGenre && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-purple-500/15 text-purple-400 border-purple-500/30">
                                    🍳 {recipeGenre}
                                    {aiFilledFields.includes('genre') && <span title="AI generated" className="ml-1 opacity-60">✨</span>}
                                </span>
                            )}
                            {displayPriceCategory && priceLabelMap[displayPriceCategory] && (
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${priceLabelMap[displayPriceCategory].color}`}>
                                    💰 {priceLabelMap[displayPriceCategory].label}
                                </span>
                            )}
                            {timesCooked > 0 && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                                    👨‍🍳 Cooked {timesCooked} time{timesCooked !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        {/* Action buttons — multi-row on mobile */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Button
                                onClick={() => router.push(`/createRecipe?id=${id}`)}
                                variant="outline"
                                className="w-full py-5 font-semibold"
                            >
                                ✏️ Edit Recipe
                            </Button>
                            <Button
                                onClick={openShopModal}
                                variant="outline"
                                className="w-full py-5 font-semibold border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500 text-emerald-500"
                            >
                                🛒 Add to Shopping List
                            </Button>
                            <Button
                                onClick={() => setIsCookingMode(true)}
                                className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                            >
                                👨‍🍳 Start Cooking
                            </Button>
                        </div>
                    </div>

                    {/* Ingredients */}
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl sm:text-2xl font-bold">Ingredients</h2>
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                            <input
                                type="checkbox"
                                checked={filters.includes("supplier")}
                                onChange={() => filters.includes("supplier") ? setFilters([]) : setFilters(["supplier"])}
                                className="w-4 h-4 rounded border-input"
                            />
                            <span className="hidden sm:inline">Show Grocery Products</span>
                            <span className="sm:hidden">Prices</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                        {loading && (
                            <div className="col-span-full flex justify-center py-8">
                                <object type="image/svg+xml" data="/loading.svg" className="w-12 h-12">loading...</object>
                            </div>
                        )}
                        {matchedListIngreds.map((ingred, idx) => (
                            <IngredientCard key={idx} ingredient={ingred} filters={filters} openModal={openModal} hideDelete={true} />
                        ))}
                    </div>

                    {/* Cost summary */}
                    <div className="bg-muted/30 rounded-xl p-4 sm:p-6 mb-6 grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Total Approx. Cost</p>
                            <p className="text-2xl sm:text-3xl font-bold">${displayCost.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Estimated Unit Cost</p>
                            <p className="text-2xl sm:text-3xl font-bold text-primary">${getAproxTotalRecipeCostUnit()}</p>
                        </div>
                    </div>

                    {/* Instructions */}
                    {instructions.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-xl sm:text-2xl font-bold mb-4">Instructions</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {instructions.map((instruction, index) => (
                                    <div key={index} className="bg-muted/10 rounded-xl p-4 sm:p-5 border border-border/50">
                                        <div className="text-primary font-bold mb-2 uppercase tracking-wider text-xs">Step {index + 1}</div>
                                        <p className="text-foreground/90 leading-relaxed text-sm">{instruction.Text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Nutrients */}
                    <div className="mb-8">
                        <h2 className="text-xl sm:text-2xl font-bold mb-4">Nutrients</h2>
                        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                            <IngredientNutrientGraph ingredients={matchedListIngreds} />
                        </div>
                    </div>

                    {/* Feedback & Cooked Status */}
                    <div className="mb-8 p-6 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold mb-1">Cooking Reflection</h2>
                                <p className="text-sm text-muted-foreground">Track your progress and notes for this recipe</p>
                            </div>
                            <div className="flex items-center bg-background/50 border border-border rounded-xl p-1 shadow-inner translate-y-[-4px]">
                                <Button 
                                    onClick={() => updateTimesCooked(timesCooked - 1)}
                                    variant="ghost" 
                                    size="sm"
                                    className="h-10 w-10 p-0 rounded-lg hover:bg-rose-500/10 hover:text-rose-500"
                                    disabled={timesCooked <= 0}
                                >
                                    -
                                </Button>
                                <input
                                    type="number"
                                    value={timesCooked}
                                    onChange={(e) => updateTimesCooked(parseInt(e.target.value) || 0)}
                                    className="w-12 text-center bg-transparent font-black text-lg focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Button 
                                    onClick={() => updateTimesCooked(timesCooked + 1)}
                                    variant="ghost" 
                                    size="sm"
                                    className="h-10 w-10 p-0 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
                                >
                                    +
                                </Button>
                                <div className="h-6 w-[1px] bg-border mx-2" />
                                <Button 
                                    onClick={() => updateTimesCooked(timesCooked + 1)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-10 px-4 rounded-lg flex items-center gap-2 transition-all active:scale-95"
                                >
                                    <ChefHat size={16} /> Mark as Cooked
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <span>Feedback & Result Notes</span>
                                {isSavingFeedback && <span className="animate-pulse text-emerald-500">Saving...</span>}
                            </div>
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                onBlur={(e) => saveFeedback(e.target.value)}
                                placeholder="How did it turn out? Any tweaks for next time? (Auto-saves on blur)"
                                className="w-full min-h-[120px] rounded-xl border border-border bg-background/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all resize-none"
                            />
                        </div>
                    </div>

                    {/* Recipe Image */}
                    {imageData && (
                        <div className="mb-8">
                            <h2 className="text-xl sm:text-2xl font-bold mb-4">Recipe Image</h2>
                            <div className="group relative rounded-xl overflow-hidden border border-border shadow-md cursor-pointer" onClick={handleClick}>
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                    <span className="text-white font-semibold">Change Image</span>
                                </div>
                                <img src={imageData} alt={recipeName} className="w-full h-auto object-cover max-h-96" />
                            </div>
                        </div>
                    )}

                    <input
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept="image/*"
                    />

                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
                        <span className="text-xs text-muted-foreground font-mono">ID: {id}</span>
                        <Button variant="destructive" onClick={deleteRecipe} size="sm">
                            Delete Recipe
                        </Button>
                    </div>
                </div>

                {/* Ingredient Research Modal */}
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
                            padding: '1.5rem',
                            borderRadius: '0.75rem',
                            inset: '1rem',
                        },
                        overlay: {
                            backgroundColor: 'rgba(0, 0, 0, 0.75)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 50
                        }
                    }}
                    contentLabel="Ingredient Research Modal"
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">Ingredient Research</h2>
                        <button
                            onClick={closeModal}
                            className="bg-muted hover:bg-muted/80 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                        >
                            <img src="/cross.png" className="w-4 h-4 invert-[.25] dark:invert" alt="close" />
                        </button>
                    </div>
                    <IngredientSearchList search_term={selectedIngred} />
                </Modal>

                {/* Add to Shopping List Modal */}
                <Modal
                    isOpen={shopModalOpen}
                    onRequestClose={() => { setShopModalOpen(false); setAddSuccess(null) }}
                    style={{
                        content: {
                            backgroundColor: 'var(--background)',
                            borderColor: 'var(--border)',
                            color: 'var(--foreground)',
                            maxWidth: '480px',
                            margin: '0 auto',
                            padding: '1.5rem',
                            borderRadius: '0.75rem',
                            inset: '1rem auto',
                            height: 'fit-content',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                        },
                        overlay: {
                            backgroundColor: 'rgba(0, 0, 0, 0.75)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 50,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }
                    }}
                    contentLabel="Add to Shopping List"
                >
                    <div className="flex justify-between items-center mb-5">
                        <h2 className="text-xl font-bold">🛒 Add to Shopping List</h2>
                        <button
                            onClick={() => { setShopModalOpen(false); setAddSuccess(null) }}
                            className="bg-muted hover:bg-muted/80 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                        >
                            <img src="/cross.png" className="w-4 h-4 invert-[.25] dark:invert" alt="close" />
                        </button>
                    </div>

                    {addSuccess ? (
                        <div className="text-center py-6">
                            <p className="text-lg font-semibold mb-4">{addSuccess}</p>
                            <Button
                                onClick={() => { setShopModalOpen(false); setAddSuccess(null) }}
                                className="w-full"
                            >
                                Done
                            </Button>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground mb-4">
                                Adding <strong>{listIngreds.length} ingredient{listIngreds.length !== 1 ? 's' : ''}</strong> from <em>{recipeName}</em>
                            </p>

                            {/* Create new list */}
                            <div className="mb-4">
                                <Button
                                    onClick={createListAndAdd}
                                    disabled={addingToList}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-5"
                                >
                                    {addingToList ? 'Creating...' : '+ Create New List & Add'}
                                </Button>
                                <p className="text-xs text-muted-foreground mt-1 text-center">
                                    Will create "{recipeName} — {new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}"
                                </p>
                            </div>

                            {/* Existing lists */}
                            {shopListLoading ? (
                                <div className="flex justify-center py-6">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
                                </div>
                            ) : shoppingLists.length > 0 ? (
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Or add to existing list</p>
                                    <div className="space-y-2 max-h-56 overflow-y-auto">
                                        {shoppingLists.map((list) => (
                                            <button
                                                key={list._id}
                                                onClick={() => addToExistingList(list._id)}
                                                disabled={addingToList}
                                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left disabled:opacity-50"
                                            >
                                                <span className="font-medium text-sm">{list.name}</span>
                                                <span className="text-emerald-500 text-sm">Add →</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-2">No active shopping lists found.</p>
                            )}
                        </>
                    )}
                </Modal>

                {/* Cooking Mode Overlay */}
                {isCookingMode && (
                    <div className="cooking-mode-overlay">
                        <div className="cooking-mode-header">
                            <h2 className="text-xl font-bold truncate pr-4">{recipeName}</h2>
                            <Button variant="ghost" size="sm" onClick={() => setIsCookingMode(false)} className="rounded-full w-10 h-10 p-0">
                                <img src="/cross.png" className="w-4 h-4 invert-[.25] dark:invert" alt="close" />
                            </Button>
                        </div>

                        <div className="cooking-mode-content">
                            <div className="mb-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-bold">
                                        Step {currentStep + 1} of {instructions.length}
                                    </span>
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-300"
                                            style={{ width: `${((currentStep + 1) / instructions.length) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="cooking-mode-step bg-[var(--cooking-card-bg)] border border-[var(--cooking-border)] rounded-2xl p-6 md:p-10 shadow-xl min-h-[250px] flex flex-col justify-center">
                                    <p className="text-2xl md:text-3xl font-bold leading-relaxed text-center sm:text-left text-[var(--cooking-text)]">
                                        {instructions[currentStep]?.Text}
                                    </p>
                                </div>
                            </div>

                            <div className="mb-8">
                                <h3 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2 text-[var(--cooking-text)]">
                                    <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                                    All Ingredients
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                    {listIngreds.map((ingred, idx) => (
                                        <div key={idx} className="bg-[var(--cooking-card-bg)] p-3 sm:p-4 rounded-lg flex justify-between items-center border border-[var(--cooking-border)] shadow-sm">
                                            <span className="font-bold text-sm text-[var(--cooking-text)]">{ingred.name}</span>
                                            <span className="text-xs sm:text-sm font-semibold text-emerald-600 bg-emerald-500/10 px-2 sm:px-3 py-1 rounded-full border border-emerald-500/20">
                                                {ingred.quantity} {ingred.quantity_type_shorthand || ingred.quantity_type}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="cooking-mode-controls">
                            <Button
                                variant="outline"
                                className="flex-1 py-7 sm:py-8 text-base sm:text-lg font-bold rounded-2xl"
                                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                                disabled={currentStep === 0}
                            >
                                Previous
                            </Button>
                            <Button
                                className="flex-[2] py-7 sm:py-8 text-base sm:text-lg font-bold rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white"
                                onClick={() => {
                                    if (currentStep < instructions.length - 1) {
                                        setCurrentStep(currentStep + 1)
                                    } else {
                                        setIsCookingMode(false)
                                        setCurrentStep(0)
                                    }
                                }}
                            >
                                {currentStep === instructions.length - 1 ? "🎉 Finish!" : "Next Step →"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
