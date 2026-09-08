import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useEffect, useState, useRef } from 'react'
import { Button } from '../../components/ui/button'
import { Flame, DollarSign, Clock, Utensils, Trash2, ChefHat, Check, ChevronRight, ChevronLeft, ChevronUp, Loader2, ShoppingBasket, ListOrdered, MessageSquare, Sparkles, Plus, Eye, EyeOff, RotateCcw, RefreshCw } from 'lucide-react'
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

const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function getIngredientSnapshot(ingreds: any[]) {
    return ingreds.map(i => ({ name: i.name, quantity: i.quantity, quantity_type: i.quantity_type }))
}

function getCachedIngreds(recipeId: string, currentIngreds: any[]): any[] | null {
    try {
        const raw = localStorage.getItem(`recipe-cost-cache-${recipeId}`)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (Date.now() - parsed.timestamp > CACHE_TTL) return null
        const cachedSnapshot = parsed.ingredients || []
        const currentSnapshot = getIngredientSnapshot(currentIngreds)
        if (cachedSnapshot.length !== currentSnapshot.length) return null
        for (let i = 0; i < cachedSnapshot.length; i++) {
            if (cachedSnapshot[i].name !== currentSnapshot[i].name ||
                cachedSnapshot[i].quantity !== currentSnapshot[i].quantity ||
                cachedSnapshot[i].quantity_type !== currentSnapshot[i].quantity_type) {
                return null
            }
        }
        return parsed.data
    } catch {
        return null
    }
}

function setCachedIngreds(recipeId: string, ingreds: any[], currentIngreds: any[]) {
    try {
        localStorage.setItem(`recipe-cost-cache-${recipeId}`, JSON.stringify({
            data: ingreds,
            ingredients: getIngredientSnapshot(currentIngreds),
            timestamp: Date.now()
        }))
    } catch {}
}

function clearCachedIngreds(recipeId: string) {
    localStorage.removeItem(`recipe-cost-cache-${recipeId}`)
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'over', 'until', 'all', 'into', 'each', 'both', 'than', 'then', 'also', 'just', 'about', 'from', 'up', 'down', 'out', 'off', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'any', 'every', 'some', 'few', 'more', 'most', 'other', 'only', 'very', 'now'])

function getRecommendedIngredients(stepText: string, ingredients: any[]): { recommended: any[]; others: any[] } {
    const stepWords = stepText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))

    const scored = ingredients.map(ing => {
        const nameWords = ing.name.toLowerCase().split(/\s+/)
        const score = nameWords.filter(nw => stepWords.some(sw => nw.includes(sw) || sw.includes(nw))).length
        return { ...ing, score, recommended: score > 0 }
    })

    const recommended = scored.filter(i => i.recommended).sort((a, b) => b.score - a.score)
    const others = scored.filter(i => !i.recommended)
    return { recommended, others }
}

function getRecommendedPrepWork(stepText: string, prepWork: any[]): { recommended: any[]; others: any[] } {
    const stepWords = stepText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))

    const scored = prepWork.map(item => {
        const searchText = `${item.ingredient || ''} ${item.action}`.toLowerCase()
        const nameWords = searchText.split(/\s+/).filter((w: string) => w.length > 2)
        const score = nameWords.filter((nw: string) => stepWords.some(sw => nw.includes(sw) || sw.includes(nw))).length
        return { ...item, score, recommended: score > 0 }
    })

    return {
        recommended: scored.filter(i => i.recommended).sort((a: any, b: any) => b.score - a.score),
        others: scored.filter(i => !i.recommended)
    }
}

function getTimerById(timers: any[], id: string | undefined) {
    if (!id) return undefined
    return timers.find(t => t.id === id)
}

function calculateTimerStartTime(timers: any[], timer: any): number {
    if (!timer.dependencies || timer.dependencies.length === 0) return 0
    const dep = timer.dependencies[0]
    if (dep.timerId === 'start') return 0
    const parent = getTimerById(timers, dep.timerId)
    if (!parent) return 0
    const parentStart = calculateTimerStartTime(timers, parent)
    const parentDuration = parent.duration || 0
    return parentStart + parentDuration + (dep.offset || 0)
}

function sortTimersByStartTime(timers: any[]) {
    return [...timers].sort((a, b) => calculateTimerStartTime(timers, a) - calculateTimerStartTime(timers, b))
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
    const [prepSheetOpen, setPrepSheetOpen] = useState(false)

    // Metadata fields
    const [recipeTime, setRecipeTime] = useState<string>('')
    const [recipeGenre, setRecipeGenre] = useState<string>('')
    const [recipeMealTypes, setRecipeMealTypes] = useState<string[]>([])
    const [recipeCarbType, setRecipeCarbType] = useState<string>('')
    const [recipePriceCategory, setRecipePriceCategory] = useState<string>('')
    const [approxCost, setApproxCost] = useState<number | null>(null)
    const [aiFilledFields, setAiFilledFields] = useState<string[]>([])
    const [timesCooked, setTimesCooked] = useState(0)
    const [isHidden, setIsHidden] = useState(false)
    const [feedback, setFeedback] = useState("")
    const [isSavingFeedback, setIsSavingFeedback] = useState(false)
    const [isCalculatingCost, setIsCalculatingCost] = useState(false)
    const [showNutrients, setShowNutrients] = useState(false)
    const [recipeServings, setRecipeServings] = useState<number>(0)

    // Prep work state
    const [prepWork, setPrepWork] = useState<any[]>([])
    const [checkedPrep, setCheckedPrep] = useState<Set<number>>(new Set())
    const [editingPrepIndex, setEditingPrepIndex] = useState<number | null>(null)
    const [editingPrepText, setEditingPrepText] = useState("")
    const [isExtractingPrep, setIsExtractingPrep] = useState(false)
    const hasCheckedPrepRef = useRef(false)

    // Add to shopping list modal
    const [shopModalOpen, setShopModalOpen] = useState(false)
    const [shoppingLists, setShoppingLists] = useState<any[]>([])
    const [shopListLoading, setShopListLoading] = useState(false)
    const [addingToList, setAddingToList] = useState(false)
    const [addSuccess, setAddSuccess] = useState<string | null>(null)

    // Cooking timer state
    const [cookingTimers, setCookingTimers] = useState<any[]>([])
    const [activeSession, setActiveSession] = useState<Record<string, { endTime: number | null; remaining: number; status: string; checkpointsHit: string[] }>>({})
    const [timerSheetOpen, setTimerSheetOpen] = useState(false)
    const [customTimers, setCustomTimers] = useState<{ id: string; name: string; duration: number }[]>([])
    const [customTimerName, setCustomTimerName] = useState("")
    const [customTimerMinutes, setCustomTimerMinutes] = useState("")
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
    const [finishConfirm, setFinishConfirm] = useState(false)
    const [resetConfirm, setResetConfirm] = useState(false)
    const [clearResidualPrompt, setClearResidualPrompt] = useState({ show: false, recipeName: '', recipeId: '' })
    const [editingTimerId, setEditingTimerId] = useState<string | null>(null)
    const [editTimerMinutes, setEditTimerMinutes] = useState("")
    const [editTimerSeconds, setEditTimerSeconds] = useState("")
    const [customExtendId, setCustomExtendId] = useState<string | null>(null)
    const [customExtendMin, setCustomExtendMin] = useState("")

    const costSavedRef = useRef(false)

    const totalTimeEstimate = (prepWork || []).filter((p: any) => !p.optional).reduce((sum: number, p: any) => sum + (p.timeEstimate || 0), 0)
        + (instructions || []).reduce((sum: number, i: any) => sum + (i.time || 0), 0)

    async function openModal(ingredName: string) {
        setIsOpen(true)
        setSelectedIngred(ingredName)
    }

    async function closeModal() {
        setIsOpen(false)
    }

    const reloadAllIngredients = async () => {
        setIsCalculatingCost(true)
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
        setIsCalculatingCost(false)
        if (id) setCachedIngreds(id as string, updatedListIngreds, listIngreds)
    }

    const refreshCost = async () => {
        if (id) clearCachedIngreds(id as string)
        await reloadAllIngredients()
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
        setRecipeMealTypes(data.res.mealTypes || [])
        setRecipeCarbType(data.res.carbType || '')
        setRecipePriceCategory(data.res.priceCategory || '')
        setTimesCooked(data.res.timesCooked || 0)
        setIsHidden(!!data.res.hidden)
        setFeedback(data.res.feedback || "")
        setRecipeServings(data.res.servings || 0)
        if (data.res.approxCost != null) setApproxCost(data.res.approxCost)
        setPrepWork(data.res.prepWork || [])
        // Use the dedicated flag to determine if we've already extracted
        if (data.res.prepWorkChecked) {
            hasCheckedPrepRef.current = true
        }
        if (data.res.cookingTimers && data.res.cookingTimers.length > 0) {
            setCookingTimers(data.res.cookingTimers)
        }
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

    const getAproxTotalRecipeCostUnit = (ingreds?: any[]) => {
        const list = ingreds || matchedListIngreds
        let total = 0
        for (const ingredient of list) {
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
        const unitCostTotal = getAproxTotalRecipeCostUnit(ingreds)
        if (total === 0) return
        costSavedRef.current = true

        const category = getPriceCategory(total)
        setApproxCost(total)
        setRecipePriceCategory(category)

        const token = localStorage.getItem('Token') || ""
        await fetch(`/api/Recipe/${String(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'edgetoken': token },
            body: JSON.stringify({ approxCost: total, priceCategory: category, unitCost: Number(unitCostTotal) })
        })
    }

    // AI auto-fill missing time/genre
    const autoFillMetadata = async (name: string, ingreds: any[]) => {
        if (!id) return
        const missingTime = !recipeTime
        const missingGenre = !recipeGenre
        const missingMealTypes = !recipeMealTypes || recipeMealTypes.length === 0
        const missingServings = !recipeServings || recipeServings === 0
        const missingCarbType = !recipeCarbType
        if (!missingTime && !missingGenre && !missingMealTypes && !missingServings && !missingCarbType) return

        try {
            const token = localStorage.getItem('Token') || ""
            const ingredNames = ingreds.map(i => i.name).join(', ')
            const mealTypeQuery = recipeMealTypes.length > 0 ? `&mealType=${encodeURIComponent(recipeMealTypes.join(','))}` : ""
            const res = await fetch(`/api/ai/auto_fill_recipe?recipeName=${encodeURIComponent(name)}&ingredients=${encodeURIComponent(ingredNames)}${mealTypeQuery}`, {
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
            if (missingMealTypes && data.data.mealType) {
                setRecipeMealTypes([data.data.mealType])
                updates.mealTypes = [data.data.mealType]
                filled.push('mealType')
            }
            if (missingServings && data.data.servings) {
                setRecipeServings(data.data.servings)
                updates.servings = data.data.servings
                filled.push('servings')
            }
            if (missingCarbType && data.data.carbType) {
                setRecipeCarbType(data.data.carbType)
                updates.carbType = data.data.carbType
                filled.push('carbType')
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

    const logRecipeServe = async () => {
        const token = localStorage.getItem('Token');
        if (!token || !recipe) return;
        
        try {
            const res = await fetch('/api/dailyLog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({
                    date: new Date().toISOString().split('T')[0],
                    type: 'recipe',
                    name: recipe.name,
                    recipe_id: id,
                    quantity: 1, // 1 serve
                    quantity_unit: 'serving'
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`✅ Logged 1 serving of ${recipe.name}!`);
            } else {
                alert(`❌ Failed: ${data.message}`);
            }
        } catch (err) {
            alert("❌ Logging failed");
        }
    };

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

    const toggleHidden = async () => {
        const newVal = !isHidden
        setIsHidden(newVal)
        const token = localStorage.getItem('Token') || ""
        try {
            await fetch(`/api/Recipe/${String(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({ hidden: newVal })
            })
        } catch (e) {
            console.error("Failed to update hidden")
            setIsHidden(!newVal)
        }
    }

    const savePrepWork = async (items: any[]) => {
        const token = localStorage.getItem('Token') || ""
        try {
            await fetch(`/api/Recipe/${String(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({ prepWork: items })
            })
        } catch (e) {
            console.error("Failed to save prep work")
        }
    }

    const extractPrepWork = async () => {
        if (!recipe || !listIngreds || listIngreds.length === 0) return
        setIsExtractingPrep(true)
        try {
            const token = localStorage.getItem('Token') || ""
            // Preserve any manually added custom items
            const customItems = (prepWork || []).filter((p: any) => p.isCustom)

            const ingredientList = listIngreds.map(i =>
                `${i.name}${i.note ? ` (${i.note})` : ''}`
            ).join(', ')
            const instructionList = instructions.map(i => i.Text).join('; ')
            const res = await fetch(
                `/api/ai/extract_prep_work?recipeName=${encodeURIComponent(recipeName)}&ingredients=${encodeURIComponent(ingredientList)}&instructions=${encodeURIComponent(instructionList)}`,
                { headers: { 'edgetoken': token } }
            )
            const data = await res.json()
            let aiItems: any[] = []
            if (data.success && data.data) {
                aiItems = data.data.prepWork || []

                // Deduplicate: remove any prep work that overlaps with instruction text
                const instructionLower = instructions.map(i => i.Text.toLowerCase()).join(' ')
                aiItems = aiItems.filter((item: any) => {
                    const actionLower = (item.action || '').toLowerCase()
                    // Check if key verbs from prep appear in instruction context
                    const verbs = actionLower.split(/\s+/).filter((w: string) => w.length > 3)
                    const overlapCount = verbs.filter((v: string) => instructionLower.includes(v)).length
                    // If more than half the words overlap with instructions, skip it
                    return overlapCount < Math.ceil(verbs.length / 2)
                })

                // Update instruction times
                if (data.data.instructionTimes && instructions.length > 0) {
                    const updatedInstructions = instructions.map((inst, idx) => {
                        const timeData = data.data.instructionTimes.find(
                            (t: any) => t.step === idx + 1
                        )
                        return timeData ? { ...inst, time: timeData.timeEstimate } : inst
                    })
                    setInstructions(updatedInstructions)
                    await fetch(`/api/Recipe/${String(id)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                        body: JSON.stringify({ instructions: updatedInstructions })
                    })
                }
            }
            // Merge: AI items first, then custom items
            const merged = [...aiItems, ...customItems]
            setPrepWork(merged)
            await savePrepWork(merged)
            // Mark as checked
            await fetch(`/api/Recipe/${String(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({ prepWorkChecked: true })
            })
        } catch (e) {
            console.error('Prep work extraction failed:', e)
        }
        setIsExtractingPrep(false)
    }

    const saveTimers = async (timers: any[]) => {
        if (!id) return
        const token = localStorage.getItem('Token') || ""
        await fetch(`/api/Recipe/${String(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'edgetoken': token },
            body: JSON.stringify({ cookingTimers: timers, timersChecked: true })
        })
    }

    const extractTimers = async () => {
        if (!id || !recipeName || cookingTimers.length > 0) return
        try {
            const token = localStorage.getItem('Token') || ""
            const ingredNames = (listIngreds || []).map((i: any) => i.name).join(', ')
            const instrText = (instructions || []).map((i: any, idx: number) => `${idx + 1}. ${i.Text}${i.time ? ` (${i.time} min)` : ''}`).join('\n')
            const res = await fetch(`/api/ai/extract_timers?recipeName=${encodeURIComponent(recipeName)}&ingredients=${encodeURIComponent(ingredNames)}&instructions=${encodeURIComponent(instrText)}`, {
                headers: { 'edgetoken': token }
            })
            const data = await res.json()
            if (data.success && data.data?.timers && data.data.timers.length > 0) {
                setCookingTimers(data.data.timers)
                await saveTimers(data.data.timers)
            }
        } catch (e) {
            console.error('Timer extraction failed:', e)
        }
    }

    function getRemaining(session: { endTime: number | null; remaining: number; status: string }) {
        if (session.status === 'active' && session.endTime) {
            return Math.max(0, Math.round((session.endTime - Date.now()) / 1000))
        }
        return session.remaining
    }

    const playAlarm = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
            const playBeep = (freq: number, startTime: number) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain)
                gain.connect(ctx.destination)
                osc.frequency.value = freq
                osc.type = 'sine'
                gain.gain.setValueAtTime(0.3, startTime)
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3)
                osc.start(startTime)
                osc.stop(startTime + 0.3)
            }
            const now = ctx.currentTime
            playBeep(880, now)
            playBeep(880, now + 0.35)
            playBeep(1100, now + 0.7)
        } catch (e) {
            console.error('Audio alarm failed:', e)
        }
    }

    const sendNotification = (title: string, body: string) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' })
        }
    }

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }
    }, [])

    useEffect(() => {
        return () => {
            setCheckedPrep(new Set())
        }
    }, [])

    const [prepDone, setPrepDone] = useState(false)

    useEffect(() => {
        if (!hasCheckedPrepRef.current && listIngreds && listIngreds.length > 0 && recipe) {
            hasCheckedPrepRef.current = true
            extractPrepWork().then(() => setPrepDone(true))
        } else if (hasCheckedPrepRef.current) {
            setPrepDone(true)
        }
    }, [recipe, listIngreds])

    useEffect(() => {
        if (prepDone && listIngreds && listIngreds.length > 0) {
            const cached = id ? getCachedIngreds(id as string, listIngreds) : null
            if (cached) {
                setMatchedListIngreds(cached)
            } else {
                reloadAllIngredients()
            }
        }
    }, [prepDone, listIngreds])

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

    // Auto-extract timers if none exist
    useEffect(() => {
        if (recipe && recipeName && listIngreds.length > 0 && instructions.length > 0 && cookingTimers.length === 0) {
            extractTimers()
        }
    }, [recipe, recipeName, listIngreds, instructions])

    // Clear residual timers from other recipes on mount
    useEffect(() => {
        if (!id) return
        const keys = Object.keys(localStorage).filter(k => k.startsWith('timer-session-'))
        for (const key of keys) {
            if (key !== `timer-session-${id}`) {
                try {
                    const session = JSON.parse(localStorage.getItem(key) || '{}')
                    const hasActive = Object.values(session).some((s: any) => s.status === 'active' || s.status === 'paused')
                    if (hasActive) {
                        const recipeId = key.replace('timer-session-', '')
                        setClearResidualPrompt({ show: true, recipeName: 'another recipe', recipeId })
                        break
                    }
                } catch {}
            }
        }
    }, [id])

    // Load session from localStorage
    useEffect(() => {
        if (!id) return
        try {
            const saved = localStorage.getItem(`timer-session-${id}`)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed.timers) setActiveSession(parsed.timers)
                if (parsed.completedSteps) setCompletedSteps(new Set(parsed.completedSteps))
                if (parsed.currentStep != null) {
                    setCurrentStep(parsed.currentStep)
                } else if (parsed.timers && cookingTimers?.length) {
                    const activeTimers = Object.entries(parsed.timers)
                        .filter(([_, s]: [string, any]) => s.status === 'active' || s.status === 'paused')
                        .map(([tid]) => cookingTimers.find((t: any) => t.id === tid))
                        .filter(Boolean)
                    if (activeTimers.length > 0) {
                        const maxStep = Math.max(...activeTimers.map((t: any) => t.stepIndex ?? 0))
                        setCurrentStep(maxStep)
                        const prior = new Set<number>()
                        for (let i = 0; i < maxStep; i++) prior.add(i)
                        setCompletedSteps(prior)
                    }
                }
            }
        } catch {}
    }, [id, cookingTimers])

    // Save session to localStorage
    useEffect(() => {
        if (!id) return
        try {
            localStorage.setItem(`timer-session-${id}`, JSON.stringify({
                timers: activeSession,
                currentStep,
                completedSteps: Array.from(completedSteps)
            }))
        } catch {}
    }, [activeSession, currentStep, completedSteps, id])

    // Countdown engine
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSession(prev => {
                const next = { ...prev }
                let changed = false
                for (const [timerId, session] of Object.entries(next)) {
                    if (session.status !== 'active' || !session.endTime) continue
                    const remaining = Math.max(0, Math.round((session.endTime - Date.now()) / 1000))
                    if (remaining <= 0) {
                        next[timerId] = { ...session, status: 'completed', remaining: 0 }
                        changed = true
                        playAlarm()
                        sendNotification('Timer Complete', `${getTimerById(cookingTimers, timerId)?.name || 'Timer'} is done!`)
                    }
                    // Check checkpoints
                    const timer = getTimerById(cookingTimers, timerId)
                    if (timer) {
                        const checkpoints = cookingTimers.filter((t: any) => t.parentTimerId === timerId && t.type === 'checkpoint')
                        for (const ckpt of checkpoints) {
                            if (session.checkpointsHit?.includes(ckpt.id)) continue
                            const ckptOffset = ckpt.dependencies?.[0]?.offset || 0
                            const elapsed = (timer.duration * 60) - remaining
                            if (elapsed >= ckptOffset) {
                                next[timerId] = { ...next[timerId], checkpointsHit: [...(next[timerId].checkpointsHit || []), ckpt.id] }
                                changed = true
                                playAlarm()
                                sendNotification('Checkpoint', `${ckpt.name} reached!`)
                            }
                        }
                    }
                }
                return changed ? next : prev
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [cookingTimers, id])

    const handleClick = () => {
        document.querySelector<HTMLInputElement>('input[type="file"]')?.click()
    }

    const scrollToSection = (section: string) => {
        const el = document.querySelector(`[data-section="${section}"]`) as HTMLElement | null;
        if (!el) return;
        el.classList.remove('group-flash');
        void el.offsetWidth;
        el.classList.add('group-flash');
        const y = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: y, behavior: 'smooth' });
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
    const sourceUrl: string | null = recipe.sourceUrl || null
    const isVideoSource = !!sourceUrl && (sourceUrl.includes('facebook.com') || sourceUrl.includes('fb.watch'))

    return (
        <Layout title={recipeName || "Recipe"}>
            {/* Quick Jump Bar */}
            <div className="fixed bottom-[4.5rem] sm:bottom-0 left-0 right-0 z-[50] bg-card border-t border-border/10 shadow-sm">
                <div className="flex justify-center gap-3 py-3">
                    <button
                        onClick={() => scrollToSection('ingredients')}
                        className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-all active:scale-90"
                        style={{ background: '#10b981', boxShadow: '0 2px 8px #10b98160' }}
                        title="Ingredients"
                    >
                        <ShoppingBasket size={16} strokeWidth={2.5} className="text-white" />
                    </button>
                    <button
                        onClick={() => scrollToSection('prep')}
                        className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-all active:scale-90"
                        style={{ background: '#f97316', boxShadow: '0 2px 8px #f9731660' }}
                        title="Prep Work"
                    >
                        <ChefHat size={16} strokeWidth={2.5} className="text-white" />
                    </button>
                    <button
                        onClick={() => scrollToSection('instructions')}
                        className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-all active:scale-90"
                        style={{ background: '#6366f1', boxShadow: '0 2px 8px #6366f160' }}
                        title="Instructions"
                    >
                        <ListOrdered size={16} strokeWidth={2.5} className="text-white" />
                    </button>
                    <button
                        onClick={() => scrollToSection('timers')}
                        className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-all active:scale-90"
                        style={{ background: '#f43f5e', boxShadow: '0 2px 8px #f43f5e60' }}
                        title="Cooking Timers"
                    >
                        <Clock size={16} strokeWidth={2.5} className="text-white" />
                    </button>
                    <button
                        onClick={() => scrollToSection('feedback')}
                        className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-all active:scale-90"
                        style={{ background: '#f59e0b', boxShadow: '0 2px 8px #f59e0b60' }}
                        title="Cooking Reflection"
                    >
                        <MessageSquare size={16} strokeWidth={2.5} className="text-white" />
                    </button>
                    <button
                        onClick={() => scrollToSection('nutrients')}
                        className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-all active:scale-90"
                        style={{ background: '#a855f7', boxShadow: '0 2px 8px #a855f760' }}
                        title="Nutritional Density"
                    >
                        <Sparkles size={16} strokeWidth={2.5} className="text-white" />
                    </button>
                    <button
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-all active:scale-90"
                        style={{ background: '#64748b', boxShadow: '0 2px 8px #64748b60' }}
                        title="Back to Top"
                    >
                        <ChevronUp size={16} strokeWidth={2.5} className="text-white" />
                    </button>
                </div>
            </div>
            <div className="max-w-4xl mx-auto pb-12">
                {/* Hero Header */}
                <div className="relative bg-card text-card-foreground rounded-2xl border-0 sm:border sm:border-border/20 shadow-xl overflow-hidden mb-8">
                    {imageData && (
                        <div className="relative min-h-[20rem] sm:h-80 md:h-96 w-full cursor-pointer group" onClick={handleClick}>
                            <img src={imageData} alt={recipeName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 md:p-8">
                                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-2 drop-shadow-lg leading-tight">{recipeName}</h1>
                                <div className="flex flex-wrap gap-2">
                                    {recipeTime && timeLabelMap[recipeTime] && (
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-lg ${timeLabelMap[recipeTime].color} border-white/5`}>
                                            {timeLabelMap[recipeTime].icon} {timeLabelMap[recipeTime].label}
                                        </span>
                                    )}
                                    {recipeGenre && (
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-lg bg-purple-500/20 text-purple-200 border-white/5`}>
                                            🍳 {recipeGenre}
                                        </span>
                                    )}
                                    {recipeMealTypes && recipeMealTypes.map(type => (
                                        <span key={type} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-lg bg-indigo-500/20 text-indigo-200 border-white/5`}>
                                            🍽️ {type}
                                        </span>
                                    ))}
                                    {recipeCarbType && (
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-lg bg-orange-500/20 text-orange-200 border-white/5`}>
                                            🌾 {recipeCarbType}
                                        </span>
                                    )}
                                    {displayPriceCategory && priceLabelMap[displayPriceCategory] && (
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-lg ${priceLabelMap[displayPriceCategory].color} border-white/5`}>
                                            💰 {priceLabelMap[displayPriceCategory].label}
                                        </span>
                                    )}
                                    {isHidden && (
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-lg bg-amber-500/25 text-amber-200 border-white/5`}>
                                            <EyeOff size={12} /> Hidden
                                        </span>
                                    )}
                                    {sourceUrl && (
                                        <a
                                            href={sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            title={sourceUrl}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-lg bg-white/10 text-white border-white/5 hover:bg-white/25 transition-colors"
                                        >
                                            {isVideoSource ? '▶ Watch Original Video' : '🔗 View Source'}
                                        </a>
                                    )}
                                </div>

                                {/* Inline Cost Display */}
                                <div className="mt-4 flex flex-col sm:flex-row gap-4 sm:gap-6 text-white border-t border-white/[0.03] pt-4">
                                    <div className="flex sm:block items-center justify-between gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-0.5">Approx. Cost</p>
                                            {!isCalculatingCost && (
                                                <button onClick={refreshCost} title="Refresh cost" className="opacity-40 hover:opacity-100 transition-opacity mb-0.5">
                                                    <RefreshCw className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                        {isCalculatingCost ? (
                                            <Loader2 className="w-4 h-4 animate-spin opacity-40" />
                                        ) : (
                                            <p className="text-xl font-black">${displayCost.toFixed(2)}</p>
                                        )}
                                    </div>
                                    <div className="border-t sm:border-t-0 sm:border-l border-white/[0.03] pt-4 sm:pt-0 sm:pl-6 flex sm:block items-center justify-between gap-4">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-0.5">Unit Cost</p>
                                        {isCalculatingCost ? (
                                            <Loader2 className="w-4 h-4 animate-spin opacity-40" />
                                        ) : (
                                            <p className="text-xl font-black">${getAproxTotalRecipeCostUnit()}</p>
                                        )}
                                    </div>
                                    {recipeServings > 0 && (
                                        <div className="border-t sm:border-t-0 sm:border-l border-white/[0.03] pt-4 sm:pt-0 sm:pl-6 flex sm:block items-center justify-between gap-4">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-0.5">Per Person</p>
                                            {isCalculatingCost ? (
                                                <Loader2 className="w-4 h-4 animate-spin opacity-40" />
                                            ) : (
                                                <p className="text-xl font-black text-emerald-400">${(displayCost / recipeServings).toFixed(2)}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {(totalTimeEstimate > 0 || recipeServings > 0) && (
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
                                        {totalTimeEstimate > 0 && (
                                            <span className="flex items-center gap-1.5">
                                                <Clock size={12} /> {totalTimeEstimate} min
                                            </span>
                                        )}
                                        {recipeServings > 0 && (
                                            <span className="flex items-center gap-1.5">
                                                👥 {recipeServings} servings
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="absolute top-4 right-4 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm font-semibold text-center">Change<br />Image</span>
                            </div>
                        </div>
                    )}

                    {!imageData && (
                        <div className="p-8 pb-4">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 leading-tight">{recipeName}</h1>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {recipeTime && timeLabelMap[recipeTime] && (
                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${timeLabelMap[recipeTime].color}`}>
                                        {timeLabelMap[recipeTime].icon} {timeLabelMap[recipeTime].label}
                                    </span>
                                )}
                                {recipeGenre && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-purple-500/15 text-purple-400 border-purple-500/30">
                                        🍳 {recipeGenre}
                                    </span>
                                )}
                                {isHidden && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-amber-500/15 text-amber-400 border-amber-500/30">
                                        <EyeOff size={12} /> Hidden
                                    </span>
                                )}
                                {sourceUrl && (
                                    <a
                                        href={sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={sourceUrl}
                                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25 transition-colors"
                                    >
                                        {isVideoSource ? '▶ Watch Original Video' : '🔗 View Source'}
                                    </a>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 border-0 sm:border-t sm:border-border/10 pt-4">
                                <div className="flex sm:block items-center justify-between gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">Total Approx. Cost</p>
                                        {!isCalculatingCost && (
                                            <button onClick={refreshCost} title="Refresh cost" className="opacity-40 hover:opacity-100 transition-opacity mb-1">
                                                <RefreshCw className="w-3 h-3 text-muted-foreground" />
                                            </button>
                                        )}
                                    </div>
                                    {isCalculatingCost ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
                                    ) : (
                                        <p className="text-2xl font-black">${displayCost.toFixed(2)}</p>
                                    )}
                                </div>
                                <div className="border-t sm:border-t-0 sm:border-l border-border/10 pt-4 sm:pt-0 sm:pl-8 flex sm:block items-center justify-between gap-4">
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">Estimated Unit Cost</p>
                                    {isCalculatingCost ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
                                    ) : (
                                        <p className="text-2xl font-black text-primary border-primary/20">${getAproxTotalRecipeCostUnit()}</p>
                                    )}
                                </div>
                                {recipeServings > 0 && (
                                    <div className="border-t sm:border-t-0 sm:border-l border-border/10 pt-4 sm:pt-0 sm:pl-8 flex sm:block items-center justify-between gap-4">
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">Per Person</p>
                                        {isCalculatingCost ? (
                                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
                                        ) : (
                                            <p className="text-2xl font-black text-emerald-500">${(displayCost / recipeServings).toFixed(2)}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            {(totalTimeEstimate > 0 || recipeServings > 0) && (
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                    {totalTimeEstimate > 0 && (
                                        <span className="flex items-center gap-1.5">
                                            <Clock size={12} /> {totalTimeEstimate} min
                                        </span>
                                    )}
                                    {recipeServings > 0 && (
                                        <span className="flex items-center gap-1.5">
                                            👥 {recipeServings} servings
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="p-6 md:p-8 border-0 sm:border-t sm:border-border/5 bg-muted/10">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                onClick={() => setIsCookingMode(true)}
                                className="flex-[2] py-7 sm:py-8 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                            >
                                <ChefHat className="w-6 h-6" />
                                Start Cooking
                            </Button>
                            <div className="flex flex-1 gap-2">
                                <Button
                                    onClick={openShopModal}
                                    variant="outline"
                                    className="flex-1 py-7 sm:py-8 font-bold border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500 text-emerald-500 transition-all flex flex-col sm:flex-row items-center justify-center gap-2"
                                >
                                    <Plus className="w-5 h-5 hidden sm:block" />
                                    <span>List</span>
                                </Button>
                                <Button
                                    onClick={toggleHidden}
                                    variant="outline"
                                    className={`flex-1 py-7 sm:py-8 font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-2 ${
                                        isHidden
                                            ? 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20 text-amber-500'
                                            : 'hover:bg-accent/10'
                                    }`}
                                    title={isHidden ? 'Hidden from /recipes grid' : 'Show on /recipes grid'}
                                >
                                    {isHidden ? <EyeOff className="w-5 h-5 hidden sm:block" /> : <Eye className="w-5 h-5 hidden sm:block" />}
                                    <span>{isHidden ? 'Hidden' : 'Hide'}</span>
                                </Button>
                                <Button
                                    onClick={() => router.push(`/createRecipe?id=${id}`)}
                                    variant="outline"
                                    className="flex-1 py-7 sm:py-8 font-bold hover:bg-accent/10 transition-all flex flex-col sm:flex-row items-center justify-center gap-2"
                                >
                                    ✏️ <span className="hidden sm:inline">Edit</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card text-card-foreground border-0 sm:border sm:border-border/10 shadow-sm p-2 sm:p-4 md:p-6 mb-8 transition-shadow duration-500 hover:shadow-md overflow-hidden">
                    {/* Ingredients Section */}
                    <div data-section="ingredients" className="pt-10 pb-14 px-6 sm:px-10 bg-emerald-500/[0.02]">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 shadow-sm shadow-emerald-500/5">
                                <ShoppingBasket className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground/90">Ingredients</h2>
                                <p className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest mt-1">Fresh & Pantry Staples</p>
                            </div>
                        </div>

                        <div className="space-y-10">
                            {Object.entries(
                                matchedListIngreds.reduce((acc: any, ingred) => {
                                    const cat = ingred.category_simple || ingred.category || 'Other';
                                    if (!acc[cat]) acc[cat] = [];
                                    acc[cat].push(ingred);
                                    return acc;
                                }, {})
                            ).sort(([a], [b]) => {
                                // Priority categories first (using simplified names)
                                const priority = ['Fresh Produce', 'Fridge', 'Freezer', 'Bakery', 'Snacks', 'Staple Food'];
                                const aIdx = priority.indexOf(a);
                                const bIdx = priority.indexOf(b);
                                if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                                if (aIdx !== -1) return -1;
                                if (bIdx !== -1) return 1;
                                return a.localeCompare(b);
                            }).map(([category, ingredients]: [string, any[]]) => (
                                <div key={category} className="animate-in fade-in slide-in-from-left-4 duration-500">
                                    <h3 className="text-xs font-black tracking-widest text-emerald-500/90 mb-6 flex items-center gap-4">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60"></span>
                                        {category}
                                        <span className="flex-1 h-px bg-emerald-500/20"></span>
                                        <span className="opacity-60">{ingredients.length} items</span>
                                    </h3>
                                    <div className="flex flex-col ml-1">
                                        {ingredients.map((ingred, idx) => (
                                            <IngredientCard
                                                key={idx}
                                                ingredient={ingred}
                                                variant="minimal"
                                                filters={filters}
                                                openModal={openModal}
                                                hideDelete={true}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Prep Work Section */}
                    <div data-section="prep" className="py-14 px-6 sm:px-10 border-0 sm:border-t sm:border-border/10 bg-orange-500/[0.02]">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/10 shadow-sm shadow-orange-500/5">
                                <ChefHat className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground/90">Prep Work</h2>
                                <p className="text-[10px] font-bold text-orange-500/60 uppercase tracking-widest mt-1">Before You Start</p>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                                {isExtractingPrep && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
                                <button
                                    onClick={extractPrepWork}
                                    disabled={isExtractingPrep}
                                    className="text-xs text-orange-500/60 hover:text-orange-500 disabled:opacity-50"
                                >
                                    Re-extract
                                </button>
                            </div>
                        </div>

                        {isExtractingPrep ? (
                            <p className="text-foreground/40 text-sm">Analyzing recipe...</p>
                        ) : prepWork.length === 0 ? (
                            <p className="text-foreground/40 text-sm">Nothing to do... add items manually or click Re-extract.</p>
                        ) : (
                            <div className="space-y-3">
                                {prepWork.map((item, index) => (
                                    <div key={index} className={`flex items-center gap-4 p-3 rounded-xl border ${item.optional ? 'bg-orange-500/[0.02] border-orange-500/5 border-dashed' : 'bg-orange-500/5 border-orange-500/10'}`}>
                                        <button
                                            onClick={() => setCheckedPrep(prev => {
                                                const next = new Set(prev)
                                                if (next.has(index)) next.delete(index)
                                                else next.add(index)
                                                return next
                                            })}
                                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                checkedPrep.has(index)
                                                    ? 'bg-orange-500 border-orange-500 text-white'
                                                    : item.optional ? 'border-orange-500/20 hover:border-orange-500/50' : 'border-orange-500/30 hover:border-orange-500'
                                            }`}
                                        >
                                            {checkedPrep.has(index) && <Check size={14} />}
                                        </button>
                                        {editingPrepIndex === index ? (
                                            <input
                                                value={editingPrepText}
                                                onChange={(e) => setEditingPrepText(e.target.value)}
                                                onBlur={() => {
                                                    const updated = [...prepWork]
                                                    updated[index] = { ...updated[index], action: editingPrepText }
                                                    setPrepWork(updated)
                                                    savePrepWork(updated)
                                                    setEditingPrepIndex(null)
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        (e.target as HTMLInputElement).blur()
                                                    }
                                                }}
                                                className="flex-1 bg-transparent border-b border-orange-500/30 focus:border-orange-500 outline-none text-foreground/80"
                                                autoFocus
                                            />
                                        ) : (
                                            <span
                                                onClick={() => { setEditingPrepIndex(index); setEditingPrepText(item.action) }}
                                                className={`flex-1 cursor-pointer ${checkedPrep.has(index) ? 'line-through opacity-50' : item.optional ? 'text-foreground/50' : 'text-foreground/80'}`}
                                            >
                                                {item.ingredient && <span className="font-medium">{item.ingredient}: </span>}
                                                {item.action}
                                                {item.optional && <span className="ml-2 text-[10px] text-orange-500/50 font-semibold uppercase">(optional)</span>}
                                            </span>
                                        )}
                                        {item.timeEstimate && (
                                            <span className="text-xs text-orange-500/60 whitespace-nowrap">
                                                ~{item.timeEstimate} min
                                            </span>
                                        )}
                                        <button
                                            onClick={() => {
                                                const updated = prepWork.filter((_: any, i: number) => i !== index)
                                                setPrepWork(updated)
                                                savePrepWork(updated)
                                                if (editingPrepIndex === index) {
                                                    setEditingPrepIndex(null)
                                                }
                                            }}
                                            className="text-red-400/40 hover:text-red-400 transition-colors p-1"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => {
                                const newItem = { ingredient: '', action: '', timeEstimate: null, isCustom: true }
                                setPrepWork([...prepWork, newItem])
                                setEditingPrepIndex(prepWork.length)
                                setEditingPrepText('')
                            }}
                            className="mt-4 flex items-center gap-2 text-sm text-orange-500/60 hover:text-orange-500"
                        >
                            <Plus size={16} /> Add custom prep work
                        </button>
                    </div>

                    {/* Timing Section */}
                    <div data-section="timers" className="py-14 px-6 sm:px-10 border-0 sm:border-t sm:border-border/10 bg-rose-500/[0.02]">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/10 shadow-sm shadow-rose-500/5">
                                <Clock className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground/90">Timing</h2>
                                <p className="text-[10px] font-bold text-rose-500/60 uppercase tracking-widest mt-1">Key Time Points</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {recipeTime && timeLabelMap[recipeTime] && (
                                <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col items-center text-center">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${timeLabelMap[recipeTime].color} mb-2`}>
                                        {timeLabelMap[recipeTime].icon} {timeLabelMap[recipeTime].label}
                                    </span>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Category</p>
                                </div>
                            )}
                            {totalTimeEstimate > 0 && (
                                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col items-center text-center">
                                    <p className="text-2xl font-black text-foreground/90">{totalTimeEstimate}<span className="text-sm font-semibold text-muted-foreground ml-0.5">min</span></p>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Prep Time</p>
                                </div>
                            )}
                            {instructions.filter((i: any) => i.time).length > 0 && (
                                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col items-center text-center">
                                    <p className="text-2xl font-black text-foreground/90">{instructions.reduce((sum: number, i: any) => sum + (i.time || 0), 0)}<span className="text-sm font-semibold text-muted-foreground ml-0.5">min</span></p>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Cook Time</p>
                                </div>
                            )}
                            {totalTimeEstimate > 0 && instructions.filter((i: any) => i.time).length > 0 && (
                                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col items-center text-center">
                                    <p className="text-2xl font-black text-rose-500">{totalTimeEstimate + instructions.reduce((sum: number, i: any) => sum + (i.time || 0), 0)}<span className="text-sm font-semibold text-rose-500/60 ml-0.5">min</span></p>
                                    <p className="text-[10px] text-rose-500/60 font-bold uppercase tracking-widest">Total</p>
                                </div>
                            )}
                            {recipeServings > 0 && (
                                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col items-center text-center">
                                    <p className="text-2xl font-black text-foreground/90">{recipeServings}</p>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Servings</p>
                                </div>
                            )}
                        </div>

                        {cookingTimers.length > 0 && (
                            <div className="mt-6">
                                <p className="text-xs font-bold text-rose-500/60 uppercase tracking-widest mb-3">Cooking Timers ({cookingTimers.filter((t: any) => t.type === 'timer').length})</p>
                                <div className="flex flex-wrap gap-2">
                                    {cookingTimers.filter((t: any) => t.type === 'timer').map((timer: any) => (
                                        <div key={timer.id} className="px-3 py-2 rounded-xl bg-rose-500/5 border border-rose-500/10 text-sm">
                                            <span className="font-semibold text-foreground/80">{timer.name}</span>
                                            <span className="text-rose-500/60 ml-2">{timer.duration} min</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {instructions.filter((i: any) => i.time).length > 1 && (
                            <div className="mt-6">
                                <p className="text-xs font-bold text-rose-500/60 uppercase tracking-widest mb-3">Step Breakdown</p>
                                <div className="flex flex-wrap gap-2">
                                    {instructions.map((instruction: any, idx: number) => instruction.time ? (
                                        <div key={idx} className="px-3 py-2 rounded-xl bg-rose-500/5 border border-rose-500/10 text-sm">
                                            <span className="font-semibold text-foreground/80">Step {idx + 1}</span>
                                            <span className="text-rose-500/60 ml-2">~{instruction.time} min</span>
                                        </div>
                                    ) : null)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Instructions Section */}
                    {instructions.length > 0 && (
                        <div data-section="instructions" className="py-14 px-6 sm:px-10 border-0 sm:border-t sm:border-border/10 bg-indigo-500/[0.02]">
                            <div className="flex items-center gap-4 mb-10">
                                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 shadow-sm shadow-indigo-500/5">
                                    <ListOrdered className="w-6 h-6 sm:w-8 sm:h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground/90">Instructions</h2>
                                    <p className="text-[10px] font-bold text-indigo-500/60 uppercase tracking-widest mt-1">Step-by-step Process</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-8">
                                {instructions.map((instruction, index) => (
                                    <div key={index} className="flex gap-4 sm:gap-8 group">
                                        <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-indigo-500/5 border border-indigo-500/5 flex items-center justify-center font-black text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 shadow-sm">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 pt-1.5 border-0 sm:border-b sm:border-border/10 pb-8 group-last:border-0">
                                            <div className="flex items-start gap-2">
                                                <p className="flex-1 text-foreground/80 leading-relaxed text-base sm:text-xl font-medium">{instruction.Text}</p>
                                                {instruction.time && (
                                                    <span className="text-xs text-indigo-500/60 whitespace-nowrap mt-1">
                                                        ~{instruction.time} min
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}



                    {/* Feedback & Reflection Section */}
                        <div data-section="feedback" className="py-14 px-6 sm:px-10 border-0 sm:border-t sm:border-border/10 bg-amber-500/[0.02]">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/10 shadow-sm shadow-amber-500/5">
                                    <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground/90">Cooking Reflection</h2>
                                    <p className="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest mt-1">Results & Notes</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 group">
                                    <Button
                                        onClick={() => updateTimesCooked(timesCooked - 1)}
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 w-9 p-0 rounded-full hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                                        disabled={timesCooked <= 0}
                                    >
                                        -
                                    </Button>
                                    <input
                                        type="number"
                                        value={timesCooked}
                                        onChange={(e) => updateTimesCooked(parseInt(e.target.value) || 0)}
                                        className="w-10 text-center bg-transparent font-black text-lg focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Button
                                        onClick={() => updateTimesCooked(timesCooked + 1)}
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 w-9 p-0 rounded-full hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                                    >
                                        +
                                    </Button>
                                </div>
                                <Button
                                    onClick={() => updateTimesCooked(timesCooked + 1)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-11 px-5 rounded-xl flex items-center gap-2.5 transition-all active:scale-95 shadow-md shadow-emerald-500/10"
                                >
                                    <ChefHat size={18} /> <span className="hidden sm:inline">Mark as Cooked</span>
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                onBlur={(e) => saveFeedback(e.target.value)}
                                placeholder="How did it turn out? Any tweaks for next time? (Auto-saves on blur)"
                                className="w-full min-h-[140px] rounded-2xl border border-border/10 bg-secondary px-5 py-4 text-sm focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10 focus:bg-emerald-500/[0.04] transition-all duration-300 resize-none placeholder:text-muted-foreground/30 shadow-inner"
                            />
                            {isSavingFeedback && <div className="text-[10px] font-bold text-emerald-500 animate-pulse text-right pr-2 uppercase tracking-widest">Saving changes...</div>}
                        </div>
                    </div>

                    {/* Nutrients density — TOGGLEABLE & SUBTLE */}
                    <div data-section="nutrients" className="py-10 px-6 sm:px-10 border-0 sm:border-t sm:border-border/10 bg-muted/[0.01]">
                        <button
                            onClick={() => setShowNutrients(!showNutrients)}
                            className="flex items-center gap-2 group text-muted-foreground/60 hover:text-blue-400 transition-all duration-300"
                        >
                            <Sparkles className={`w-4 h-4 transition-transform duration-500 ${showNutrients ? 'rotate-180 scale-110' : ''}`} />
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] group-hover:opacity-100 transition-opacity">
                                Nutritional Density
                            </h2>
                            <span className={`text-[10px] transition-transform duration-300 ${showNutrients ? 'rotate-180' : ''}`}>
                                ▼
                            </span>
                        </button>

                        {showNutrients && (
                            <div className="mt-6 bg-muted/10 backdrop-blur-sm rounded-3xl p-6 border-0 sm:border sm:border-border/20 animate-in fade-in slide-in-from-top-4 duration-500">
                                <IngredientNutrientGraph 
                                    ingredients={matchedListIngreds} 
                                    onLogServe={logRecipeServe} 
                                    logLabel="Log 1 Serve"
                                />
                            </div>
                        )}
                    </div>


                    <input
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept="image/*"
                    />

                    <div className="flex justify-between items-center mt-8 pt-6 border-0 sm:border-t sm:border-border/10">
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
                            maxWidth: '520px',
                            width: '100%',
                            margin: '0 auto',
                            padding: '1.5rem',
                            borderRadius: '1.5rem 1.5rem 0 0',
                            inset: 'auto 0 0 0',
                            height: 'fit-content',
                            maxHeight: '85vh',
                            overflowY: 'auto',
                            boxShadow: '0 -20px 40px rgba(0,0,0,0.4)',
                            borderBottom: 'none',
                            marginBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))'
                        },
                        overlay: {
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 100,
                            display: 'flex',
                            alignItems: 'flex-end',
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
                {isCookingMode && (() => {
                    const stepText = instructions[currentStep]?.Text || ''
                    const { recommended, others } = getRecommendedIngredients(stepText, listIngreds)
                    const { recommended: recommendedPrep } = getRecommendedPrepWork(stepText, prepWork)
                    const relevantPrepCount = recommendedPrep.filter((p: any) => !checkedPrep.has(prepWork.indexOf(p))).length
                    return (
                        <div className="cooking-mode-overlay">
                            <div className="cooking-mode-header">
                                <div className="flex items-center gap-2 flex-1 justify-center">
                                    {instructions.map((_: any, idx: number) => {
                                        const isDone = completedSteps.has(idx)
                                        const isCurrent = idx === currentStep
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentStep(idx)}
                                                className={`w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center ${
                                                    isCurrent
                                                        ? 'bg-white text-black'
                                                        : isDone
                                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                            : 'bg-white/5 text-white/30 border border-white/10 hover:bg-white/10'
                                                }`}
                                            >
                                                {isDone ? '✓' : idx + 1}
                                            </button>
                                        )
                                    })}
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setResetConfirm(true)} className="rounded-full h-10 px-3 text-xs font-bold text-white/40 hover:text-white/70 hover:bg-white/5 gap-1.5">
                                    <RotateCcw size={14} />
                                    Reset
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => { setIsCookingMode(false); setCompletedSteps(new Set()) }} className="rounded-full w-10 h-10 p-0">
                                    <img src="/cross.png" className="w-4 h-4 invert-[.25] dark:invert" alt="close" />
                                </Button>
                            </div>

                            <div className="cooking-mode-layout">
                                {/* Step - central and prominent */}
                                <div className="cooking-mode-step-panel">

                                    {(() => {
                                        const prevStepTimers = cookingTimers.filter((t: any) => t.type === 'timer' && t.stepIndex != null && t.stepIndex < currentStep)
                                        const activePrevTimers = prevStepTimers.filter((t: any) => {
                                            const s = activeSession[t.id]
                                            return s && (s.status === 'active' || s.status === 'paused')
                                        })
                                        const pendingPrevTimers = prevStepTimers.filter((t: any) => {
                                            const s = activeSession[t.id]
                                            return !s || s.status === 'pending'
                                        })
                                        const completedPrevTimers = prevStepTimers.filter((t: any) => {
                                            const s = activeSession[t.id]
                                            return s && s.status === 'completed'
                                        })
                                        if (activePrevTimers.length === 0 && pendingPrevTimers.length === 0 && completedPrevTimers.length === 0) return null

                                        const extendTimer = (timer: any, minutes: number) => {
                                            const newSession = { ...activeSession }
                                            newSession[timer.id] = { endTime: Date.now() + minutes * 60 * 1000, remaining: minutes * 60, status: 'active', checkpointsHit: newSession[timer.id]?.checkpointsHit || [] }
                                            setActiveSession(newSession)
                                        }
                                        const doneTimer = (timer: any) => {
                                            const newSession = { ...activeSession }
                                            newSession[timer.id] = { ...newSession[timer.id], status: 'completed', remaining: 0 }
                                            setActiveSession(newSession)
                                        }

                                        return (
                                            <div className="mb-4 px-2 space-y-2">
                                                {activePrevTimers.map((timer: any) => {
                                                    const session = activeSession[timer.id]
                                                    const remaining = getRemaining(session)
                                                    const total = timer.duration * 60
                                                    const progress = total > 0 ? ((total - remaining) / total) * 100 : 0
                                                    const mins = Math.floor(remaining / 60)
                                                    const secs = remaining % 60
                                                    const endTime = session.endTime ? new Date(session.endTime) : null
                                                    const finishTimeStr = endTime ? endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
                                                    return (
                                                        <div key={timer.id} className="p-3 rounded-2xl bg-blue-500/[0.07] border border-blue-500/15 shadow-sm shadow-blue-500/5">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-wider">
                                                                    Timer for — {timer.name || 'current step'}
                                                                </span>
                                                                <span className="text-base font-bold font-mono text-blue-400 tabular-nums">
                                                                    {remaining > 300 ? `${mins}m` : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
                                                                </span>
                                                            </div>
                                                            {finishTimeStr && (
                                                                <div className="text-[10px] text-white/20 mb-1.5 text-right">Done at {finishTimeStr}</div>
                                                            )}
                                                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000 shadow-sm shadow-blue-500/30"
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                {completedPrevTimers.map((timer: any) => (
                                                    <div key={timer.id} className="p-3 rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/15 shadow-sm shadow-emerald-500/5">
                                                        <div className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider mb-2">
                                                            Timer done — {timer.name || 'current step'}
                                                        </div>
                                                        <div className="flex gap-1.5">
                                                            <button onClick={() => extendTimer(timer, 2)} className="flex-1 py-2 rounded-xl text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/15 hover:border-blue-500/25 transition-all">+2 min</button>
                                                            <button onClick={() => extendTimer(timer, 5)} className="flex-1 py-2 rounded-xl text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/15 hover:border-blue-500/25 transition-all">+5 min</button>
                                                            {customExtendId === timer.id ? (
                                                                <div className="flex items-center gap-1 flex-1">
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        max="999"
                                                                        value={customExtendMin}
                                                                        onChange={(e) => setCustomExtendMin(e.target.value)}
                                                                        placeholder="X"
                                                                        autoFocus
                                                                        className="w-full bg-white/5 rounded-xl px-2 py-1.5 text-[10px] text-[var(--cooking-text)] placeholder:text-white/20 outline-none border border-white/10 focus:border-blue-500/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' && customExtendMin) {
                                                                                extendTimer(timer, parseInt(customExtendMin))
                                                                                setCustomExtendId(null)
                                                                                setCustomExtendMin("")
                                                                            }
                                                                            if (e.key === 'Escape') {
                                                                                setCustomExtendId(null)
                                                                                setCustomExtendMin("")
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        onClick={() => { if (customExtendMin) { extendTimer(timer, parseInt(customExtendMin)); setCustomExtendId(null); setCustomExtendMin("") } }}
                                                                        disabled={!customExtendMin}
                                                                        className="py-1.5 px-2 rounded-xl text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/15 transition-all disabled:opacity-30"
                                                                    >
                                                                        min
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => setCustomExtendId(timer.id)} className="flex-1 py-2 rounded-xl text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/15 hover:border-blue-500/25 transition-all">+X min</button>
                                                            )}
                                                            <button onClick={() => doneTimer(timer)} className="flex-1 py-2 rounded-xl text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/15 hover:border-emerald-500/25 transition-all">Done ✓</button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {pendingPrevTimers.map((timer: any) => (
                                                    <div key={timer.id} className="p-3 rounded-2xl bg-blue-500/[0.04] border border-blue-500/10 border-dashed animate-pulse">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className="text-[10px] font-bold text-blue-400/50 uppercase tracking-wider">
                                                                Timer for — {timer.name || 'current step'}
                                                            </span>
                                                            <span className="text-base font-bold font-mono text-blue-400/50">
                                                                {timer.duration}m
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-gradient-to-r from-blue-600/20 to-blue-400/20 rounded-full" style={{ width: '0%' }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    })()}

                                    {(() => {
                                        const isDone = completedSteps.has(currentStep)
                                        const anyActiveTimer = cookingTimers.some((t: any) => {
                                            if (t.type !== 'timer') return false
                                            const s = activeSession[t.id]
                                            return s && (s.status === 'active' || s.status === 'paused')
                                        })
                                        const currentStepTimersAll = cookingTimers.filter((t: any) => t.type === 'timer' && t.stepIndex === currentStep)
                                        const hasTimers = currentStepTimersAll.length > 0
                                        if (isDone) {
                                            return <div className="mb-3 px-4 py-2.5 rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/15 text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider text-center shadow-sm shadow-emerald-500/5">This step is done</div>
                                        }
                                        if (anyActiveTimer) {
                                            return <div className="mb-3 px-4 py-2.5 rounded-2xl bg-amber-500/[0.07] border border-amber-500/15 text-[10px] font-bold text-amber-400/80 uppercase tracking-wider text-center shadow-sm shadow-amber-500/5">Prepare for this step</div>
                                        }
                                        if (hasTimers) {
                                            return <div className="mb-3 px-4 py-2.5 rounded-2xl bg-blue-500/[0.07] border border-blue-500/15 text-[10px] font-bold text-blue-400/80 uppercase tracking-wider text-center shadow-sm shadow-blue-500/5">Do this step</div>
                                        }
                                        return null
                                    })()}

                                    <div className="cooking-mode-step bg-[var(--cooking-card-bg)] border border-[var(--cooking-border)] rounded-2xl p-6 md:p-10 shadow-xl flex-1 flex flex-col justify-center">
                                        <p className="text-2xl md:text-4xl font-bold leading-relaxed text-center text-[var(--cooking-text)]">
                                            {stepText}
                                        </p>
                                    </div>

                                    {(() => {
                                        const currentStepTimers = cookingTimers.filter((t: any) => t.type === 'timer' && t.stepIndex === currentStep)
                                        const pendingCurrentTimers = currentStepTimers.filter((t: any) => {
                                            const s = activeSession[t.id]
                                            if (s && s.status !== 'pending') return false
                                            const depId = t.dependencies?.[0]?.timerId
                                            if (!depId || depId === 'start') return true
                                            const depSession = activeSession[depId]
                                            return depSession?.status === 'completed'
                                        })
                                        if (pendingCurrentTimers.length === 0) return null

                                        const startTimer = (timer: any) => {
                                            const newSession = { ...activeSession }
                                            newSession[timer.id] = {
                                                endTime: Date.now() + timer.duration * 60 * 1000,
                                                remaining: timer.duration * 60,
                                                status: 'active',
                                                checkpointsHit: []
                                            }
                                            setActiveSession(newSession)

                                            const currentStepTimersAll = cookingTimers.filter((t: any) => t.type === 'timer' && t.stepIndex === currentStep)
                                            const allNowStarted = currentStepTimersAll.every((t: any) => {
                                                if (t.id === timer.id) return true
                                                const s = newSession[t.id]
                                                return s && (s.status === 'active' || s.status === 'paused' || s.status === 'completed')
                                            })
                                            if (allNowStarted && currentStep < (recipe?.instructions?.length || 1) - 1) {
                                                setTimeout(() => {
                                                    setCompletedSteps(prev => new Set([...Array.from(prev), currentStep]))
                                                    setTimerSheetOpen(false)
                                                    setCurrentStep(prev => prev + 1)
                                                }, 800)
                                            }
                                        }

                                        return (
                                            <div className="mt-3 px-2 space-y-2">
                                                {pendingCurrentTimers.map((timer: any) => {
                                                    const isDepMet = !timer.dependencies?.[0]?.timerId || timer.dependencies[0].timerId === 'start' || activeSession[timer.dependencies[0].timerId]?.status === 'completed'
                                                    return (
                                                        <div key={timer.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                                                            <span className="text-xs font-bold text-[var(--cooking-text)]">{timer.name || `Timer ${timer.duration}m`}</span>
                                                            <button
                                                                onClick={() => startTimer(timer)}
                                                                disabled={!isDepMet}
                                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                                                    isDepMet
                                                                        ? 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 hover:border-blue-500/30 shadow-sm shadow-blue-500/10'
                                                                        : 'bg-white/[0.02] text-white/15 border border-white/[0.04] cursor-not-allowed'
                                                                }`}
                                                            >
                                                                Start {timer.duration}m
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })()}
                                </div>

                                {/* Ingredients - scrollable below the step */}
                                <div className="cooking-mode-ingredients-panel">
                                    <h3 className="text-sm font-bold mb-2 flex items-center gap-2 text-[var(--cooking-text)] opacity-70">
                                        <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                        Ingredients
                                    </h3>
                                    <div className="cooking-mode-ingredients-scroll">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                            {recommended.length > 0 && recommended.map((ingred, idx) => (
                                                <div key={`rec-${idx}`} className="cooking-ingredient-card cooking-ingredient-recommended">
                                                    <span className="font-bold text-xs sm:text-sm text-[var(--cooking-text)]">{ingred.name}</span>
                                                    <span className="text-[10px] sm:text-xs font-semibold text-emerald-400 bg-emerald-500/15 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-500/25">
                                                        {ingred.quantity} {ingred.quantity_type_shorthand || ingred.quantity_type}
                                                    </span>
                                                </div>
                                            ))}
                                            {others.map((ingred, idx) => (
                                                <div key={`other-${idx}`} className="cooking-ingredient-card">
                                                    <span className="font-bold text-xs sm:text-sm text-[var(--cooking-text)]">{ingred.name}</span>
                                                    <span className="text-[10px] sm:text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                        {ingred.quantity} {ingred.quantity_type_shorthand || ingred.quantity_type}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
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
                                        const stepTimers = cookingTimers.filter((t: any) => t.type === 'timer' && t.stepIndex === currentStep)
                                        const hasActiveStepTimer = stepTimers.some((t: any) => {
                                            const s = activeSession[t.id]
                                            return s && (s.status === 'active' || s.status === 'paused')
                                        })
                                        if (currentStep < instructions.length - 1) {
                                            if (!hasActiveStepTimer) {
                                                setCompletedSteps(prev => new Set([...Array.from(prev), currentStep]))
                                            }
                                            setCurrentStep(currentStep + 1)
                                        } else {
                                            if (!hasActiveStepTimer) {
                                                setCompletedSteps(prev => new Set([...Array.from(prev), currentStep]))
                                            }
                                            const hasActive = Object.values(activeSession).some((s: any) => s.status === 'active' || s.status === 'paused')
                                            if (hasActive || customTimers.length > 0) {
                                                setFinishConfirm(true)
                                            } else {
                                                setIsCookingMode(false)
                                                setCurrentStep(0)
                                                setCompletedSteps(new Set())
                                            }
                                        }
                                    }}
                                >
                                    {currentStep === instructions.length - 1 ? "🎉 Finish!" : "Next Step →"}
                                </Button>
                            </div>

                            {/* Prep Work Bottom Sheet */}
                            {prepWork.length > 0 && (
                                <>
                                    <div className="prep-sheet-tab" onClick={() => setPrepSheetOpen(!prepSheetOpen)}>
                                        <div className="relative flex items-center gap-2">
                                            <ChefHat size={16} className="text-orange-400" />
                                            <span className="text-sm font-bold text-[var(--cooking-text)]">Prep</span>
                                            {relevantPrepCount > 0 && (
                                                <span className="prep-sheet-badge">{relevantPrepCount}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`prep-sheet-panel ${prepSheetOpen ? 'open' : ''}`}>
                                        <div className="prep-sheet-handle" onClick={() => setPrepSheetOpen(false)} />
                                        <div className="flex items-center justify-between px-6 mb-3">
                                            <h3 className="text-sm font-bold text-[var(--cooking-text)]">Prep Work</h3>
                                            <button onClick={() => setPrepSheetOpen(false)} className="text-xs text-orange-400/60 hover:text-orange-400">Close</button>
                                        </div>
                                        <div className="prep-sheet-scroll">
                                            <div className="space-y-2">
                                                {prepWork.map((item, index) => {
                                                    const isRecommended = recommendedPrep.some((r: any) => r.action === item.action && r.ingredient === item.ingredient)
                                                    return (
                                                        <div key={index} className={`prep-item ${isRecommended ? 'recommended' : ''} ${checkedPrep.has(index) ? 'checked' : ''}`}>
                                                            <button
                                                                onClick={() => {
                                                                    const next = new Set(checkedPrep)
                                                                    if (next.has(index)) next.delete(index)
                                                                    else next.add(index)
                                                                    setCheckedPrep(next)
                                                                }}
                                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 mt-0.5 ${
                                                                    checkedPrep.has(index)
                                                                        ? 'bg-orange-500 border-orange-500 text-white'
                                                                        : 'border-orange-500/30 hover:border-orange-500'
                                                                }`}
                                                            >
                                                                {checkedPrep.has(index) && <Check size={12} />}
                                                            </button>
                                                            <span className="prep-item-text text-sm text-[var(--cooking-text)] flex-1">
                                                                {item.ingredient && <span className="font-medium">{item.ingredient}: </span>}
                                                                {item.action}
                                                            </span>
                                                            {item.timeEstimate && (
                                                                <span className="text-[10px] text-orange-400/50 shrink-0">~{item.timeEstimate}m</span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Timers Bottom Sheet */}
                            {(cookingTimers.filter((t: any) => t.type === 'timer').length > 0 || customTimers.length > 0) && (
                                <>
                                    <div
                                        className="timer-sheet-tab"
                                        onClick={() => {
                                            setTimerSheetOpen(!timerSheetOpen)
                                            setPrepSheetOpen(false)
                                        }}
                                    >
                                        <div className="relative flex items-center gap-2">
                                            <Clock size={16} className="text-blue-400" />
                                            <span className="text-sm font-bold text-[var(--cooking-text)]">Timers</span>
                                            {Object.values(activeSession).filter((t: any) => t.status === 'active').length > 0 && (
                                                <span className="timer-sheet-badge">{Object.values(activeSession).filter((t: any) => t.status === 'active').length}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`timer-sheet-panel ${timerSheetOpen ? 'open' : ''}`}>
                                        <div className="timer-sheet-handle" onClick={() => setTimerSheetOpen(false)} />
                                        <div className="flex items-center justify-between px-6 mb-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                                            <Clock size={16} className="text-blue-400" />
                                                </div>
                                                <h3 className="text-sm font-bold text-[var(--cooking-text)]">Cooking Timers</h3>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => {
                                                        const newSession: Record<string, { endTime: number | null; remaining: number; status: string; checkpointsHit: string[] }> = {}
                                                        cookingTimers.filter((t: any) => t.type === 'timer').forEach((t: any) => {
                                                            newSession[t.id] = { endTime: null, remaining: t.duration * 60, status: 'pending', checkpointsHit: [] }
                                                        })
                                                        customTimers.forEach((t) => {
                                                            newSession[t.id] = { endTime: null, remaining: t.duration * 60, status: 'pending', checkpointsHit: [] }
                                                        })
                                                        setActiveSession(newSession)
                                                    }}
                                                    className="text-xs text-blue-400/50 hover:text-blue-400 transition-colors"
                                                >
                                                    Reset All
                                                </button>
                                                <button onClick={() => setTimerSheetOpen(false)} className="text-xs text-white/30 hover:text-white/60 transition-colors">Close</button>
                                            </div>
                                        </div>
                                        <div className="timer-sheet-scroll">
                                            <div className="space-y-3">
                                                {(() => {
                                                    const allTimers = sortTimersByStartTime(cookingTimers.filter((t: any) => t.type === 'timer'))
                                                    const relevant = allTimers.filter((t: any) => {
                                                        const session = activeSession[t.id]
                                                        const status = session?.status || 'pending'
                                                        if (status === 'completed') return false
                                                        if (status === 'active' || status === 'paused') return true
                                                        if (t.stepIndex != null && t.stepIndex <= currentStep) return true
                                                        if (t.stepIndex == null) return true
                                                        return false
                                                    })
                                                    const completed = allTimers.filter((t: any) => {
                                                        const session = activeSession[t.id]
                                                        return session?.status === 'completed'
                                                    })
                                                    return (
                                                        <>
                                                            {relevant.map((timer) => {
                                                                const session = activeSession[timer.id]
                                                                const status = session?.status || 'pending'
                                                                const remaining = session ? getRemaining(session) : timer.duration * 60
                                                                const minutes = Math.floor(remaining / 60)
                                                                const seconds = remaining % 60
                                                                const totalSeconds = timer.duration * 60
                                                                const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0
                                                                const checkpoints = cookingTimers.filter((t: any) => t.parentTimerId === timer.id && t.type === 'checkpoint')
                                                                const startTime = calculateTimerStartTime(cookingTimers, timer)
                                                                const checkpointsHit = session?.checkpointsHit || []

                                                                return (
                                                                    <div key={timer.id} className={`timer-card ${status}`}>
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <span className="font-bold text-sm text-[var(--cooking-text)]">{timer.name}</span>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                                                    status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                                                                                    status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                                                                                    'bg-white/5 text-white/30'
                                                                                }`}>
                                                                                    {status === 'active' ? 'RUNNING' : status === 'paused' ? 'PAUSED' : 'PENDING'}
                                                                                </span>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const newSession = { ...activeSession }
                                                                                        newSession[timer.id] = { endTime: null, remaining: timer.duration * 60, status: 'pending', checkpointsHit: [] }
                                                                                        setActiveSession(newSession)
                                                                                    }}
                                                                                    className="text-[10px] text-white/30 hover:text-blue-400 transition-colors px-1"
                                                                                    title="Reset timer"
                                                                                >
                                                                                    Reset
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        {(status === 'active' || status === 'paused') && (
                                                                            <>
                                                                                {editingTimerId === timer.id ? (
                                                                                    <div className="my-4 p-3 rounded-xl bg-white/5 border border-white/10">
                                                                                        <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-2 text-center">Adjust Timer</p>
                                                                                        <div className="flex items-center justify-center gap-2">
                                                                                            <input
                                                                                                type="number"
                                                                                                min="0"
                                                                                                max="999"
                                                                                                value={editTimerMinutes}
                                                                                                onChange={(e) => setEditTimerMinutes(e.target.value)}
                                                                                                className="w-16 bg-white/10 rounded-lg px-2 py-2 text-center text-lg font-bold text-[var(--cooking-text)] outline-none border border-white/10 focus:border-blue-500/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                                placeholder="00"
                                                                                            />
                                                                                            <span className="text-lg font-bold text-white/30">:</span>
                                                                                            <input
                                                                                                type="number"
                                                                                                min="0"
                                                                                                max="59"
                                                                                                value={editTimerSeconds}
                                                                                                onChange={(e) => setEditTimerSeconds(e.target.value)}
                                                                                                className="w-16 bg-white/10 rounded-lg px-2 py-2 text-center text-lg font-bold text-[var(--cooking-text)] outline-none border border-white/10 focus:border-blue-500/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                                placeholder="00"
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex gap-2 mt-3">
                                                                                            <button
                                                                                                onClick={() => setEditingTimerId(null)}
                                                                                                className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-white/40 transition-all"
                                                                                            >
                                                                                                Cancel
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const mins = parseInt(editTimerMinutes) || 0
                                                                                                    const secs = parseInt(editTimerSeconds) || 0
                                                                                                    const totalSecs = mins * 60 + secs
                                                                                                    if (totalSecs <= 0) return
                                                                                                    const newSession = { ...activeSession }
                                                                                                    newSession[timer.id] = {
                                                                                                        endTime: Date.now() + totalSecs * 1000,
                                                                                                        remaining: totalSecs,
                                                                                                        status: 'active',
                                                                                                        checkpointsHit: session.checkpointsHit || []
                                                                                                    }
                                                                                                    setActiveSession(newSession)
                                                                                                    setEditingTimerId(null)
                                                                                                }}
                                                                                                className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-all"
                                                                                            >
                                                                                                Save
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div
                                                                                        className="timer-countdown text-center my-4 cursor-pointer hover:opacity-70 transition-opacity"
                                                                                        title="Tap to edit time"
                                                                                        onClick={() => {
                                                                                            setEditingTimerId(timer.id)
                                                                                            setEditTimerMinutes(String(minutes))
                                                                                            setEditTimerSeconds(String(seconds))
                                                                                        }}
                                                                                    >
                                                                                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                                                                                        <div className="text-[9px] text-white/20 mt-0.5 uppercase tracking-wider">tap to edit</div>
                                                                                    </div>
                                                                                )}
                                                                                <div className="timer-progress mb-1">
                                                                                    <div className="timer-progress-fill" style={{ width: `${progress}%` }} />
                                                                                    {checkpoints.map((ckpt: any) => {
                                                                                        const ckptOffset = ckpt.dependencies?.[0]?.offset || 0
                                                                                        const ckptPercent = totalSeconds > 0 ? (ckptOffset / timer.duration / 60 * 100) : 0
                                                                                        const isHit = checkpointsHit.includes(ckpt.id)
                                                                                        return (
                                                                                            <div
                                                                                                key={ckpt.id}
                                                                                                className={`timer-checkpoint-marker ${isHit ? 'reached' : ''}`}
                                                                                                style={{ left: `${ckptPercent}%` }}
                                                                                                title={ckpt.name}
                                                                                            />
                                                                                        )
                                                                                    })}
                                                                                </div>
                                                                                {checkpoints.length > 0 && (
                                                                                    <div className="flex justify-between mt-1 mb-2 px-1">
                                                                                        {checkpoints.map((ckpt: any) => {
                                                                                            const ckptOffset = ckpt.dependencies?.[0]?.offset || 0
                                                                                            const isHit = checkpointsHit.includes(ckpt.id)
                                                                                            return (
                                                                                                <span key={ckpt.id} className={`text-[10px] ${isHit ? 'text-emerald-400 font-bold' : 'text-white/35'}`}>
                                                                                                    {ckpt.name} ({ckptOffset}m)
                                                                                                </span>
                                                                                            )
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                                <div className="flex gap-2 mt-3">
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const newSession = { ...activeSession }
                                                                                            if (session.status === 'active') {
                                                                                                const rem = getRemaining(session)
                                                                                                newSession[timer.id] = { endTime: null, remaining: rem, status: 'paused', checkpointsHit: session.checkpointsHit }
                                                                                            } else {
                                                                                                newSession[timer.id] = { endTime: Date.now() + session.remaining * 1000, remaining: session.remaining, status: 'active', checkpointsHit: session.checkpointsHit }
                                                                                            }
                                                                                            setActiveSession(newSession)
                                                                                        }}
                                                                                        className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-[var(--cooking-text)] border border-white/5 hover:border-white/10 transition-all"
                                                                                    >
                                                                                        {session.status === 'active' ? 'Pause' : 'Resume'}
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const newSession = { ...activeSession }
                                                                                            if (session.status === 'active') {
                                                                                                newSession[timer.id] = { ...session, endTime: (session.endTime || Date.now()) + 300000 }
                                                                                            } else {
                                                                                                newSession[timer.id] = { ...session, remaining: session.remaining + 300 }
                                                                                            }
                                                                                            setActiveSession(newSession)
                                                                                        }}
                                                                                        className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-[var(--cooking-text)] border border-white/5 hover:border-white/10 transition-all"
                                                                                    >
                                                                                        +5 min
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const newSession = { ...activeSession }
                                                                                            newSession[timer.id] = { endTime: null, remaining: 0, status: 'completed', checkpointsHit: session.checkpointsHit }
                                                                                            setActiveSession(newSession)
                                                                                        }}
                                                                                        className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 transition-all"
                                                                                    >
                                                                                        Done
                                                                                    </button>
                                                                                </div>
                                                                            </>
                                                                        )}

                                                                        {status === 'pending' && (() => {
                                                                            const hasDep = timer.dependencies?.[0]?.timerId && timer.dependencies[0].timerId !== 'start'
                                                                            const depTimerId = hasDep ? timer.dependencies[0].timerId : null
                                                                            const depSession = depTimerId ? activeSession[depTimerId] : null
                                                                            const depDone = depSession?.status === 'completed'
                                                                            const isPastStep = timer.stepIndex != null && timer.stepIndex < currentStep
                                                                            const isLocked = hasDep && !depDone

                                                                            return (
                                                                                <div className="mt-1">
                                                                                    <div className="flex items-center gap-2 mb-2">
                                                                                        {isLocked ? (
                                                                                            <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                                                                                                Waiting for {getTimerById(cookingTimers, depTimerId)?.name || 'previous'}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-white/40 text-xs">
                                                                                                Starts at +{startTime} min
                                                                                            </span>
                                                                                        )}
                                                                                        {hasDep && !isLocked && (
                                                                                            <span className="text-[10px] text-emerald-400/40 bg-emerald-500/5 px-1.5 py-0.5 rounded">
                                                                                                ready
                                                                                            </span>
                                                                                        )}
                                                                                        {timer.stepIndex != null && (
                                                                                            <span className="text-[10px] text-blue-400/40 bg-blue-500/5 px-1.5 py-0.5 rounded">
                                                                                                Step {(timer.stepIndex ?? 0) + 1}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    {isPastStep ? (
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                const newSession = { ...activeSession }
                                                                                                newSession[timer.id] = { endTime: null, remaining: 0, status: 'completed', checkpointsHit: [] }
                                                                                                setActiveSession(newSession)
                                                                                            }}
                                                                                            className="w-full py-2 rounded-lg text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400/70 border border-emerald-500/15 hover:border-emerald-500/25 transition-all"
                                                                                        >
                                                                                            ✓ Mark Complete
                                                                                        </button>
                                                                                    ) : isLocked ? (
                                                                                        <button
                                                                                            disabled
                                                                                            className="w-full py-2 rounded-lg text-xs font-bold bg-white/[0.02] text-white/15 border border-white/[0.04] cursor-not-allowed"
                                                                                        >
                                                                                            Start {timer.duration}m Timer
                                                                                        </button>
                                                                                    ) : (
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                const newSession = { ...activeSession }
                                                                                                newSession[timer.id] = {
                                                                                                    endTime: Date.now() + timer.duration * 60 * 1000,
                                                                                                    remaining: timer.duration * 60,
                                                                                                    status: 'active',
                                                                                                    checkpointsHit: []
                                                                                                }
                                                                                                setActiveSession(newSession)
                                                                                            }}
                                                                                            className="w-full py-2 rounded-lg text-xs font-bold bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 hover:border-blue-500/30 transition-all"
                                                                                        >
                                                                                            Start {timer.duration}m Timer
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        })()}
                                                                    </div>
                                                                )
                                                            })}

                                                            {/* Completed timers - collapsed */}
                                                            {completed.length > 0 && (
                                                                <div className="mt-3">
                                                                    <div className="flex items-center gap-2 px-1 mb-2">
                                                                        <div className="flex-1 h-px bg-white/5"></div>
                                                                        <span className="text-[10px] text-white/25 uppercase tracking-wider font-medium">Completed ({completed.length})</span>
                                                                        <div className="flex-1 h-px bg-white/5"></div>
                                                                    </div>
                                                                    {completed.map((timer) => (
                                                                        <div key={timer.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.03]">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></div>
                                                                                <span className="text-xs text-white/40 line-through">{timer.name}</span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newSession = { ...activeSession }
                                                                                    newSession[timer.id] = { endTime: null, remaining: timer.duration * 60, status: 'pending', checkpointsHit: [] }
                                                                                    setActiveSession(newSession)
                                                                                }}
                                                                                className="text-[10px] text-blue-400/40 hover:text-blue-400 transition-colors"
                                                                            >
                                                                                Restart
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    )
                                                })()}

                                                {/* Custom timers (session-only) */}
                                                {customTimers.length > 0 && (
                                                    <div className="mt-4">
                                                        <div className="flex items-center gap-2 px-1 mb-3">
                                                            <div className="flex-1 h-px bg-white/5"></div>
                                                            <span className="text-[10px] text-white/25 uppercase tracking-wider font-medium">Custom Timers</span>
                                                            <div className="flex-1 h-px bg-white/5"></div>
                                                        </div>
                                                        {customTimers.map((timer) => {
                                                            const session = activeSession[timer.id]
                                                            const status = session?.status || 'pending'
                                                            const remaining = session ? getRemaining(session) : timer.duration * 60
                                                            const minutes = Math.floor(remaining / 60)
                                                            const seconds = remaining % 60
                                                            const totalSeconds = timer.duration * 60
                                                            const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0

                                                            return (
                                                                <div key={timer.id} className={`timer-card ${status} mb-3`}>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-sm text-[var(--cooking-text)]">{timer.name}</span>
                                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-white/25 uppercase tracking-wider">
                                                                                Custom
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                                status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                                                                                status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                                status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                                                                                'bg-white/5 text-white/30'
                                                                            }`}>
                                                                                {status === 'active' ? 'RUNNING' : status === 'completed' ? 'DONE' : status === 'paused' ? 'PAUSED' : 'PENDING'}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newSession = { ...activeSession }
                                                                                    newSession[timer.id] = { endTime: null, remaining: timer.duration * 60, status: 'pending', checkpointsHit: [] }
                                                                                    setActiveSession(newSession)
                                                                                }}
                                                                                className="text-[10px] text-white/30 hover:text-blue-400 transition-colors px-1"
                                                                                title="Reset timer"
                                                                            >
                                                                                Reset
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setCustomTimers(prev => prev.filter(t => t.id !== timer.id))
                                                                                    const newSession = { ...activeSession }
                                                                                    delete newSession[timer.id]
                                                                                    setActiveSession(newSession)
                                                                                }}
                                                                                className="text-[10px] text-white/30 hover:text-red-400 transition-colors px-1"
                                                                                title="Remove custom timer"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {(status === 'active' || status === 'paused') && (
                                                                        <>
                                                                            <div className="timer-countdown text-center my-3">
                                                                                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                                                                            </div>
                                                                            <div className="timer-progress">
                                                                                <div className="timer-progress-fill" style={{ width: `${progress}%` }} />
                                                                            </div>
                                                                            <div className="flex gap-2 mt-3">
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const newSession = { ...activeSession }
                                                                                        if (session.status === 'active') {
                                                                                            const rem = getRemaining(session)
                                                                                            newSession[timer.id] = { endTime: null, remaining: rem, status: 'paused', checkpointsHit: session.checkpointsHit }
                                                                                        } else {
                                                                                            newSession[timer.id] = { endTime: Date.now() + session.remaining * 1000, remaining: session.remaining, status: 'active', checkpointsHit: session.checkpointsHit }
                                                                                        }
                                                                                        setActiveSession(newSession)
                                                                                    }}
                                                                                    className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-[var(--cooking-text)] border border-white/5 hover:border-white/10 transition-all"
                                                                                >
                                                                                    {session.status === 'active' ? 'Pause' : 'Resume'}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const newSession = { ...activeSession }
                                                                                        if (session.status === 'active') {
                                                                                            newSession[timer.id] = { ...session, endTime: (session.endTime || Date.now()) + 300000 }
                                                                                        } else {
                                                                                            newSession[timer.id] = { ...session, remaining: session.remaining + 300 }
                                                                                        }
                                                                                        setActiveSession(newSession)
                                                                                    }}
                                                                                    className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-[var(--cooking-text)] border border-white/5 hover:border-white/10 transition-all"
                                                                                >
                                                                                    +5 min
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const newSession = { ...activeSession }
                                                                                        newSession[timer.id] = { endTime: null, remaining: 0, status: 'completed', checkpointsHit: session.checkpointsHit }
                                                                                        setActiveSession(newSession)
                                                                                    }}
                                                                                    className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 transition-all"
                                                                                >
                                                                                    Done
                                                                                </button>
                                                                            </div>
                                                                        </>
                                                                    )}

                                                                    {status === 'completed' && (
                                                                        <div className="py-2 space-y-2">
                                                                            <div className="flex items-center justify-center gap-2">
                                                                                <span className="text-emerald-400 text-xs font-bold">Timer done</span>
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const newSession = { ...activeSession }
                                                                                        newSession[timer.id] = { endTime: Date.now() + 2 * 60 * 1000, remaining: 2 * 60, status: 'active', checkpointsHit: session?.checkpointsHit || [] }
                                                                                        setActiveSession(newSession)
                                                                                    }}
                                                                                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 transition-all"
                                                                                >
                                                                                    +2 min
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const newSession = { ...activeSession }
                                                                                        newSession[timer.id] = { endTime: Date.now() + 5 * 60 * 1000, remaining: 5 * 60, status: 'active', checkpointsHit: session?.checkpointsHit || [] }
                                                                                        setActiveSession(newSession)
                                                                                    }}
                                                                                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 transition-all"
                                                                                >
                                                                                    +5 min
                                                                                </button>
                                                                                {customExtendId === timer.id ? (
                                                                                    <div className="flex items-center gap-1 flex-1">
                                                                                        <input
                                                                                            type="number"
                                                                                            min="1"
                                                                                            max="999"
                                                                                            value={customExtendMin}
                                                                                            onChange={(e) => setCustomExtendMin(e.target.value)}
                                                                                            placeholder="X"
                                                                                            autoFocus
                                                                                            className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-[10px] text-[var(--cooking-text)] placeholder:text-white/20 outline-none border border-white/10 focus:border-amber-500/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                            onKeyDown={(e) => {
                                                                                                if (e.key === 'Enter' && customExtendMin) {
                                                                                                    const newSession = { ...activeSession }
                                                                                                    newSession[timer.id] = { endTime: Date.now() + parseInt(customExtendMin) * 60 * 1000, remaining: parseInt(customExtendMin) * 60, status: 'active', checkpointsHit: session?.checkpointsHit || [] }
                                                                                                    setActiveSession(newSession)
                                                                                                    setCustomExtendId(null)
                                                                                                    setCustomExtendMin("")
                                                                                                }
                                                                                                if (e.key === 'Escape') {
                                                                                                    setCustomExtendId(null)
                                                                                                    setCustomExtendMin("")
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                if (customExtendMin) {
                                                                                                    const newSession = { ...activeSession }
                                                                                                    newSession[timer.id] = { endTime: Date.now() + parseInt(customExtendMin) * 60 * 1000, remaining: parseInt(customExtendMin) * 60, status: 'active', checkpointsHit: session?.checkpointsHit || [] }
                                                                                                    setActiveSession(newSession)
                                                                                                    setCustomExtendId(null)
                                                                                                    setCustomExtendMin("")
                                                                                                }
                                                                                            }}
                                                                                            disabled={!customExtendMin}
                                                                                            className="py-1.5 px-2 rounded-lg text-[10px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 transition-all disabled:opacity-30"
                                                                                        >
                                                                                            min
                                                                                        </button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <button
                                                                                        onClick={() => setCustomExtendId(timer.id)}
                                                                                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 transition-all"
                                                                                    >
                                                                                        +X min
                                                                                    </button>
                                                                                )}
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const newSession = { ...activeSession }
                                                                                        newSession[timer.id] = { ...newSession[timer.id], status: 'completed', remaining: 0 }
                                                                                        setActiveSession(newSession)
                                                                                    }}
                                                                                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 transition-all"
                                                                                >
                                                                                    Done ✓
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {status === 'pending' && (
                                                                        <div className="text-center py-2">
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newSession = { ...activeSession }
                                                                                    newSession[timer.id] = {
                                                                                        endTime: Date.now() + timer.duration * 60 * 1000,
                                                                                        remaining: timer.duration * 60,
                                                                                        status: 'active',
                                                                                        checkpointsHit: []
                                                                                    }
                                                                                    setActiveSession(newSession)
                                                                                }}
                                                                                className="w-full py-2 rounded-lg text-xs font-bold bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 hover:border-blue-500/30 transition-all"
                                                                            >
                                                                                Start {timer.duration}m Timer
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}

                                                {/* Add custom timer */}
                                                <div className="mt-5 p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
                                                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-3">Add Custom Timer</p>
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={customTimerName}
                                                            onChange={(e) => setCustomTimerName(e.target.value)}
                                                            placeholder="Name"
                                                            className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-xs text-[var(--cooking-text)] placeholder:text-white/20 outline-none border border-white/10 focus:border-blue-500/40 transition-colors"
                                                        />
                                                        <input
                                                            type="number"
                                                            value={customTimerMinutes}
                                                            onChange={(e) => setCustomTimerMinutes(e.target.value)}
                                                            placeholder="Min"
                                                            className="w-16 bg-white/5 rounded-lg px-3 py-2 text-xs text-[var(--cooking-text)] placeholder:text-white/20 outline-none border border-white/10 focus:border-blue-500/40 text-center transition-colors"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                const mins = parseInt(customTimerMinutes)
                                                                if (!customTimerName.trim() || !mins || mins <= 0) return
                                                                const newId = `custom-${Date.now()}`
                                                                const newTimer = { id: newId, name: customTimerName.trim(), duration: mins }
                                                                setCustomTimers(prev => [...prev, newTimer])
                                                                setActiveSession(prev => ({
                                                                    ...prev,
                                                                    [newId]: { endTime: Date.now() + mins * 60 * 1000, remaining: mins * 60, status: 'active', checkpointsHit: [] }
                                                                }))
                                                                setCustomTimerName("")
                                                                setCustomTimerMinutes("")
                                                            }}
                                                            className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 hover:border-blue-500/30 transition-all"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )
                })()}

            {/* Finish Cooking Confirmation */}
            {finishConfirm && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-card border border-border/20 rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
                        <h3 className="text-lg font-bold mb-2">Finish Cooking?</h3>
                        <p className="text-sm text-foreground/60 mb-4">
                            You have active timers. Are you sure you want to finish?
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setFinishConfirm(false)}
                            >
                                Keep Cooking
                            </Button>
                            <Button
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                                onClick={() => {
                                    setFinishConfirm(false)
                                    setActiveSession({})
                                    setCustomTimers([])
                                    if (id) {
                                        const keys = Object.keys(localStorage).filter(k => k.startsWith('timer-session-'))
                                        keys.forEach(k => localStorage.removeItem(k))
                                    }
                                    setIsCookingMode(false)
                                    setCurrentStep(0)
                                    setCompletedSteps(new Set())
                                }}
                            >
                                Finish & Reset
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {resetConfirm && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-card border border-border/20 rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
                        <h3 className="text-lg font-bold mb-2">Reset All?</h3>
                        <p className="text-sm text-foreground/60 mb-4">
                            This will clear all timers, completed steps, and go back to step 1.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setResetConfirm(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                                onClick={() => {
                                    setResetConfirm(false)
                                    setActiveSession({})
                                    setCustomTimers([])
                                    if (id) {
                                        const keys = Object.keys(localStorage).filter(k => k.startsWith('timer-session-'))
                                        keys.forEach(k => localStorage.removeItem(k))
                                    }
                                    setCurrentStep(0)
                                    setCompletedSteps(new Set())
                                }}
                            >
                                Reset All
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clear Residual Timers Prompt */}
            {clearResidualPrompt.show && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-card border border-border/20 rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
                        <h3 className="text-lg font-bold mb-2">Active Timers Found</h3>
                        <p className="text-sm text-foreground/60 mb-4">
                            You have active timers from another session. Would you like to clear them and start fresh?
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setClearResidualPrompt({ show: false, recipeName: '', recipeId: '' })}
                            >
                                Keep Them
                            </Button>
                            <Button
                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                                onClick={() => {
                                    const keys = Object.keys(localStorage).filter(k => k.startsWith('timer-session-'))
                                    keys.forEach(k => localStorage.removeItem(k))
                                    setActiveSession({})
                                    setCustomTimers([])
                                    setClearResidualPrompt({ show: false, recipeName: '', recipeId: '' })
                                }}
                            >
                                Clear All
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </Layout>
    )
}
