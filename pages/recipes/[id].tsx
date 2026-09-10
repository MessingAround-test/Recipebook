import { Layout } from '../../components/Layout'
import { useEffect, useState, useRef, useMemo, Fragment } from 'react'
import { Button } from '../../components/ui/button'
import { Clock, Trash2, ChefHat, Check, ChevronRight, ChevronLeft, ChevronUp, Loader2, ShoppingBasket, ListOrdered, MessageSquare, Sparkles, Plus, Eye, EyeOff, RotateCcw, RefreshCw, Pencil, Slice, Users, Download } from 'lucide-react'
import { buildRecipeExport, downloadRecipeFile, fetchImageAsDataUrl } from '../../lib/recipeFile'
import Router, { useRouter } from 'next/router'
import IngredientNutrientGraph from '../../components/IngredientNutrientGraph'
import IngredientCard from '../../components/IngredientCard'
import { IngredientSearchList } from '../../components/IngredientSearchList'
import Modal from 'react-modal'

const PRICE_THRESHOLDS = { cheap: 15, expensive: 35 }

const timeLabelMap: Record<string, { label: string }> = {
    short: { label: 'Quick' },
    medium: { label: 'Medium' },
    long: { label: 'Slow Cook' }
}

const priceLabelMap: Record<string, { label: string }> = {
    cheap: { label: '$ Cheap' },
    medium: { label: '$$ Mid-range' },
    expensive: { label: '$$$ Pricey' }
}

// Metadata chips are deliberately neutral — colour is reserved for state
// (active nav, primary CTA, live timers). One accent, everything else calm.
const CHIP_META = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary text-foreground/80 border border-border/40'
// Grey scrim + white text: sits over the hero image on phones, same treatment
// as the "Change Image" badge so both read as one overlay system
const CHIP_OVERLAY = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 text-white backdrop-blur-sm'
// Category chips are a desktop-only nicety — mobile skips them entirely.
const CHIP_META_DESKTOP = `${CHIP_META} hidden sm:inline-flex`

function getPriceCategory(cost: number): 'cheap' | 'medium' | 'expensive' {
    if (cost < PRICE_THRESHOLDS.cheap) return 'cheap'
    if (cost <= PRICE_THRESHOLDS.expensive) return 'medium'
    return 'expensive'
}

const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function getIngredientSnapshot(ingreds: any[]) {
    return ingreds.map(i => ({ name: i.name, quantity: i.quantity, quantity_type: i.quantity_type, note: i.note }))
}

function computePrepNotesHash(ingreds: any[]) {
    return (ingreds || [])
        .map(i => `${String(i.name || '').trim()}::${String(i.note || '').trim()}`)
        .join('|')
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
                cachedSnapshot[i].quantity_type !== currentSnapshot[i].quantity_type ||
                cachedSnapshot[i].note !== currentSnapshot[i].note) {
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

// Whole-word/prefix token match — avoids substring false positives like
// "heat" matching inside "wheat" or "oil" inside "boil". A short word can
// only match when the longer one starts with it (plural/stem forms).
function wordMatches(a: string, b: string): boolean {
    if (a === b) return true
    if (a.length < 3 || b.length < 3) return false
    return a.startsWith(b) || b.startsWith(a)
}

function getRecommendedIngredients(stepText: string, ingredients: any[]): { recommended: any[]; others: any[] } {
    const stepWords = stepText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))

    const scored = ingredients.map(ing => {
        const nameWords = ing.name.toLowerCase().split(/\s+/)
        const score = nameWords.filter(nw => stepWords.some(sw => wordMatches(nw, sw))).length
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
        const score = nameWords.filter((nw: string) => stepWords.some(sw => wordMatches(nw, sw))).length
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

function timersDependingOn(timers: any[], timerId: string): Set<string> {
    const dependents = new Set<string>([timerId])
    let changed = true
    while (changed) {
        changed = false
        for (const t of timers) {
            if (dependents.has(t.id)) continue
            if ((t.dependencies || []).some((d: any) => dependents.has(d.timerId))) {
                dependents.add(t.id)
                changed = true
            }
        }
    }
    return dependents
}

type FlowItem = { kind: 'prep' | 'step'; stepIndex: number; flowIndex: number }

// The cooking flow: an optional prep run-through first (only when the recipe
// has prep work), then the instruction steps. Timers attach to their step as a
// poke-out tab underneath the card instead of being flow items.
function buildFlowItems(instructions: any[], prepWork: any[]): FlowItem[] {
    const items: FlowItem[] = []
    if ((prepWork || []).length > 0) {
        items.push({ kind: 'prep', stepIndex: -1, flowIndex: items.length })
    }
    ;(instructions || []).forEach((_: any, i: number) => {
        items.push({ kind: 'step', stepIndex: i, flowIndex: items.length })
    })
    return items
}

// Step index for each item of the OLD timer-interleaved flow — used only to
// migrate sessions saved by the previous layout to step indices.
function legacyFlowStepIndices(instructions: any[], cookingTimers: any[]): number[] {
    const out: number[] = []
    const timerCounts: Record<number, number> = {}
    ;(cookingTimers || []).forEach((t: any) => {
        if (t.type !== 'timer') return
        const si = typeof t.stepIndex === 'number' ? Math.max(0, t.stepIndex) : 0
        timerCounts[si] = (timerCounts[si] || 0) + 1
    })
    for (let i = 0; i < (instructions || []).length; i++) {
        out.push(i)
        for (let n = 0; n < (timerCounts[i] || 0); n++) out.push(i)
    }
    return out
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
    const [currentFlow, setCurrentFlow] = useState(0)

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
    const [isExporting, setIsExporting] = useState(false)

    // Prep work state
    const [prepWork, setPrepWork] = useState<any[]>([])
    const [checkedPrep, setCheckedPrep] = useState<Set<number>>(new Set())
    const [editingPrepIndex, setEditingPrepIndex] = useState<number | null>(null)
    const [editingPrepText, setEditingPrepText] = useState("")
    const [isExtractingPrep, setIsExtractingPrep] = useState(false)
    const hasCheckedPrepRef = useRef(false)
    const prepNotesHashRef = useRef<string | null>(null)

    // Add to shopping list modal
    const [shopModalOpen, setShopModalOpen] = useState(false)
    const [shoppingLists, setShoppingLists] = useState<any[]>([])
    const [shopListLoading, setShopListLoading] = useState(false)
    const [addingToList, setAddingToList] = useState(false)
    const [addSuccess, setAddSuccess] = useState<string | null>(null)

    // Cooking timer state
    const [cookingTimers, setCookingTimers] = useState<any[]>([])
    const [activeSession, setActiveSession] = useState<Record<string, { endTime: number | null; remaining: number; status: string; checkpointsHit: string[] }>>({})
    const [activeSheet, setActiveSheet] = useState<'none' | 'prep' | 'ingredients' | 'timers'>('none')
    const [alarmPopupClosed, setAlarmPopupClosed] = useState<Set<string>>(new Set())
    const [customTimers, setCustomTimers] = useState<{ id: string; name: string; duration: number }[]>([])
    const [customTimerName, setCustomTimerName] = useState("")
    const [customTimerMinutes, setCustomTimerMinutes] = useState("")
    const [doneFlow, setDoneFlow] = useState<Set<number>>(new Set())
    const [finishConfirm, setFinishConfirm] = useState(false)
    const [resetConfirm, setResetConfirm] = useState(false)
    const [clearResidualPrompt, setClearResidualPrompt] = useState({ show: false, recipeName: '', recipeId: '' })
    const [editingTimerId, setEditingTimerId] = useState<string | null>(null)
    const [editTimerMinutes, setEditTimerMinutes] = useState("")
    const [editTimerSeconds, setEditTimerSeconds] = useState("")
    const [customExtendId, setCustomExtendId] = useState<string | null>(null)
    const [customExtendMin, setCustomExtendMin] = useState("")

    // Recipe timer editing (persisted to the recipe document)
    const [editingRecipeTimerId, setEditingRecipeTimerId] = useState<string | null>(null)
    const [editTimerName, setEditTimerName] = useState("")
    const [editTimerDuration, setEditTimerDuration] = useState("")
    const [editTimerStep, setEditTimerStep] = useState("0")
    const [editTimerDependsOn, setEditTimerDependsOn] = useState("start")
    const [editTimerOffset, setEditTimerOffset] = useState("0")
    const [isExtractingTimers, setIsExtractingTimers] = useState(false)
    const [reExtractConfirm, setReExtractConfirm] = useState(false)
    const [addingRecipeTimer, setAddingRecipeTimer] = useState(false)
    const [newTimerName, setNewTimerName] = useState("")
    const [newTimerMinutes, setNewTimerMinutes] = useState("")

    // Cooking flow: prep run-through (if any) then the instruction steps.
    // Timers attach to their step as a poke-out tab underneath the card.
    const flowItems = useMemo<FlowItem[]>(() => buildFlowItems(instructions || [], prepWork), [instructions, prepWork])

    // Recipe timers grouped by the instruction step they assist
    const timersByStep = useMemo(() => {
        const map: Record<number, any[]> = {}
        const lastIdx = Math.max(0, (instructions || []).length - 1)
        cookingTimers.forEach((t: any) => {
            if (t.type !== 'timer') return
            const si = typeof t.stepIndex === 'number' ? Math.min(Math.max(0, t.stepIndex), lastIdx) : 0
            ;(map[si] = map[si] || []).push(t)
        })
        Object.keys(map).forEach(k => {
            map[Number(k)] = sortTimersByStartTime(map[Number(k)])
        })
        return map
    }, [instructions, cookingTimers])

    // Per-step ingredient/prep recommendations (computed once per step, read in cards)
    const ingredsByStep = useMemo(() => {
        const map: Record<number, { recommended: any[]; others: any[] }> = {}
        ;(instructions || []).forEach((_: any, i: number) => {
            map[i] = getRecommendedIngredients(instructions[i]?.Text || '', listIngreds || [])
        })
        return map
    }, [instructions, listIngreds])

    const prepByStep = useMemo(() => {
        const map: Record<number, { recommended: any[]; others: any[] }> = {}
        ;(instructions || []).forEach((_: any, i: number) => {
            map[i] = getRecommendedPrepWork(instructions[i]?.Text || '', prepWork || [])
        })
        return map
    }, [instructions, prepWork])

    const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})

    // Sticky section nav: icon tabs with a scroll-spy active state.
    // Prep uses the knife icon — the chef hat is reserved for Start Cooking.
    const [activeSection, setActiveSection] = useState('top')
    const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({})
    const navSections = useMemo(() => [
        { id: 'ingredients', label: 'Ingredients', icon: ShoppingBasket },
        { id: 'prep', label: 'Prep', icon: Slice },
        ...(instructions.length > 0 ? [{ id: 'instructions', label: 'Steps', icon: ListOrdered }] : []),
        { id: 'timers', label: 'Timers', icon: Clock },
        { id: 'feedback', label: 'Notes', icon: MessageSquare },
        { id: 'nutrients', label: 'Nutrition', icon: Sparkles }
    ], [instructions.length])

    useEffect(() => {
        if (recipe === undefined || isCookingMode) return
        let raf = 0
        const update = () => {
            raf = 0
            // A section counts as "current" once its top passes the nav line
            const marker = 120
            let current = 'top'
            for (const s of navSections) {
                const el = document.querySelector(`[data-section="${s.id}"]`)
                if (!el) continue
                if (el.getBoundingClientRect().top <= marker) current = s.id
            }
            const doc = document.documentElement
            if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
                current = navSections[navSections.length - 1]?.id || 'top'
            }
            setActiveSection(prev => (prev === current ? prev : current))
        }
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(update)
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        update()
        return () => {
            window.removeEventListener('scroll', onScroll)
            if (raf) cancelAnimationFrame(raf)
        }
    }, [recipe, isCookingMode, navSections])

    // Keep the active pill visible in the scrollable row
    useEffect(() => {
        pillRefs.current[activeSection]?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }, [activeSection])

    // Phone layout flag: ingredient research modal becomes a bottom sheet
    const [isPhoneLayout, setIsPhoneLayout] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)')
        const update = () => setIsPhoneLayout(mq.matches)
        update()
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', update)
            return () => mq.removeEventListener('change', update)
        }
        mq.addListener(update)
        return () => mq.removeListener(update)
    }, [])

    // Keep the current step centered in the timeline whenever it changes
    useEffect(() => {
        if (!isCookingMode) return
        const el = cardRefs.current[currentFlow]
        if (el) {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' })
        }
    }, [currentFlow, isCookingMode])

    const costSavedRef = useRef(false)

    const prepTimeEstimate = (prepWork || []).filter((p: any) => !p.optional).reduce((sum: number, p: any) => sum + (p.timeEstimate || 0), 0)
    const cookTimeEstimate = (instructions || []).reduce((sum: number, i: any) => sum + (i.time || 0), 0)
    const totalTimeEstimate = prepTimeEstimate + cookTimeEstimate

    async function openModal(ingredName: string) {
        setIsOpen(true)
        setSelectedIngred(ingredName)
    }

    async function closeModal() {
        setIsOpen(false)
    }

    // Resolve the quantity of the recipe ingredient a prep-work item refers to
    const getPrepIngredientQty = (name?: string | null) => {
        if (!name || !listIngreds || listIngreds.length === 0) return null
        const n = String(name).toLowerCase().trim()
        if (!n) return null
        const match = listIngreds.find((i: any) => {
            const ing = String(i.name || '').toLowerCase().trim()
            if (!ing) return false
            if (ing.includes(n)) return true
            const escaped = ing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            return new RegExp(`\\b${escaped}\\b`).test(n)
        })
        if (!match) return null
        return `${match.quantity} ${match.quantity_type_shorthand || match.quantity_type || 'each'}`
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

    const handleExportRecipe = async () => {
        setIsExporting(true)
        try {
            // listIngreds are in API shape ({name, quantity, quantity_type});
            // buildRecipeExport normalizes them to the canonical file shape.
            const image = await fetchImageAsDataUrl(imageData)
            downloadRecipeFile(buildRecipeExport({
                name: recipeName,
                ingredients: listIngreds,
                instructions,
                time: recipeTime,
                genre: recipeGenre,
                mealTypes: recipeMealTypes,
                carbType: recipeCarbType,
                servings: recipeServings,
                sourceUrl: recipe?.sourceUrl,
                prepWork,
                image
            }))
        } finally {
            setIsExporting(false)
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
        prepNotesHashRef.current = data.res.prepWorkNotesHash || null
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

    const savePrepWork = async (items: any[], notesHash?: string | null) => {
        const token = localStorage.getItem('Token') || ""
        try {
            const body: any = { prepWork: items }
            if (notesHash !== undefined) body.prepWorkNotesHash = notesHash
            await fetch(`/api/Recipe/${String(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify(body)
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
            const notesHash = computePrepNotesHash(listIngreds)
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
                    // Note-derived items are explicit user instructions — always keep them
                    if (item.fromNote) return true
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
            await savePrepWork(merged, notesHash)
            prepNotesHashRef.current = notesHash
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

    const updateRecipeTimers = (timers: any[], removedIds: string[] = []) => {
        setCookingTimers(timers)
        if (removedIds.length > 0) {
            setActiveSession(prev => {
                const next = { ...prev }
                for (const rid of removedIds) delete next[rid]
                return next
            })
        }
        saveTimers(timers)
    }

    const deleteRecipeTimer = (timerId: string) => {
        const childIds = cookingTimers.filter((t: any) => t.parentTimerId === timerId).map((t: any) => t.id)
        const updated = cookingTimers
            .filter((t: any) => t.id !== timerId && t.parentTimerId !== timerId)
            .map((t: any) => {
                if (!t.dependencies?.some((d: any) => d.timerId === timerId)) return t
                const remainingDeps = t.dependencies.filter((d: any) => d.timerId !== timerId)
                return { ...t, dependencies: remainingDeps.length > 0 ? remainingDeps : [{ timerId: 'start', offset: 0 }] }
            })
        updateRecipeTimers(updated, [timerId, ...childIds])
    }

    const saveRecipeTimerEdit = (timerId: string) => {
        const name = editTimerName.trim()
        const duration = parseInt(editTimerDuration)
        if (!name || !duration || duration <= 0) return
        const updated = cookingTimers.map((t: any) => {
            if (t.id !== timerId) return t
            const dependencies = editTimerDependsOn === 'start'
                ? [{ timerId: 'start', offset: 0 }]
                : [{ timerId: editTimerDependsOn, offset: parseInt(editTimerOffset) || 0 }]
            const stepIndex = instructions.length > 0 ? (parseInt(editTimerStep) || 0) : t.stepIndex
            return { ...t, name, duration, dependencies, stepIndex }
        })
        updateRecipeTimers(updated)
        setEditingRecipeTimerId(null)
    }

    const addRecipeTimer = () => {
        const name = newTimerName.trim()
        const mins = parseInt(newTimerMinutes)
        if (!name || !mins || mins <= 0) return
        const newTimer = {
            id: `timer-manual-${Date.now()}`,
            type: 'timer',
            name,
            duration: mins,
            dependencies: [{ timerId: 'start', offset: 0 }],
            stepIndex: instructions.length > 0 ? instructions.length - 1 : 0,
            notes: ''
        }
        updateRecipeTimers([...cookingTimers, newTimer])
        setNewTimerName("")
        setNewTimerMinutes("")
        setAddingRecipeTimer(false)
    }

    const extractTimers = async (force = false) => {
        if (!id || !recipeName) return
        if (!force && cookingTimers.length > 0) return
        setIsExtractingTimers(true)
        try {
            const token = localStorage.getItem('Token') || ""
            const ingredNames = (listIngreds || []).map((i: any) => i.name).join(', ')
            const instrText = (instructions || []).map((i: any, idx: number) => `${idx + 1}. ${i.Text}${i.time ? ` (${i.time} min)` : ''}`).join('\n')
            const res = await fetch(`/api/ai/extract_timers?recipeName=${encodeURIComponent(recipeName)}&ingredients=${encodeURIComponent(ingredNames)}&instructions=${encodeURIComponent(instrText)}`, {
                headers: { 'edgetoken': token }
            })
            const data = await res.json()
            if (data.success && data.data?.timers && data.data.timers.length > 0) {
                const replacedIds = cookingTimers.map((t: any) => t.id)
                setCookingTimers(data.data.timers)
                setActiveSession(prev => {
                    const next = { ...prev }
                    for (const rid of replacedIds) delete next[rid]
                    return next
                })
                await saveTimers(data.data.timers)
            }
        } catch (e) {
            console.error('Timer extraction failed:', e)
        }
        setIsExtractingTimers(false)
    }

    // Remaining seconds, aligned so the mm:ss display steps down exactly once
    // per real second (ceil, never repeats or skips) instead of rounding at
    // arbitrary render times. Signed: negative while a timer is overdue.
    function getRemaining(session: { endTime: number | null; remaining: number; status: string }, now: number = Date.now()) {
        if ((session.status === 'active' || session.status === 'overdue') && session.endTime) {
            return Math.ceil((session.endTime - now) / 1000)
        }
        return session.remaining
    }

    // Progress in percent from raw milliseconds so the bar moves continuously
    // with the tick clock instead of jumping when the displayed second flips.
    function getTimerProgress(timer: any, session: any, now: number) {
        const totalMs = (timer.duration || 0) * 60 * 1000
        if (totalMs <= 0 || !session) return 0
        let elapsedMs: number
        if ((session.status === 'active' || session.status === 'overdue') && session.endTime) {
            elapsedMs = totalMs - Math.max(0, session.endTime - now)
        } else {
            elapsedMs = totalMs - (session.remaining || 0) * 1000
        }
        return Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
    }

    // Shared timer controls (used by timeline cards, timers sheet and desktop sidebar)
    const updateTimerSession = (timerId: string, patch: (prev: any) => any) => {
        setActiveSession(prev => ({ ...prev, [timerId]: patch(prev[timerId]) }))
    }

    const getTimerStatus = (timerId: string) => activeSession[timerId]?.status || 'pending'

    const startTimer = (timer: any) => {
        updateTimerSession(timer.id, () => ({
            endTime: Date.now() + timer.duration * 60 * 1000,
            remaining: timer.duration * 60,
            status: 'active',
            checkpointsHit: []
        }))
    }

    const pauseResumeTimer = (timer: any) => {
        updateTimerSession(timer.id, (session: any) => {
            if (!session) return session
            if (session.status === 'active') {
                return { endTime: null, remaining: getRemaining(session), status: 'paused', checkpointsHit: session.checkpointsHit }
            }
            return { endTime: Date.now() + session.remaining * 1000, remaining: session.remaining, status: 'active', checkpointsHit: session.checkpointsHit }
        })
    }

    const extendTimer = (timer: any, minutes: number) => {
        updateTimerSession(timer.id, (session: any) => ({
            endTime: Date.now() + minutes * 60 * 1000,
            remaining: minutes * 60,
            status: 'active',
            checkpointsHit: session?.checkpointsHit || []
        }))
    }

    const completeTimer = (timer: any) => {
        updateTimerSession(timer.id, (session: any) => ({
            endTime: null,
            remaining: 0,
            status: 'completed',
            checkpointsHit: session?.checkpointsHit || []
        }))
    }

    const resetTimer = (timer: any) => {
        updateTimerSession(timer.id, () => ({
            endTime: null,
            remaining: timer.duration * 60,
            status: 'pending',
            checkpointsHit: []
        }))
    }

    const setTimerRemaining = (timer: any, totalSecs: number) => {
        updateTimerSession(timer.id, (session: any) => ({
            endTime: Date.now() + totalSecs * 1000,
            remaining: totalSecs,
            status: 'active',
            checkpointsHit: session?.checkpointsHit || []
        }))
    }

    const addTimerSeconds = (timer: any, seconds: number) => {
        updateTimerSession(timer.id, (session: any) => {
            if (session?.status === 'active' || session?.status === 'overdue') {
                return { ...session, endTime: (session.endTime || Date.now()) + seconds * 1000, status: 'active' }
            }
            return { ...session, remaining: (session.remaining || 0) + seconds }
        })
    }

    const closeCooking = () => {
        setActiveSession({})
        setCustomTimers([])
        setAlarmPopupClosed(new Set())
        if (id) {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('timer-session-'))
            keys.forEach(k => localStorage.removeItem(k))
        }
        setIsCookingMode(false)
        setCurrentFlow(0)
        setDoneFlow(new Set())
        setActiveSheet('none')
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
        try {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { body, icon: '/favicon.ico' })
            }
        } catch (e) {
            console.error('Notification failed:', e)
        }
    }

    useEffect(() => {
        try {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission()
            }
        } catch (e) {
            console.error('Notification permission request failed:', e)
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
        } else if (hasCheckedPrepRef.current && listIngreds && listIngreds.length > 0 && recipe) {
            const currentHash = computePrepNotesHash(listIngreds)
            if (prepNotesHashRef.current !== currentHash) {
                // Ingredient notes changed since the last extraction — refresh prep work
                prepNotesHashRef.current = currentHash
                extractPrepWork().then(() => setPrepDone(true))
            } else {
                setPrepDone(true)
            }
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

    // Auto-extract timers if none exist and extraction hasn't succeeded before
    // (keeps deliberately deleted timers from being re-added on reload)
    useEffect(() => {
        if (recipe && recipeName && listIngreds.length > 0 && instructions.length > 0 && cookingTimers.length === 0 && !recipe.timersChecked) {
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
                    const sessions = session.timers ? Object.values(session.timers) : Object.values(session)
                    const hasActive = (sessions as any[]).some((s: any) => s && (s.status === 'active' || s.status === 'paused'))
                    if (hasActive) {
                        const recipeId = key.replace('timer-session-', '')
                        setClearResidualPrompt({ show: true, recipeName: 'another recipe', recipeId })
                        break
                    }
                } catch {}
            }
        }
    }, [id])

    // Load session from localStorage. Migrates older formats:
    //  - v-less "timer-interleaved flow" indices -> step indices
    //  - oldest instruction-index based sessions
    useEffect(() => {
        if (!id || flowItems.length === 0) return
        try {
            const saved = localStorage.getItem(`timer-session-${id}`)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed.timers) setActiveSession(parsed.timers)

                const legacy = legacyFlowStepIndices(instructions || [], cookingTimers)
                const prepShift = (prepWork || []).length > 0 ? 1 : 0
                const toFlowIndices = (idxs: any[]): number[] => {
                    const mapped: number[] = parsed.v === 4
                        ? idxs
                        : parsed.v === 3
                            ? idxs.map((i: number) => i + prepShift)
                            : idxs.map((i: number) => (typeof legacy[i] === 'number' ? legacy[i] + prepShift : i))
                    return mapped.filter((fi: number) => fi >= 0 && fi < flowItems.length)
                }

                if (Array.isArray(parsed.doneFlow)) {
                    setDoneFlow(new Set(toFlowIndices(parsed.doneFlow)))
                } else if (Array.isArray(parsed.completedSteps)) {
                    const flowSet = new Set<number>()
                    parsed.completedSteps.forEach((si: number) => {
                        const fi = flowItems.findIndex(f => f.stepIndex === si)
                        if (fi >= 0) flowSet.add(fi)
                    })
                    setDoneFlow(flowSet)
                }
                if (typeof parsed.currentFlow === 'number') {
                    const mapped = toFlowIndices([parsed.currentFlow])
                    if (mapped.length > 0) {
                        setCurrentFlow(Math.min(mapped[0], flowItems.length - 1))
                    } else {
                        setCurrentFlow(Math.min(Math.max(0, parsed.currentFlow), flowItems.length - 1))
                    }
                } else if (typeof parsed.currentStep === 'number') {
                    const fi = flowItems.findIndex(f => f.stepIndex === parsed.currentStep)
                    if (fi >= 0) setCurrentFlow(fi)
                } else if (parsed.timers) {
                    const activeFlows = Object.entries(parsed.timers)
                        .filter(([_, s]: [string, any]) => s.status === 'active' || s.status === 'paused')
                        .map(([tid]) => {
                            const t = cookingTimers.find((x: any) => x.id === tid)
                            if (!t) return -1
                            const si = typeof t.stepIndex === 'number' ? t.stepIndex : 0
                            return flowItems.findIndex(f => f.stepIndex === si)
                        })
                        .filter((fi: number) => fi >= 0)
                    if (activeFlows.length > 0) {
                        const maxFlow = Math.max(...activeFlows)
                        setCurrentFlow(maxFlow)
                        const prior = new Set<number>()
                        for (let i = 0; i < maxFlow; i++) prior.add(i)
                        setDoneFlow(prior)
                    }
                }
            }
        } catch {}
    }, [id, flowItems, cookingTimers, instructions])

    // Save session to localStorage
    useEffect(() => {
        if (!id) return
        try {
            localStorage.setItem(`timer-session-${id}`, JSON.stringify({
                v: 4,
                timers: activeSession,
                currentFlow,
                doneFlow: Array.from(doneFlow)
            }))
        } catch {}
    }, [activeSession, currentFlow, doneFlow, id])

    // Tick clock + countdown engine. A 100ms clock drives re-renders while any
    // timer runs, so countdowns step at true second boundaries (ceiled) and
    // progress bars glide; completion/checkpoint detection fires within ~100ms
    // of the real end time instead of up to a second off.
    const [nowMs, setNowMs] = useState(() => Date.now())
    const activeSessionRef = useRef(activeSession)
    activeSessionRef.current = activeSession
    const lastAlarmAtRef = useRef(0)

    useEffect(() => {
        if (!isCookingMode) return
        const interval = setInterval(() => {
            const now = Date.now()
            const sessions = activeSessionRef.current
            const isRunning = (s: any) => (s.status === 'active' || s.status === 'overdue') && s.endTime
            const hasActive = Object.values(sessions).some(isRunning)
            if (!hasActive) return

            setNowMs(now)

            // Keep ringing every 4s while a timer sits overdue and unacknowledged
            const hasOverdue = Object.values(sessions).some((s: any) => s.status === 'overdue')
            if (hasOverdue && now - lastAlarmAtRef.current >= 4000) {
                playAlarm()
                lastAlarmAtRef.current = now
            }

            const updates: Record<string, any> = {}
            for (const [timerId, session] of Object.entries(sessions)) {
                if (session.status !== 'active' || !session.endTime) continue
                const remaining = Math.max(0, Math.ceil((session.endTime - now) / 1000))
                const finished = session.endTime - now <= 0
                if (finished) {
                    // Go overdue rather than completing: count into the negative and
                    // keep ringing until the user dismisses (Done ✓) or extends.
                    updates[timerId] = { ...session, status: 'overdue' }
                    playAlarm()
                    lastAlarmAtRef.current = now
                    sendNotification('Timer Complete', `${getTimerById(cookingTimers, timerId)?.name || 'Timer'} is done!`)
                    // A fresh overdue event — make sure the alarm popup shows for it again
                    setAlarmPopupClosed(prev => {
                        if (!prev.has(timerId)) return prev
                        const next = new Set(Array.from(prev))
                        next.delete(timerId)
                        return next
                    })
                    continue
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
                            const base = updates[timerId] || session
                            updates[timerId] = { ...base, checkpointsHit: [...(base.checkpointsHit || []), ckpt.id] }
                            playAlarm()
                            sendNotification('Checkpoint', `${ckpt.name} reached!`)
                        }
                    }
                }
            }
            if (Object.keys(updates).length > 0) {
                setActiveSession(prev => {
                    const next = { ...prev }
                    for (const [k, v] of Object.entries(updates)) {
                        next[k] = { ...(next[k] || {}), ...v }
                    }
                    return next
                })
            }
        }, 100)
        return () => clearInterval(interval)
    }, [isCookingMode, cookingTimers, id])

    const handleClick = () => {
        document.querySelector<HTMLInputElement>('input[type="file"]')?.click()
    }

    const scrollToSection = (section: string) => {
        if (section === 'top') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
        }
        const el = document.querySelector(`[data-section="${section}"]`) as HTMLElement | null;
        if (!el) return;
        el.classList.remove('group-flash');
        void el.offsetWidth;
        el.classList.add('group-flash');
        // Offset handled by scroll-margin-top on [data-section]
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const showPerPerson = recipeServings > 1

    // One compact cost card — every value lives in a single wrapping row
    const costEntries: { label: string; value: string }[] = [
        { label: 'Total', value: `$${displayCost.toFixed(2)}` },
        { label: 'Unit', value: `$${getAproxTotalRecipeCostUnit()}` },
        ...(showPerPerson ? [{ label: 'Per person', value: `$${(displayCost / recipeServings).toFixed(2)}` }] : [])
    ]

    const infoCard = (
        <div className="recipe-band">
            <div className="mx-4 sm:mx-8 rounded-xl bg-secondary/50 px-4 sm:px-6 py-2.5">
                {/* Single line, never wraps — scrolls horizontally only as a last resort */}
                <div className="flex items-center gap-x-4 overflow-x-auto hide-scrollbar whitespace-nowrap">
                    {isCalculatingCost ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40 shrink-0" />
                    ) : (
                        <>
                            {costEntries.map((entry, i) => (
                                <Fragment key={entry.label}>
                                    {i > 0 && <span className="text-muted-foreground/30 select-none shrink-0" aria-hidden>·</span>}
                                    <span className="inline-flex items-baseline gap-1.5 shrink-0">
                                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{entry.label}</span>
                                        <span className="text-xs sm:text-sm font-semibold tabular-nums text-foreground/70">{entry.value}</span>
                                    </span>
                                </Fragment>
                            ))}
                            <button onClick={refreshCost} title="Refresh cost" className="ml-auto shrink-0 text-muted-foreground/40 hover:text-accent transition-colors">
                                <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )

    // Category chips (Quick / $ Cheap / genre / meal / carb / Hidden / Source)
    // render twice: quiet style in the title block, and black-on-white style
    // overlaid on the hero image on phones.
    const renderCategoryChips = (chipClass: string) => (
        <>
            {recipeTime && timeLabelMap[recipeTime] && (
                <span className={chipClass}>{timeLabelMap[recipeTime].label}</span>
            )}
            {displayPriceCategory && priceLabelMap[displayPriceCategory] && (
                <span className={chipClass}>{priceLabelMap[displayPriceCategory].label}</span>
            )}
            {recipeGenre && <span className={chipClass}>{recipeGenre}</span>}
            {recipeMealTypes && recipeMealTypes.map(type => <span key={type} className={chipClass}>{type}</span>)}
            {recipeCarbType && <span className={chipClass}>{recipeCarbType}</span>}
            {isHidden && (
                <span className={chipClass}>
                    <EyeOff size={11} /> Hidden
                </span>
            )}
            {sourceUrl && (
                <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={sourceUrl}
                    className={`${chipClass} hover:opacity-80 transition-opacity`}
                >
                    {isVideoSource ? '▶ Watch Original' : 'View Source'}
                </a>
            )}
        </>
    )

    return (
        <Layout title={recipeName || "Recipe"}>
            {/* Section navigation — sticky icon tabs + always-available Start Cooking */}
            <nav className="recipe-nav" aria-label="Recipe sections">
                <button
                    onClick={() => scrollToSection('top')}
                    className={`recipe-nav-pill is-top ${activeSection === 'top' ? 'is-active' : ''}`}
                    ref={(el) => { pillRefs.current['top'] = el }}
                    title="Back to top"
                    aria-label="Back to top"
                >
                    <ChevronUp size={17} />
                </button>
                {navSections.map(s => (
                    <button
                        key={s.id}
                        onClick={() => scrollToSection(s.id)}
                        className={`recipe-nav-pill ${activeSection === s.id ? 'is-active' : ''}`}
                        ref={(el) => { pillRefs.current[s.id] = el }}
                        title={s.label}
                        aria-label={s.label}
                    >
                        <s.icon size={17} />
                    </button>
                ))}
                <button
                    onClick={() => { setIsCookingMode(true); setActiveSheet('none') }}
                    className="recipe-nav-start"
                    title="Start Cooking"
                    aria-label="Start Cooking"
                >
                    <ChefHat size={17} />
                </button>
            </nav>
            {/* Full-bleed wrapper: breaks out of the .container side padding on
                desktop so the card colour reaches the viewport edges */}
            <div className="pb-4 min-[769px]:-mx-6">
                {/* Hero Header — one reading layout with or without an image:
                    the image is a full-bleed banner and never changes text insets */}
                <div className="bg-card text-card-foreground overflow-hidden mb-0">
                    {imageData && (
                        <div className="relative h-44 sm:h-64 md:h-80 w-full cursor-pointer group" onClick={handleClick} title="Change image">
                            <img src={imageData} alt={recipeName} className="w-full h-full object-cover" />
                            <div className="absolute bottom-3 left-3 sm:hidden" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-wrap gap-1.5">
                                    {renderCategoryChips(CHIP_OVERLAY)}
                                </div>
                            </div>
                            <div className="absolute top-3 right-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-full backdrop-blur-sm font-semibold">Change Image</span>
                            </div>
                        </div>
                    )}

                    <div className="recipe-band px-4 sm:px-8 pt-4 pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">{recipeName}</h1>
                            {(totalTimeEstimate > 0 || recipeServings > 0) && (
                                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm sm:text-base font-semibold text-foreground/90">
                                    {totalTimeEstimate > 0 && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <Clock className="w-4 h-4 text-muted-foreground" />
                                            <span className="tabular-nums">{totalTimeEstimate} min</span>
                                        </span>
                                    )}
                                    {recipeServings > 0 && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <Users className="w-4 h-4 text-muted-foreground" />
                                            <span className="tabular-nums">{recipeServings} serving{recipeServings === 1 ? '' : 's'}</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* With an image these chips move onto the photo on phones
                            (black pills, bottom-left); the row below serves sm+ */}
                        <div className={`flex flex-wrap gap-1.5 mt-3 ${imageData ? 'hidden sm:flex' : ''}`}>
                            {renderCategoryChips(CHIP_META)}
                        </div>
                    </div>

                    {infoCard}

                    <div className="recipe-band py-3 px-4 sm:px-8 sm:py-4">
                        <div className="flex gap-1.5">
                            <Button
                                onClick={toggleHidden}
                                variant="outline"
                                    className={`h-12 sm:h-14 px-3 sm:px-6 rounded-md bg-secondary/70 hover:bg-secondary text-foreground/85 font-semibold text-sm flex items-center justify-center gap-1.5 transition-all shrink-0 !border-0 ${isHidden ? 'bg-secondary text-foreground' : ''}`}
                                title={isHidden ? 'Hidden from /recipes grid' : 'Show on /recipes grid'}
                                aria-label={isHidden ? 'Recipe is hidden' : 'Hide recipe'}
                            >
                                {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                <span className="hidden sm:inline">{isHidden ? 'Hidden' : 'Hide'}</span>
                            </Button>
                            <Button
                                onClick={() => router.push(`/createRecipe?id=${id}`)}
                                variant="outline"
                                className="h-12 sm:h-14 px-3 sm:px-6 rounded-md bg-secondary/70 hover:bg-secondary text-foreground/85 font-semibold text-sm flex items-center justify-center gap-1.5 transition-all shrink-0 !border-0"
                                title="Edit recipe"
                                aria-label="Edit recipe"
                            >
                                <Pencil className="w-4 h-4" />
                                <span className="hidden sm:inline">Edit</span>
                            </Button>
                            <Button
                                onClick={handleExportRecipe}
                                variant="outline"
                                disabled={isExporting}
                                className="h-12 sm:h-14 px-3 sm:px-6 rounded-md bg-secondary/70 hover:bg-secondary text-foreground/85 font-semibold text-sm flex items-center justify-center gap-1.5 transition-all shrink-0 !border-0 disabled:opacity-60"
                                title="Export recipe to a JSON file"
                                aria-label="Export recipe"
                            >
                                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                <span className="hidden sm:inline">Export</span>
                            </Button>
                            <Button
                                onClick={() => { setIsCookingMode(true); setActiveSheet('none') }}
                                className="flex-1 h-12 sm:h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base sm:text-lg rounded-md shadow-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                                <ChefHat className="w-5 h-5" />
                                Start Cooking
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="bg-card text-card-foreground mb-0">
                    {/* Ingredients Section */}
                    <div data-section="ingredients" className="recipe-band recipe-section px-4 py-6 sm:px-8 sm:py-10">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 mb-5">
                            <ShoppingBasket className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Ingredients</h2>
                            <span className="text-xs text-muted-foreground">{matchedListIngreds.length} items</span>
                            <Button
                                onClick={openShopModal}
                                variant="outline"
                                className="ml-auto h-9 px-3 rounded-md bg-secondary/70 hover:bg-secondary text-foreground/85 text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 !border-0"
                            >
                                <Plus className="w-4 h-4" />
                                Add to Shopping List
                            </Button>
                        </div>

                        {/* Ingredients are ordered by category but stacked as one
                            continuous list — category names are not displayed. */}
                        <div className="flex flex-col">
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
                            }).flatMap(([, ingredients]: [string, any[]]) => ingredients).map((ingred, idx) => (
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

                    {/* Prep Work Section */}
                    <div data-section="prep" className="recipe-band recipe-section px-4 py-6 sm:px-8 sm:py-10">
                        <div className="flex items-center gap-2.5 mb-5">
                            <ChefHat className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Prep Work</h2>
                            <div className="ml-auto flex items-center gap-2">
                                {isExtractingPrep && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                                <button
                                    onClick={extractPrepWork}
                                    disabled={isExtractingPrep}
                                    className="text-xs text-muted-foreground hover:text-accent disabled:opacity-50 transition-colors"
                                >
                                    Re-extract
                                </button>
                            </div>
                        </div>

                        {isExtractingPrep ? (
                            <p className="text-muted-foreground text-sm">Analyzing recipe...</p>
                        ) : prepWork.length === 0 ? (
                            <p className="text-muted-foreground text-sm">Nothing to do... add items manually or click Re-extract.</p>
                        ) : (
                            <div className="space-y-2">
                                {prepWork.map((item, index) => (
                                    <div key={index} className={`flex items-center gap-3 p-3 rounded-xl ${item.optional ? 'bg-secondary/25' : 'bg-secondary/50'}`}>
                                        <button
                                            onClick={() => setCheckedPrep(prev => {
                                                const next = new Set(prev)
                                                if (next.has(index)) next.delete(index)
                                                else next.add(index)
                                                return next
                                            })}
                                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                                checkedPrep.has(index)
                                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                                    : item.optional ? 'border-border/60 hover:border-accent/50' : 'border-border hover:border-accent/70'
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
                                                className="flex-1 min-w-0 bg-transparent border-b border-border focus:border-accent outline-none text-foreground/85"
                                                autoFocus
                                            />
                                        ) : (
                                            <span
                                                onClick={() => { setEditingPrepIndex(index); setEditingPrepText(item.action) }}
                                                className={`flex-1 min-w-0 cursor-pointer ${checkedPrep.has(index) ? 'line-through opacity-50' : item.optional ? 'text-muted-foreground' : 'text-foreground/85'}`}
                                            >
                                                {item.ingredient && <span className="font-semibold">{item.ingredient}: </span>}
                                                {item.action}
                                                {item.optional && <span className="ml-2 text-[10px] text-muted-foreground/60 font-semibold uppercase">(optional)</span>}
                                            </span>
                                        )}
                                        {item.timeEstimate && (
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
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
                                            className="text-muted-foreground/30 hover:text-destructive transition-colors p-1 shrink-0"
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
                            className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors"
                        >
                            <Plus size={15} /> Add custom prep work
                        </button>
                    </div>

                    {/* Instructions Section */}
                    {instructions.length > 0 && (
                        <div data-section="instructions" className="recipe-band recipe-section px-4 py-6 sm:px-8 sm:py-10">
                            <div className="flex items-center gap-2.5 mb-5">
                                <ListOrdered className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight">Instructions</h2>
                                <span className="ml-auto text-xs text-muted-foreground">{instructions.length} steps</span>
                            </div>
                            <div className="space-y-5 sm:space-y-6">
                                {instructions.map((instruction, index) => (
                                    <div key={index} className="flex gap-3 sm:gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-sm font-bold text-foreground/70">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-foreground/85 leading-relaxed text-[15px] sm:text-base font-medium">{instruction.Text}</p>
                                            {instruction.time && (
                                                <div className="mt-1 text-xs text-muted-foreground">~{instruction.time} min</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}



                    {/* Timing Section */}
                    <div data-section="timers" className="recipe-band recipe-section px-4 py-6 sm:px-8 sm:py-10">
                        <div className="flex items-center gap-2.5 mb-5">
                            <Clock className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight">Timing</h2>
                        </div>

                        {/* Prep + cook only — category/servings/total live elsewhere */}
                        {(prepTimeEstimate > 0 || cookTimeEstimate > 0) && (
                            <div className="grid grid-cols-2 gap-2 mb-6">
                                {prepTimeEstimate > 0 && (
                                    <div className="p-3 rounded-xl bg-secondary/60 flex flex-col items-center justify-center text-center">
                                        <p className="text-lg font-bold leading-tight">{prepTimeEstimate}<span className="text-xs font-semibold text-muted-foreground ml-0.5">min</span></p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Prep Time</p>
                                    </div>
                                )}
                                {cookTimeEstimate > 0 && (
                                    <div className="p-3 rounded-xl bg-secondary/60 flex flex-col items-center justify-center text-center">
                                        <p className="text-lg font-bold leading-tight">{cookTimeEstimate}<span className="text-xs font-semibold text-muted-foreground ml-0.5">min</span></p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cook Time</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-2 mb-3">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cooking Timers ({cookingTimers.filter((t: any) => t.type === 'timer').length})</p>
                            <div className="flex items-center gap-3">
                                {isExtractingTimers && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                                <button
                                    onClick={() => setReExtractConfirm(true)}
                                    disabled={isExtractingTimers}
                                    className="text-xs text-muted-foreground hover:text-accent disabled:opacity-50 transition-colors"
                                >
                                    Re-extract
                                </button>
                            </div>
                        </div>

                        {cookingTimers.filter((t: any) => t.type === 'timer').length === 0 && !isExtractingTimers && (
                            <p className="text-muted-foreground text-sm mb-3">No cooking timers... add one manually or click Re-extract.</p>
                        )}

                        <div className="space-y-2">
                            {cookingTimers.filter((t: any) => t.type === 'timer').map((timer: any) => {
                                const depRef = timer.dependencies?.[0]?.timerId
                                const depTimerId = depRef && depRef !== 'start' ? depRef : null
                                const depTimer = depTimerId ? getTimerById(cookingTimers, depTimerId) : null
                                const depOffset = depTimerId ? (timer.dependencies[0].offset || 0) : 0
                                const excludedIds = timersDependingOn(cookingTimers, timer.id)
                                const parentOptions = cookingTimers.filter((t: any) => t.type === 'timer' && t.id !== timer.id && !excludedIds.has(t.id))
                                return (
                                    <div key={timer.id} className="p-3 rounded-xl bg-secondary/50 text-sm">
                                        {editingRecipeTimerId === timer.id ? (
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <input
                                                        value={editTimerName}
                                                        onChange={(e) => setEditTimerName(e.target.value)}
                                                        placeholder="Timer name"
                                                        className="flex-1 min-w-[10rem] bg-transparent border-b border-border focus:border-accent outline-none text-foreground/85"
                                                        autoFocus
                                                    />
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={editTimerDuration}
                                                        onChange={(e) => setEditTimerDuration(e.target.value)}
                                                        placeholder="min"
                                                        className="w-16 bg-transparent border-b border-border focus:border-accent outline-none text-foreground/85"
                                                    />
                                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">min</span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                    {instructions.length > 0 && (
                                                        <>
                                                            <span className="text-[10px] font-semibold uppercase tracking-wider">Step</span>
                                                            <select
                                                                value={editTimerStep}
                                                                onChange={(e) => setEditTimerStep(e.target.value)}
                                                                className="bg-secondary text-foreground/85 rounded-lg px-2 py-1 focus:outline-none"
                                                            >
                                                                {instructions.map((_: any, i: number) => (
                                                                    <option key={i} value={String(i)}>Step {i + 1}</option>
                                                                ))}
                                                            </select>
                                                        </>
                                                    )}
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider">Starts</span>
                                                    <select
                                                        value={editTimerDependsOn}
                                                        onChange={(e) => setEditTimerDependsOn(e.target.value)}
                                                        className="bg-secondary text-foreground/85 rounded-lg px-2 py-1 focus:outline-none"
                                                    >
                                                        <option value="start">Immediately</option>
                                                        {parentOptions.map((pt: any) => (
                                                            <option key={pt.id} value={pt.id}>{pt.name}</option>
                                                        ))}
                                                    </select>
                                                    {editTimerDependsOn !== 'start' && (
                                                        <>
                                                            <input
                                                                type="number"
                                                                value={editTimerOffset}
                                                                onChange={(e) => setEditTimerOffset(e.target.value)}
                                                                placeholder="0"
                                                                className="w-16 bg-transparent border-b border-border focus:border-accent outline-none text-foreground/85"
                                                            />
                                                            <span className="text-[10px] text-muted-foreground/60">min (negative = before it finishes)</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <button
                                                        onClick={() => saveRecipeTimerEdit(timer.id)}
                                                        className="text-xs font-bold text-accent hover:text-emerald-400 transition-colors"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingRecipeTimerId(null)}
                                                        className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-baseline gap-x-2">
                                                        <span className="font-semibold text-foreground/85">{timer.name}</span>
                                                        <span className="text-muted-foreground">{timer.duration} min</span>
                                                    </div>
                                                    {(depTimer || (timer.stepIndex != null && instructions.length > 0)) && (
                                                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                                            {timer.stepIndex != null && instructions.length > 0 ? `Step ${timer.stepIndex + 1}` : ''}
                                                            {timer.stepIndex != null && instructions.length > 0 && depTimer ? ' · ' : ''}
                                                            {depTimer ? `starts ${depOffset < 0 ? `${-depOffset} min before ${depTimer.name} finishes` : `when ${depTimer.name} finishes`}` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setEditingRecipeTimerId(timer.id)
                                                        setEditTimerName(timer.name || '')
                                                        setEditTimerDuration(String(timer.duration || ''))
                                                        setEditTimerStep(String(Math.min(timer.stepIndex ?? 0, Math.max(0, instructions.length - 1))))
                                                        const d = timer.dependencies?.[0]
                                                        if (d && d.timerId !== 'start' && cookingTimers.some((t: any) => t.id === d.timerId)) {
                                                            setEditTimerDependsOn(d.timerId)
                                                            setEditTimerOffset(String(d.offset || 0))
                                                        } else {
                                                            setEditTimerDependsOn('start')
                                                            setEditTimerOffset('0')
                                                        }
                                                    }}
                                                    className="text-muted-foreground/40 hover:text-foreground transition-colors p-1 shrink-0"
                                                    title="Edit timer"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => deleteRecipeTimer(timer.id)}
                                                    className="text-muted-foreground/30 hover:text-destructive transition-colors p-1 shrink-0"
                                                    title="Delete timer"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {addingRecipeTimer ? (
                            <div className="flex flex-wrap items-center gap-2 mt-3 p-3 rounded-xl bg-secondary/50">
                                <input
                                    value={newTimerName}
                                    onChange={(e) => setNewTimerName(e.target.value)}
                                    placeholder="Timer name"
                                    className="flex-1 min-w-[10rem] bg-transparent border-b border-border focus:border-accent outline-none text-sm text-foreground/85"
                                    autoFocus
                                />
                                <input
                                    type="number"
                                    min="1"
                                    value={newTimerMinutes}
                                    onChange={(e) => setNewTimerMinutes(e.target.value)}
                                    placeholder="min"
                                    className="w-16 bg-transparent border-b border-border focus:border-accent outline-none text-sm text-foreground/85"
                                />
                                <button
                                    onClick={addRecipeTimer}
                                    className="text-xs font-bold text-accent hover:text-emerald-400 transition-colors"
                                >
                                    Add
                                </button>
                                <button
                                    onClick={() => { setAddingRecipeTimer(false); setNewTimerName(""); setNewTimerMinutes("") }}
                                    className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setAddingRecipeTimer(true)}
                                className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors"
                            >
                                <Plus size={15} /> Add timer
                            </button>
                        )}

                        {instructions.filter((i: any) => i.time).length > 1 && (
                            <div className="mt-6">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Step Breakdown</p>
                                <div className="flex flex-wrap gap-2">
                                    {instructions.map((instruction: any, idx: number) => instruction.time ? (
                                        <div key={idx} className="px-3 py-1.5 rounded-lg bg-secondary/60 text-sm">
                                            <span className="font-semibold text-foreground/85">Step {idx + 1}</span>
                                            <span className="text-muted-foreground ml-2">~{instruction.time} min</span>
                                        </div>
                                    ) : null)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Feedback & Reflection Section */}
                    <div data-section="feedback" className="recipe-band recipe-section px-4 py-6 sm:px-8 sm:py-10">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
                            <div className="flex items-center gap-2.5">
                                <MessageSquare className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight">Cooking Reflection</h2>
                            </div>
                            <div className="flex items-center gap-2 sm:ml-auto">
                                <div className="flex items-center gap-0.5">
                                    <Button
                                        onClick={() => updateTimesCooked(timesCooked - 1)}
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 w-9 p-0 rounded-full hover:bg-secondary hover:text-foreground transition-colors"
                                        disabled={timesCooked <= 0}
                                    >
                                        -
                                    </Button>
                                    <input
                                        type="number"
                                        value={timesCooked}
                                        onChange={(e) => updateTimesCooked(parseInt(e.target.value) || 0)}
                                        className="w-10 text-center bg-transparent font-bold text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Button
                                        onClick={() => updateTimesCooked(timesCooked + 1)}
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 w-9 p-0 rounded-full hover:bg-secondary hover:text-foreground transition-colors"
                                    >
                                        +
                                    </Button>
                                </div>
                                <Button
                                    onClick={() => updateTimesCooked(timesCooked + 1)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-10 px-4 rounded-xl flex items-center gap-2 transition-all active:scale-95 text-sm"
                                >
                                    <ChefHat size={16} /> <span className="sm:hidden">Cooked</span><span className="hidden sm:inline">Mark as Cooked</span>
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                onBlur={(e) => saveFeedback(e.target.value)}
                                placeholder="How did it turn out? Any tweaks for next time? (Auto-saves on blur)"
                                className="w-full min-h-[120px] rounded-xl bg-secondary px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent/40 transition-shadow resize-none placeholder:text-muted-foreground/50"
                            />
                            {isSavingFeedback && <div className="text-[10px] font-semibold text-accent animate-pulse text-right pr-2 uppercase tracking-wider">Saving changes...</div>}
                        </div>
                    </div>

                    {/* Nutrients density — collapsible, off by default */}
                    <div data-section="nutrients" className="recipe-band recipe-section px-4 py-6 sm:px-8 sm:py-10">
                        <button
                            onClick={() => setShowNutrients(!showNutrients)}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Sparkles className={`w-4 h-4 transition-transform duration-300 ${showNutrients ? 'text-accent' : ''}`} />
                            <h2 className="text-sm font-bold uppercase tracking-wider">
                                Nutritional Density
                            </h2>
                            <span className={`text-[10px] transition-transform duration-300 ${showNutrients ? 'rotate-180' : ''}`}>
                                ▼
                            </span>
                        </button>

                        {showNutrients && (
                            <div className="mt-4 rounded-2xl bg-secondary/50 p-4 sm:p-6 animate-in fade-in slide-in-from-top-2 duration-300">
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

                    <div className="recipe-band flex justify-between items-center gap-3 px-4 sm:px-8 py-4">
                        <span className="text-xs text-muted-foreground/50 font-mono truncate">ID: {id}</span>
                        <Button variant="destructive" onClick={deleteRecipe} size="sm" className="shrink-0">
                            Delete Recipe
                        </Button>
                    </div>
                </div>

                {/* Ingredient Research Modal — bottom sheet on phones, centered card on desktop */}
                <Modal
                    isOpen={modalIsOpen}
                    onRequestClose={closeModal}
                    style={{
                        content: isPhoneLayout ? {
                            backgroundColor: 'var(--background)',
                            color: 'var(--foreground)',
                            border: '1px solid var(--border)',
                            borderBottom: 'none',
                            borderRadius: '1.25rem 1.25rem 0 0',
                            padding: '1.25rem',
                            inset: 'auto 0 0 0',
                            maxHeight: '85vh',
                            overflowY: 'auto',
                            marginBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
                            boxShadow: '0 -20px 40px rgba(0,0,0,0.4)'
                        } : {
                            backgroundColor: 'var(--background)',
                            color: 'var(--foreground)',
                            border: '1px solid var(--border)',
                            maxWidth: '900px',
                            margin: '0 auto',
                            padding: '1.5rem',
                            borderRadius: '1rem',
                            inset: '1.5rem',
                            maxHeight: 'calc(100vh - 3rem)',
                            overflowY: 'auto'
                        },
                        overlay: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 100,
                            display: 'flex',
                            alignItems: isPhoneLayout ? 'flex-end' : 'center',
                            justifyContent: 'center'
                        }
                    }}
                    contentLabel="Ingredient Research Modal"
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">Ingredient Research</h2>
                        <button
                            onClick={closeModal}
                            className="bg-secondary hover:bg-secondary/80 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
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
                        <h2 className="text-lg font-bold">Add to Shopping List</h2>
                        <button
                            onClick={() => { setShopModalOpen(false); setAddSuccess(null) }}
                            className="bg-secondary hover:bg-secondary/80 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
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
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl"
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
                    const clampedCurrent = Math.min(currentFlow, Math.max(0, flowItems.length - 1))
                    const current = flowItems[clampedCurrent]
                    const currentStepIdx = current ? current.stepIndex : 0
                    // On the prep step there's no instruction step: show all
                    // ingredients unsplit in the ingredients sheet.
                    const currentStepRecs = currentStepIdx >= 0 ? (ingredsByStep[currentStepIdx]?.recommended || []) : []
                    const currentStepOthers = currentStepIdx >= 0 ? (ingredsByStep[currentStepIdx]?.others || []) : (listIngreds || [])
                    const currentPrepRecs = prepByStep[currentStepIdx]?.recommended || []
                    const relevantPrepCount = current && current.kind === 'prep'
                        ? prepWork.filter((_: any, i: number) => !checkedPrep.has(i)).length
                        : currentPrepRecs.filter((p: any) => {
                            const realIdx = prepWork.findIndex((w: any) => w.action === p.action && w.ingredient === p.ingredient)
                            return realIdx >= 0 && !checkedPrep.has(realIdx)
                        }).length

                    const isLast = clampedCurrent >= flowItems.length - 1
                    const currentStepTimers = timersByStep[currentStepIdx] || []
                    const runningCurrentTimer = currentStepTimers.find((t: any) => ['active', 'paused', 'overdue'].includes(getTimerStatus(t.id)))
                    const runningTimerCount = cookingTimers.filter((t: any) => t.type === 'timer' && ['active', 'paused', 'overdue'].includes(getTimerStatus(t.id))).length
                        + customTimers.filter((t: any) => ['active', 'paused', 'overdue'].includes(getTimerStatus(t.id))).length
                    const allRecipeTimers = sortTimersByStartTime(cookingTimers.filter((t: any) => t.type === 'timer'))

                    const jumpTo = (idx: number) => setCurrentFlow(Math.max(0, Math.min(idx, flowItems.length - 1)))
                    const goBack = () => setCurrentFlow(Math.max(0, clampedCurrent - 1))
                    const openSheet = (name: 'prep' | 'ingredients' | 'timers') => setActiveSheet(prev => (prev === name ? 'none' : name))

                    const formatCountdown = (remaining: number) => {
                        const sign = remaining < 0 ? '-' : ''
                        const abs = Math.abs(remaining)
                        const mins = Math.floor(abs / 60)
                        const secs = abs % 60
                        return `${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                    }

                    const advance = () => {
                        if (isLast) {
                            if (runningTimerCount > 0 || customTimers.length > 0) setFinishConfirm(true)
                            else closeCooking()
                            return
                        }
                        setDoneFlow(prev => new Set([...Array.from(prev), clampedCurrent]))
                        // Timers the user never started are ticked off as if they
                        // completed — skipping a step means they manage timing themselves.
                        ;(timersByStep[flowItems[clampedCurrent].stepIndex] || []).forEach((t: any) => {
                            if (getTimerStatus(t.id) === 'pending') completeTimer(t)
                        })
                        setCurrentFlow(clampedCurrent + 1)
                    }

                    const nextLabel = isLast ? 'Finish' : 'Next step'
                    const nextHint = runningCurrentTimer
                        ? (getTimerStatus(runningCurrentTimer.id) === 'overdue'
                            ? `${runningCurrentTimer.name || 'Timer'} is overdue`
                            : `${runningCurrentTimer.name || 'Timer'} keeps running`)
                        : isLast && runningTimerCount > 0
                            ? `${runningTimerCount} timer${runningTimerCount > 1 ? 's' : ''} still running`
                            : ''

                    const renderProgressTrack = (timer: any, progress: number, checkpointsHit: string[]) => {
                        const checkpoints = cookingTimers.filter((t: any) => t.parentTimerId === timer.id && t.type === 'checkpoint')
                        const totalSeconds = (timer.duration || 0) * 60
                        return (
                            <>
                                <div className="cooking-progress-track">
                                    <div className="cooking-progress-fill" style={{ width: `${progress}%` }} />
                                    {checkpoints.map((ckpt: any) => {
                                        const offset = ckpt.dependencies?.[0]?.offset || 0
                                        const pct = totalSeconds > 0 ? (offset / totalSeconds) * 100 : 0
                                        return (
                                            <div
                                                key={ckpt.id}
                                                className={`cooking-progress-marker ${checkpointsHit.includes(ckpt.id) ? 'is-hit' : ''}`}
                                                style={{ left: `${pct}%` }}
                                                title={ckpt.name}
                                            />
                                        )
                                    })}
                                </div>
                                {checkpoints.length > 0 && (
                                    <div className="cooking-progress-labels">
                                        {checkpoints.map((ckpt: any) => {
                                            const offset = ckpt.dependencies?.[0]?.offset || 0
                                            return (
                                                <span key={ckpt.id} className={checkpointsHit.includes(ckpt.id) ? 'is-hit' : ''}>
                                                    {ckpt.name} ({offset}m)
                                                </span>
                                            )
                                        })}
                                    </div>
                                )}
                            </>
                        )
                    }

                    // First flow item (only when the recipe has prep work):
                    // a quick run-through of the prep checklist. Ticks are shared
                    // with the recipe page.
                    const renderPrepCard = (idx: number, state: 'done' | 'current' | 'upcoming') => {
                        const total = prepWork.length
                        const ticked = prepWork.filter((_: any, i: number) => checkedPrep.has(i)).length
                        return (
                            <div
                                key={idx}
                                ref={(el: HTMLDivElement | null) => { cardRefs.current[idx] = el }}
                                className="cooking-step-group"
                            >
                                <div
                                    className={`cooking-card cooking-card-prep is-${state} ${state === 'done' ? 'is-clickable' : ''}`}
                                    onClick={state === 'done' ? () => jumpTo(idx) : undefined}
                                >
                                    <div className="cooking-card-top">
                                        {state === 'current' ? (
                                            <span className="cooking-card-label is-accent"><ChefHat size={13} /> Prep work · {total - ticked} to do</span>
                                        ) : state === 'done' ? (
                                            <span className="cooking-card-label"><Check size={13} strokeWidth={3} /> Prep work</span>
                                        ) : (
                                            <span className="cooking-card-label"><ChefHat size={13} /> Prep work</span>
                                        )}
                                    </div>
                                    {state === 'current' ? (
                                        <>
                                            <p className="cooking-card-text is-current">Quick prep run — get these ready first</p>
                                            {renderPrepContent()}
                                            {ticked === total && (
                                                <div className="cooking-prep-all-done"><Check size={14} strokeWidth={3} /> All prep done — ready to cook</div>
                                            )}
                                            <div className="cooking-current-hint">Ready? Move on below</div>
                                        </>
                                    ) : (
                                        <p className={`cooking-card-text is-${state}`}>
                                            {ticked > 0 ? `${ticked} of ${total} ticked off` : `${total} task${total > 1 ? 's' : ''} to get ready`}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    const renderStepCard = (item: any, idx: number, state: 'done' | 'current' | 'upcoming', isNext: boolean) => {
                        const text = instructions[item.stepIndex]?.Text || ''
                        const recs = ingredsByStep[item.stepIndex]?.recommended || []
                        const prepRecs = prepByStep[item.stepIndex]?.recommended || []
                        const uncheckedPrep = prepRecs.filter((p: any) => {
                            const realIdx = prepWork.findIndex((w: any) => w.action === p.action && w.ingredient === p.ingredient)
                            return realIdx >= 0 && !checkedPrep.has(realIdx)
                        })
                        const showChips = state === 'current' || (state === 'upcoming' && isNext)
                        const stepTimers = timersByStep[item.stepIndex] || []
                        return (
                            <div
                                key={idx}
                                ref={(el: HTMLDivElement | null) => { cardRefs.current[idx] = el }}
                                className="cooking-step-group"
                            >
                                <div
                                    className={`cooking-card cooking-card-step is-${state} ${isNext && state === 'upcoming' ? 'is-next' : ''} ${state === 'done' ? 'is-clickable' : ''}`}
                                    onClick={state === 'done' ? () => jumpTo(idx) : undefined}
                                >
                                    <div className="cooking-card-top">
                                        {state === 'done' && (
                                            <span className="cooking-card-label"><Check size={13} strokeWidth={3} /> Step {item.stepIndex + 1}</span>
                                        )}
                                        {state === 'current' && (
                                            <span className="cooking-card-label is-accent">Step {item.stepIndex + 1} of {instructions.length}</span>
                                        )}
                                        {state === 'upcoming' && (
                                            <span className="cooking-card-label">{isNext ? 'Up next' : `Step ${item.stepIndex + 1}`}</span>
                                        )}
                                        {state !== 'current' && (item.stepIndex + 1) === instructions.length && (
                                            <span className="cooking-card-label">Last step</span>
                                        )}
                                    </div>
                                    <p className={`cooking-card-text is-${state}`}>{text}</p>
                                    {showChips && recs.length > 0 && (
                                        <div className="cooking-chips">
                                            {recs.map((ingred: any, ci: number) => (
                                                <span key={ci} className="cooking-chip">
                                                    <span className="cooking-chip-name">{ingred.name}</span>
                                                    <span className="cooking-chip-qty">{ingred.quantity} {ingred.quantity_type_shorthand || ingred.quantity_type}</span>
                                                    {ingred.note && <span className="cooking-chip-note" title={ingred.note}>{ingred.note}</span>}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {state === 'current' && uncheckedPrep.length > 0 && (() => {
                                        const firstPrep = uncheckedPrep[0]
                                        const extra = uncheckedPrep.length - 1
                                        return (
                                            <button className="cooking-prep-hint" onClick={() => setActiveSheet('prep')}>
                                                <span className="cooking-prep-hint-task">
                                                    <ChefHat size={12} />
                                                    <span className="cooking-prep-hint-text">
                                                        {firstPrep.ingredient && <strong>{firstPrep.ingredient}: </strong>}
                                                        {firstPrep.action}
                                                        {getPrepIngredientQty(firstPrep.ingredient) && <span className="cooking-prep-qty"> [ {getPrepIngredientQty(firstPrep.ingredient)} ]</span>}
                                                        {extra > 0 && <span className="cooking-prep-hint-more"> +{extra} more</span>}
                                                    </span>
                                                </span>
                                                <span className="cooking-prep-hint-cta">tap to view</span>
                                            </button>
                                        )
                                    })()}
                                    {state === 'current' && (
                                        <div className="cooking-current-hint">Finished here? Move on below</div>
                                    )}
                                </div>
                                {stepTimers.map((t: any) => renderTimerTab(t, state))}
                            </div>
                        )
                    }

                    // Timer attached to its step: pokes out underneath the step card,
                    // suggests/controls the timer that helps complete the step.
                    const renderTimerTab = (timer: any, state: 'done' | 'current' | 'upcoming') => {
                        const status = getTimerStatus(timer.id)
                        const session = activeSession[timer.id]
                        const remaining = session ? getRemaining(session, nowMs) : timer.duration * 60
                        const progress = getTimerProgress(timer, session, nowMs)
                        const checkpointsHit = session?.checkpointsHit || []
                        const endTime = session?.endTime ? new Date(session.endTime) : null
                        const finishTimeStr = endTime ? endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

                        const hasDep = timer.dependencies?.[0]?.timerId && timer.dependencies[0].timerId !== 'start'
                        const depTimerId = hasDep ? timer.dependencies[0].timerId : null
                        const depDone = !depTimerId || activeSession[depTimerId]?.status === 'completed'
                        const depName = depTimerId ? (getTimerById(cookingTimers, depTimerId)?.name || 'the previous timer') : ''
                        const name = timer.name || 'Timer'
                        const live = status === 'active' || status === 'paused' || status === 'overdue'
                        const isOverdue = status === 'overdue'

                        if (state === 'done') {
                            if (live) {
                                return (
                                    <div key={timer.id} className={`cooking-timer-tab is-live ${isOverdue ? 'is-overdue' : ''}`}>
                                        <div className="cooking-timer-tab-head">
                                            <span className="cooking-timer-tab-name is-accent"><Clock size={12} /> {name}</span>
                                            <span className={`cooking-countdown is-inline ${isOverdue ? 'is-overdue' : ''}`}>{formatCountdown(remaining)}</span>
                                        </div>
                                        <div className="cooking-progress-wrap">{renderProgressTrack(timer, progress, checkpointsHit)}</div>
                                        {isOverdue && (
                                            <div className="cooking-timer-actions">
                                                <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 2)}>+2 min</button>
                                                <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 5)}>+5 min</button>
                                                <button className="cooking-timer-btn is-primary" onClick={() => completeTimer(timer)}>Done ✓</button>
                                            </div>
                                        )}
                                    </div>
                                )
                            }
                            return (
                                <div key={timer.id} className="cooking-timer-tab is-muted">
                                    <div className="cooking-timer-tab-head">
                                        <span className="cooking-timer-tab-name"><Check size={12} strokeWidth={3} /> {name} · {status === 'completed' ? 'done' : 'skipped'}</span>
                                        <button className="cooking-mgr-link" onClick={() => resetTimer(timer)}>Reset</button>
                                    </div>
                                </div>
                            )
                        }

                        if (state === 'upcoming') {
                            return (
                                <div key={timer.id} className="cooking-timer-tab is-muted">
                                    <div className="cooking-timer-tab-head">
                                        <span className="cooking-timer-tab-name"><Clock size={12} /> {name} · {timer.duration} min</span>
                                    </div>
                                </div>
                            )
                        }

                        if (live) {
                            return (
                                <div key={timer.id} className={`cooking-timer-tab is-accent ${isOverdue ? 'is-overdue' : ''}`}>
                                    <div className="cooking-timer-tab-head">
                                        <span className="cooking-timer-tab-name is-accent"><Clock size={12} /> {name}</span>
                                        {isOverdue ? (
                                            <span className="cooking-timer-tag is-overdue">Overdue</span>
                                        ) : status === 'paused' && (
                                            <span className="cooking-timer-tag">Paused</span>
                                        )}
                                    </div>
                                    <div className={`cooking-countdown ${isOverdue ? 'is-overdue' : ''}`}>{formatCountdown(remaining)}</div>
                                    {!isOverdue && finishTimeStr && <div className="cooking-countdown-sub">Done at {finishTimeStr}</div>}
                                    <div className="cooking-progress-wrap">{renderProgressTrack(timer, progress, checkpointsHit)}</div>
                                    {isOverdue ? (
                                        <>
                                            <div className="cooking-extend-row">
                                                <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 2)}>+2 min</button>
                                                <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 5)}>+5 min</button>
                                                {customExtendId === timer.id ? (
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="999"
                                                        value={customExtendMin}
                                                        onChange={(e) => setCustomExtendMin(e.target.value)}
                                                        placeholder="min"
                                                        autoFocus
                                                        className="cooking-extend-input"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && customExtendMin) { extendTimer(timer, parseInt(customExtendMin)); setCustomExtendId(null); setCustomExtendMin("") }
                                                            if (e.key === 'Escape') { setCustomExtendId(null); setCustomExtendMin("") }
                                                        }}
                                                    />
                                                ) : (
                                                    <button className="cooking-timer-btn" onClick={() => setCustomExtendId(timer.id)}>+X</button>
                                                )}
                                            </div>
                                            <button
                                                className="cooking-start-timer"
                                                onClick={() => completeTimer(timer)}
                                            >
                                                <Check size={16} strokeWidth={3} />
                                                Done — dismiss
                                            </button>
                                            <p className="cooking-timer-note">Rings every 4s until you dismiss or extend it</p>
                                        </>
                                    ) : (
                                        <div className="cooking-timer-actions">
                                            <button className="cooking-timer-btn" onClick={() => pauseResumeTimer(timer)}>{status === 'active' ? 'Pause' : 'Resume'}</button>
                                            <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 5)}>+5 min</button>
                                            <button className="cooking-timer-btn is-primary" onClick={() => completeTimer(timer)}>Done ✓</button>
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        if (status === 'completed') {
                            return (
                                <div key={timer.id} className="cooking-timer-tab is-muted">
                                    <div className="cooking-timer-tab-head">
                                        <span className="cooking-timer-tab-name"><Check size={12} strokeWidth={3} /> {name} · done</span>
                                        <div className="cooking-mgr-head-actions">
                                            <button className="cooking-mgr-link" onClick={() => extendTimer(timer, 2)}>+2 min</button>
                                            <button className="cooking-mgr-link" onClick={() => resetTimer(timer)}>Reset</button>
                                        </div>
                                    </div>
                                    <div className="cooking-timer-tab-note">Skipped by accident? Reset to run it with this step.</div>
                                </div>
                            )
                        }

                        return (
                            <div key={timer.id} className={`cooking-timer-tab ${depDone ? 'is-accent' : 'is-muted'}`}>
                                <div className="cooking-timer-tab-head">
                                    <span className={`cooking-timer-tab-name ${depDone ? 'is-accent' : ''}`}>
                                        <Clock size={12} /> {name} · {timer.duration} min
                                    </span>
                                </div>
                                {!depDone ? (
                                    <div className="cooking-timer-tab-note">Waiting for “{depName}” to finish</div>
                                ) : (
                                    <div className="cooking-timer-tab-note">Run a timer to help with this step</div>
                                )}
                                <button
                                    className="cooking-start-timer"
                                    disabled={!depDone}
                                    onClick={() => startTimer(timer)}
                                >
                                    <Clock size={16} />
                                    Start {timer.duration} min timer
                                </button>
                            </div>
                        )
                    }

                    const renderManagerTimerCard = (timer: any) => {
                        const status = getTimerStatus(timer.id)
                        const session = activeSession[timer.id]
                        const remaining = session ? getRemaining(session, nowMs) : timer.duration * 60
                        const minutes = Math.floor(remaining / 60)
                        const seconds = remaining % 60
                        const progress = getTimerProgress(timer, session, nowMs)
                        const checkpointsHit = session?.checkpointsHit || []

                        const hasDep = timer.dependencies?.[0]?.timerId && timer.dependencies[0].timerId !== 'start'
                        const depTimerId = hasDep ? timer.dependencies[0].timerId : null
                        const depDone = !depTimerId || activeSession[depTimerId]?.status === 'completed'
                        const depName = depTimerId ? (getTimerById(cookingTimers, depTimerId)?.name || 'previous timer') : ''
                        const isPastStep = timer.stepIndex != null && timer.stepIndex < currentStepIdx

                        if (status === 'active' || status === 'paused' || status === 'overdue') {
                            const isOverdue = status === 'overdue'
                            return (
                                <div key={timer.id} className={`cooking-mgr-card is-${status}`}>
                                    <div className="cooking-mgr-head">
                                        <span className="cooking-mgr-name">{timer.name}</span>
                                        <div className="cooking-mgr-head-actions">
                                            {isOverdue && <span className="cooking-timer-tag is-overdue">Overdue</span>}
                                            <button className="cooking-mgr-link" onClick={() => resetTimer(timer)}>Reset</button>
                                        </div>
                                    </div>
                                    {editingTimerId === timer.id ? (
                                        <div className="cooking-mgr-edit">
                                            <div className="cooking-mgr-edit-inputs">
                                                <input type="number" min="0" max="999" value={editTimerMinutes} onChange={(e) => setEditTimerMinutes(e.target.value)} placeholder="00" />
                                                <span className="cooking-mgr-edit-sep">:</span>
                                                <input type="number" min="0" max="59" value={editTimerSeconds} onChange={(e) => setEditTimerSeconds(e.target.value)} placeholder="00" />
                                            </div>
                                            <div className="cooking-timer-actions">
                                                <button className="cooking-timer-btn" onClick={() => setEditingTimerId(null)}>Cancel</button>
                                                <button className="cooking-timer-btn is-primary" onClick={() => {
                                                    const mins = parseInt(editTimerMinutes) || 0
                                                    const secs = parseInt(editTimerSeconds) || 0
                                                    const totalSecs = mins * 60 + secs
                                                    if (totalSecs <= 0) return
                                                    setTimerRemaining(timer, totalSecs)
                                                    setEditingTimerId(null)
                                                }}>Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`cooking-mgr-countdown ${isOverdue ? 'is-overdue' : ''}`}
                                            onClick={() => { setEditingTimerId(timer.id); setEditTimerMinutes(String(Math.max(0, minutes))); setEditTimerSeconds(String(Math.max(0, seconds))) }}
                                        >
                                            {formatCountdown(remaining)}
                                            <span className="cooking-mgr-countdown-hint">tap to adjust</span>
                                        </div>
                                    )}
                                    <div className="cooking-progress-wrap">
                                        {renderProgressTrack(timer, progress, checkpointsHit)}
                                    </div>
                                    {isOverdue ? (
                                        <div className="cooking-timer-actions">
                                            <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 2)}>+2 min</button>
                                            <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 5)}>+5 min</button>
                                            <button className="cooking-timer-btn is-primary" onClick={() => completeTimer(timer)}>Done ✓</button>
                                        </div>
                                    ) : (
                                        <div className="cooking-timer-actions">
                                            <button className="cooking-timer-btn" onClick={() => pauseResumeTimer(timer)}>{status === 'active' ? 'Pause' : 'Resume'}</button>
                                            <button className="cooking-timer-btn" onClick={() => addTimerSeconds(timer, 300)}>+5 min</button>
                                            <button className="cooking-timer-btn is-primary" onClick={() => completeTimer(timer)}>Done ✓</button>
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        if (status === 'pending') {
                            return (
                                <div key={timer.id} className="cooking-mgr-card is-pending">
                                    <div className="cooking-mgr-head">
                                        <span className="cooking-mgr-name">{timer.name}</span>
                                        {timer.stepIndex != null && <span className="cooking-mgr-tag">Step {timer.stepIndex + 1}</span>}
                                    </div>
                                    {isPastStep ? (
                                        <button className="cooking-timer-btn is-full" onClick={() => completeTimer(timer)}>✓ Mark complete</button>
                                    ) : !depDone ? (
                                        <div className="cooking-mgr-waiting">Waiting for {depName}</div>
                                    ) : (
                                        <button className="cooking-timer-btn is-full is-accent" onClick={() => startTimer(timer)}>Start {timer.duration} min</button>
                                    )}
                                </div>
                            )
                        }

                        return (
                            <div key={timer.id} className="cooking-mgr-card is-completed">
                                <div className="cooking-mgr-head">
                                    <span className="cooking-mgr-name is-done">{timer.name}</span>
                                    <button className="cooking-mgr-link" onClick={() => resetTimer(timer)}>Restart</button>
                                </div>
                            </div>
                        )
                    }

                    const removeCustomTimer = (timerId: string) => {
                        setCustomTimers(prev => prev.filter(t => t.id !== timerId))
                        setActiveSession(prev => { const n = { ...prev }; delete n[timerId]; return n })
                    }

                    const renderTimersContent = () => {
                        const running = allRecipeTimers.filter((t: any) => ['active', 'paused'].includes(getTimerStatus(t.id)))
                        const pending = allRecipeTimers.filter((t: any) => getTimerStatus(t.id) === 'pending')
                        const completed = allRecipeTimers.filter((t: any) => getTimerStatus(t.id) === 'completed')
                        return (
                            <div className="cooking-section-list">
                                {running.map(renderManagerTimerCard)}
                                {pending.length > 0 && <div className="cooking-mgr-group-label">Upcoming</div>}
                                {pending.map(renderManagerTimerCard)}
                                {completed.length > 0 && <div className="cooking-mgr-group-label">Completed ({completed.length})</div>}
                                {completed.map(renderManagerTimerCard)}
                                {customTimers.length > 0 && <div className="cooking-mgr-group-label">Custom timers</div>}
                                {customTimers.map((timer) => {
                                    const status = getTimerStatus(timer.id)
                                    const session = activeSession[timer.id]
                                    const remaining = session ? getRemaining(session, nowMs) : timer.duration * 60
                                    const minutes = Math.floor(remaining / 60)
                                    const seconds = remaining % 60
                                    const progress = getTimerProgress(timer, session, nowMs)
                                    const isOverdue = status === 'overdue'
                                    if (status === 'active' || status === 'paused' || status === 'overdue') {
                                        return (
                                            <div key={timer.id} className={`cooking-mgr-card is-${status}`}>
                                                <div className="cooking-mgr-head">
                                                    <span className="cooking-mgr-name">{timer.name}</span>
                                                    <div className="cooking-mgr-head-actions">
                                                        {isOverdue && <span className="cooking-timer-tag is-overdue">Overdue</span>}
                                                        <button className="cooking-mgr-link" onClick={() => resetTimer(timer)}>Reset</button>
                                                        <button className="cooking-mgr-link is-danger" onClick={() => removeCustomTimer(timer.id)}>✕</button>
                                                    </div>
                                                </div>
                                                <div className={`cooking-mgr-countdown ${isOverdue ? 'is-overdue' : ''}`}>{formatCountdown(remaining)}</div>
                                                <div className="cooking-progress-wrap">
                                                    <div className="cooking-progress-track">
                                                        <div className="cooking-progress-fill" style={{ width: `${progress}%` }} />
                                                    </div>
                                                </div>
                                                {isOverdue ? (
                                                    <div className="cooking-timer-actions">
                                                        <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 2)}>+2 min</button>
                                                        <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 5)}>+5 min</button>
                                                        <button className="cooking-timer-btn is-primary" onClick={() => completeTimer(timer)}>Done ✓</button>
                                                    </div>
                                                ) : (
                                                    <div className="cooking-timer-actions">
                                                        <button className="cooking-timer-btn" onClick={() => pauseResumeTimer(timer)}>{status === 'active' ? 'Pause' : 'Resume'}</button>
                                                        <button className="cooking-timer-btn" onClick={() => addTimerSeconds(timer, 300)}>+5 min</button>
                                                        <button className="cooking-timer-btn is-primary" onClick={() => completeTimer(timer)}>Done ✓</button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }
                                    if (status === 'completed') {
                                        return (
                                            <div key={timer.id} className="cooking-mgr-card is-completed">
                                                <div className="cooking-mgr-head">
                                                    <span className="cooking-mgr-name is-done">{timer.name}</span>
                                                    <div className="cooking-mgr-head-actions">
                                                        <button className="cooking-mgr-link" onClick={() => resetTimer(timer)}>Restart</button>
                                                        <button className="cooking-mgr-link is-danger" onClick={() => removeCustomTimer(timer.id)}>✕</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }
                                    return (
                                        <div key={timer.id} className="cooking-mgr-card is-pending">
                                            <div className="cooking-mgr-head">
                                                <span className="cooking-mgr-name">{timer.name}</span>
                                                <button className="cooking-mgr-link is-danger" onClick={() => removeCustomTimer(timer.id)}>✕</button>
                                            </div>
                                            <button className="cooking-timer-btn is-full is-accent" onClick={() => startTimer(timer)}>Start {timer.duration} min</button>
                                        </div>
                                    )
                                })}
                                <div className="cooking-add-timer">
                                    <input
                                        value={customTimerName}
                                        onChange={(e) => setCustomTimerName(e.target.value)}
                                        placeholder="Custom timer name"
                                        className="cooking-add-timer-name"
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        max="999"
                                        value={customTimerMinutes}
                                        onChange={(e) => setCustomTimerMinutes(e.target.value)}
                                        placeholder="min"
                                        className="cooking-add-timer-mins"
                                    />
                                    <button
                                        className="cooking-timer-btn is-accent"
                                        onClick={() => {
                                            const mins = parseInt(customTimerMinutes)
                                            if (!customTimerName.trim() || !mins || mins <= 0) return
                                            const newId = `custom-${Date.now()}`
                                            setCustomTimers(prev => [...prev, { id: newId, name: customTimerName.trim(), duration: mins }])
                                            setActiveSession(prev => ({
                                                ...prev,
                                                [newId]: { endTime: Date.now() + mins * 60 * 1000, remaining: mins * 60, status: 'active', checkpointsHit: [] }
                                            }))
                                            setCustomTimerName("")
                                            setCustomTimerMinutes("")
                                        }}
                                    >
                                        <Plus size={14} /> Add
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    const renderIngredientsContent = () => (
                        <div className="cooking-section-list">
                            {currentStepRecs.length > 0 && (
                                <>
                                    <div className="cooking-mgr-group-label">For this step</div>
                                    <div className="cooking-ingredients-grid">
                                        {currentStepRecs.map((ingred: any, idx: number) => (
                                            <div key={`rec-${idx}`} className="cooking-ingredient-card is-recommended">
                                                <span className="cooking-ingredient-name">{ingred.name}</span>
                                                <span className="cooking-ingredient-qty">{ingred.quantity} {ingred.quantity_type_shorthand || ingred.quantity_type}</span>
                                                {ingred.note && <span className="cooking-ingredient-note" title={ingred.note}>{ingred.note}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                            {currentStepOthers.length > 0 && (
                                <>
                                    <div className="cooking-mgr-group-label">All ingredients</div>
                                    <div className="cooking-ingredients-grid">
                                        {currentStepOthers.map((ingred: any, idx: number) => (
                                            <div key={`other-${idx}`} className="cooking-ingredient-card">
                                                <span className="cooking-ingredient-name">{ingred.name}</span>
                                                <span className="cooking-ingredient-qty">{ingred.quantity} {ingred.quantity_type_shorthand || ingred.quantity_type}</span>
                                                {ingred.note && <span className="cooking-ingredient-note" title={ingred.note}>{ingred.note}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )

                    const renderPrepContent = () => (
                        <div className="cooking-section-list">
                            {prepWork.map((item: any, index: number) => {
                                const isRecommended = currentPrepRecs.some((r: any) => r.action === item.action && r.ingredient === item.ingredient)
                                const qty = getPrepIngredientQty(item.ingredient)
                                return (
                                    <div key={index} className={`cooking-prep-item ${isRecommended ? 'is-recommended' : ''} ${checkedPrep.has(index) ? 'is-checked' : ''}`}>
                                        <button
                                            onClick={() => {
                                                const next = new Set(checkedPrep)
                                                if (next.has(index)) next.delete(index)
                                                else next.add(index)
                                                setCheckedPrep(next)
                                            }}
                                            className="cooking-prep-checkbox"
                                            aria-label="Toggle prep task"
                                        >
                                            {checkedPrep.has(index) && <Check size={12} strokeWidth={3} />}
                                        </button>
                                        <span className="cooking-prep-text">
                                            {item.ingredient && <strong>{item.ingredient}: </strong>}
                                            {item.action}
                                            {qty && <span className="cooking-prep-qty"> [ {qty} ]</span>}
                                        </span>
                                        {item.timeEstimate && <span className="cooking-prep-time">~{item.timeEstimate}m</span>}
                                    </div>
                                )
                            })}
                        </div>
                    )

                    return (
                        <div className="cooking-mode-overlay">
                            <header className="cooking-mode-header">
                                <button className="cooking-icon-btn" onClick={() => { setIsCookingMode(false); setDoneFlow(new Set()) }} aria-label="Exit cooking mode">
                                    <img src="/cross.png" className="w-4 h-4 invert-[.25] dark:invert" alt="close" />
                                </button>
                                <div className="cooking-header-center">
                                    <div className="cooking-header-title">
                                        {current ? (
                                            current.kind === 'prep'
                                                ? <>Prep work</>
                                                : <>Step {current.stepIndex + 1} of {instructions.length}</>
                                        ) : 'Cooking'}
                                    </div>
                                    <div className="cooking-progress">
                                        {flowItems.map((item, idx) => {
                                            const segDone = idx < clampedCurrent || doneFlow.has(idx)
                                            const segCurrent = idx === clampedCurrent
                                            const label = item.kind === 'prep' ? 'Prep work' : `Step ${item.stepIndex + 1}`
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => jumpTo(idx)}
                                                    className={`cooking-progress-seg ${segDone ? 'is-done' : ''} ${segCurrent ? 'is-current' : ''}`}
                                                    title={label}
                                                    aria-label={label}
                                                />
                                            )
                                        })}
                                    </div>
                                </div>
                                <button className="cooking-icon-btn" onClick={() => setResetConfirm(true)} aria-label="Reset cooking session">
                                    <RotateCcw size={15} />
                                </button>
                            </header>

                            <div className="cooking-mode-body">
                                <div className="cooking-timeline">
                                    {flowItems.map((item, idx) => {
                                        const state = idx < clampedCurrent ? 'done' : idx === clampedCurrent ? 'current' : 'upcoming'
                                        const isNext = idx === clampedCurrent + 1
                                        return item.kind === 'prep'
                                            ? renderPrepCard(idx, state)
                                            : renderStepCard(item, idx, state, isNext)
                                    })}
                                    {flowItems.length === 0 && (
                                        <div className="cooking-empty">This recipe has no steps yet.</div>
                                    )}
                                </div>

                                <aside className="cooking-sidebar">
                                    <section className="cooking-sidebar-section">
                                        <h3 className="cooking-sidebar-title">Ingredients</h3>
                                        {renderIngredientsContent()}
                                    </section>
                                    {prepWork.length > 0 && (
                                        <section className="cooking-sidebar-section">
                                            <h3 className="cooking-sidebar-title">Prep work</h3>
                                            {renderPrepContent()}
                                        </section>
                                    )}
                                    {(allRecipeTimers.length > 0 || customTimers.length > 0) && (
                                        <section className="cooking-sidebar-section">
                                            <h3 className="cooking-sidebar-title">Timers</h3>
                                            {renderTimersContent()}
                                        </section>
                                    )}
                                </aside>
                            </div>

                            <div className={`cooking-sheet ${activeSheet !== 'none' ? 'open' : ''}`}>
                                <div className="cooking-sheet-handle" onClick={() => setActiveSheet('none')} />
                                <div className="cooking-sheet-head">
                                    <h3 className="cooking-sheet-title">
                                        {activeSheet === 'prep' ? 'Prep work' : activeSheet === 'ingredients' ? 'Ingredients' : 'Timers'}
                                    </h3>
                                    <button onClick={() => setActiveSheet('none')} className="cooking-sheet-close">Close</button>
                                </div>
                                <div className="cooking-sheet-scroll">
                                    {activeSheet === 'prep' && renderPrepContent()}
                                    {activeSheet === 'ingredients' && renderIngredientsContent()}
                                    {activeSheet === 'timers' && renderTimersContent()}
                                </div>
                            </div>

                            <div className="cooking-tabs">
                                {prepWork.length > 0 && (
                                    <button className={`cooking-tab ${activeSheet === 'prep' ? 'is-open' : ''}`} onClick={() => openSheet('prep')}>
                                        <ChefHat size={15} /> Prep
                                        {relevantPrepCount > 0 && <span className="cooking-tab-badge">{relevantPrepCount}</span>}
                                    </button>
                                )}
                                <button className={`cooking-tab ${activeSheet === 'ingredients' ? 'is-open' : ''}`} onClick={() => openSheet('ingredients')}>
                                    <ShoppingBasket size={15} /> Ingredients
                                </button>
                                {(allRecipeTimers.length > 0 || customTimers.length > 0) && (
                                    <button className={`cooking-tab ${activeSheet === 'timers' ? 'is-open' : ''}`} onClick={() => openSheet('timers')}>
                                        <Clock size={15} /> Timers
                                        {runningTimerCount > 0 && <span className="cooking-tab-badge is-accent">{runningTimerCount}</span>}
                                    </button>
                                )}
                            </div>

                            <div className="cooking-mode-controls">
                                {nextHint && (
                                    <div className="cooking-next-hint">
                                        <Clock size={12} /> {nextHint}
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    className="cooking-back-btn"
                                    onClick={goBack}
                                    disabled={clampedCurrent === 0}
                                >
                                    <ChevronLeft size={18} /> Back
                                </Button>
                                <Button
                                    className="cooking-next-btn is-primary"
                                    onClick={advance}
                                >
                                    {nextLabel}
                                    {nextLabel !== 'Finish' && <ChevronRight size={18} />}
                                </Button>
                            </div>
                            {/* Overdue alarm — alarm-clock takeover over the whole cooking
                                screen (steps, sheets and Back/Next included). The going-off
                                timer sits centered; other running timers stay muted below.
                                Never auto-navigates. */}
                            {(() => {
                                const visibleOverdue: any[] = [
                                    ...cookingTimers.filter((t: any) => t.type === 'timer' && getTimerStatus(t.id) === 'overdue'),
                                    ...customTimers.filter((t: any) => getTimerStatus(t.id) === 'overdue'),
                                ].filter((t: any) => !alarmPopupClosed.has(t.id))
                                if (visibleOverdue.length === 0) return null

                                // Everything else that is running (never pending — not started means not shown)
                                const runningTimers: any[] = [
                                    ...cookingTimers.filter((t: any) => t.type === 'timer' && ['active', 'paused'].includes(getTimerStatus(t.id))),
                                    ...customTimers.filter((t: any) => ['active', 'paused'].includes(getTimerStatus(t.id))),
                                ].sort((a: any, b: any) => {
                                    const sa = activeSession[a.id]
                                    const sb = activeSession[b.id]
                                    const pa = sa?.status === 'paused' ? 1 : 0
                                    const pb = sb?.status === 'paused' ? 1 : 0
                                    if (pa !== pb) return pa - pb
                                    return getRemaining(sa, nowMs) - getRemaining(sb, nowMs)
                                })

                                return (
                                    <div className="cooking-alarm-wrap" role="alert">
                                        <div className="cooking-alarm-note">
                                            <Clock size={12} />
                                            {visibleOverdue.length > 1 ? `${visibleOverdue.length} timers overdue` : 'Timer overdue'} · rings every 4s
                                        </div>
                                        <div className="cooking-alarm-items">
                                            {visibleOverdue.map((timer: any) => {
                                                const session = activeSession[timer.id]
                                                const remaining = session ? getRemaining(session, nowMs) : 0
                                                const stepFlowIdx = typeof timer.stepIndex === 'number'
                                                    ? flowItems.findIndex(f => f.kind === 'step' && f.stepIndex === timer.stepIndex)
                                                    : -1
                                                return (
                                                    <div key={timer.id} className="cooking-alarm-item">
                                                        <span className="cooking-alarm-item-icon"><Clock size={22} /></span>
                                                        <span className="cooking-alarm-item-name">
                                                            {timer.name || 'Timer'}
                                                            <span className="cooking-timer-tag is-overdue">Overdue</span>
                                                        </span>
                                                        <span className="cooking-alarm-item-count">{formatCountdown(remaining)}</span>
                                                        <div className="cooking-extend-row">
                                                            <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 2)}>+2 min</button>
                                                            <button className="cooking-timer-btn" onClick={() => extendTimer(timer, 5)}>+5 min</button>
                                                            {customExtendId === timer.id ? (
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="999"
                                                                    value={customExtendMin}
                                                                    onChange={(e) => setCustomExtendMin(e.target.value)}
                                                                    placeholder="min"
                                                                    autoFocus
                                                                    className="cooking-extend-input"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && customExtendMin) { extendTimer(timer, parseInt(customExtendMin)); setCustomExtendId(null); setCustomExtendMin("") }
                                                                        if (e.key === 'Escape') { setCustomExtendId(null); setCustomExtendMin("") }
                                                                    }}
                                                                />
                                                            ) : (
                                                                <button className="cooking-timer-btn" onClick={() => setCustomExtendId(timer.id)}>+X</button>
                                                            )}
                                                        </div>
                                                        <button
                                                            className="cooking-start-timer"
                                                            onClick={() => completeTimer(timer)}
                                                        >
                                                            <Check size={16} strokeWidth={3} />
                                                            Done — dismiss
                                                        </button>
                                                        {stepFlowIdx >= 0 && (
                                                            <button
                                                                className="cooking-alarm-popup-view"
                                                                onClick={() => {
                                                                    jumpTo(stepFlowIdx)
                                                                    setAlarmPopupClosed(prev => new Set([...Array.from(prev), timer.id]))
                                                                }}
                                                            >
                                                                View step
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        {runningTimers.length > 0 && (
                                            <div className="cooking-alarm-running">
                                                <div className="cooking-alarm-running-label">
                                                    <span>Still running · {runningTimers.length}</span>
                                                </div>
                                                {runningTimers.map((timer: any) => {
                                                    const session = activeSession[timer.id]
                                                    const status = getTimerStatus(timer.id)
                                                    const remaining = session ? getRemaining(session, nowMs) : timer.duration * 60
                                                    const progress = getTimerProgress(timer, session, nowMs)
    return (
                                                        <div key={timer.id} className="cooking-alarm-running-row">
                                                            <div className="cooking-alarm-running-info">
                                                                <span className="cooking-alarm-running-name">
                                                                    {timer.name || 'Timer'}
                                                                    {status === 'paused' && <span className="cooking-timer-tag">Paused</span>}
                                                                </span>
                                                                <div className="cooking-progress-track">
                                                                    <div className="cooking-progress-fill" style={{ width: `${progress}%` }} />
                                                                </div>
                                                            </div>
                                                            <span className="cooking-countdown is-inline">{formatCountdown(remaining)}</span>
                                                            <div className="cooking-alarm-running-actions">
                                                                <button className="cooking-timer-btn" onClick={() => addTimerSeconds(timer, 300)}>+5</button>
                                                                <button className="cooking-timer-btn is-primary" onClick={() => completeTimer(timer)}>✓</button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                        </div>
                    )
                })()}

            {/* Finish Cooking Confirmation */}
            {finishConfirm && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-card border border-border/40 rounded-2xl p-5 max-w-sm mx-4 shadow-xl">
                        <h3 className="text-lg font-bold mb-2">Finish Cooking?</h3>
                        <p className="text-sm text-foreground/60 mb-4">
                            This will clear all timers, completed steps, and reset everything.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 h-11"
                                onClick={() => setFinishConfirm(false)}
                            >
                                Keep Cooking
                            </Button>
                            <Button
                                className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-600 text-white"
                                onClick={() => {
                                    setFinishConfirm(false)
                                    closeCooking()
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
                    <div className="bg-card border border-border/40 rounded-2xl p-5 max-w-sm mx-4 shadow-xl">
                        <h3 className="text-lg font-bold mb-2">Reset All?</h3>
                        <p className="text-sm text-foreground/60 mb-4">
                            This will clear all timers, completed steps, and go back to step 1.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 h-11"
                                onClick={() => setResetConfirm(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                className="flex-1 h-11"
                                onClick={() => {
                                    setResetConfirm(false)
                                    setActiveSession({})
                                    setCustomTimers([])
                                    setAlarmPopupClosed(new Set())
                                    if (id) {
                                        const keys = Object.keys(localStorage).filter(k => k.startsWith('timer-session-'))
                                        keys.forEach(k => localStorage.removeItem(k))
                                    }
                                    setCurrentFlow(0)
                                    setDoneFlow(new Set())
                                    setActiveSheet('none')
                                }}
                            >
                                Reset All
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {reExtractConfirm && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-card border border-border/40 rounded-2xl p-5 max-w-sm mx-4 shadow-xl">
                        <h3 className="text-lg font-bold mb-2">Re-extract Timers?</h3>
                        <p className="text-sm text-foreground/60 mb-4">
                            This replaces all current cooking timers with a fresh AI-generated plan. Manual timer edits will be lost.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 h-11"
                                onClick={() => setReExtractConfirm(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 h-11"
                                disabled={isExtractingTimers}
                                onClick={() => { setReExtractConfirm(false); extractTimers(true) }}
                            >
                                Re-extract
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clear Residual Timers Prompt */}
            {clearResidualPrompt.show && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-card border border-border/40 rounded-2xl p-5 max-w-sm mx-4 shadow-xl">
                        <h3 className="text-lg font-bold mb-2">Active Timers Found</h3>
                        <p className="text-sm text-foreground/60 mb-4">
                            You have active timers from another session. Would you like to clear them and start fresh?
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 h-11"
                                onClick={() => setClearResidualPrompt({ show: false, recipeName: '', recipeId: '' })}
                            >
                                Keep Them
                            </Button>
                            <Button
                                variant="destructive"
                                className="flex-1 h-11"
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
