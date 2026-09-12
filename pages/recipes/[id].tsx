import { Layout } from '../../components/Layout'
import { useEffect, useState, useRef, useMemo, Fragment } from 'react'
import { formatQuantityDisplay } from '../../lib/fractionFormat'
import { Button } from '../../components/ui/button'
import { Clock, Trash2, ChefHat, Check, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Loader2, ShoppingBasket, ListOrdered, MessageSquare, BarChart3, Plus, Eye, EyeOff, RotateCcw, RefreshCw, Pencil, Users, Download, Info, Hourglass, Flame, Scale, Minus } from 'lucide-react'
import { calculateRecipeWeight, formatWeight, formatScaledQuantity } from '../../lib/conversion'
import { buildFlowItems, computePhaseInsertPoints, fillCarbPhaseText, recommendCarbOption, resolveCarbSlot, resolveCarbTiming, resolveVariant } from '../../lib/carbSideOps'
import Router, { useRouter } from 'next/router'
import IngredientNutrientGraph from '../../components/IngredientNutrientGraph'
import IngredientCard from '../../components/IngredientCard'
import { IngredientSearchList } from '../../components/IngredientSearchList'
import { renderStepText, isLongStep, getIngredientStepMap, isGenericIngredientWord, splitSentences } from '../../components/stepText'
import IngredientPopover from '../../components/IngredientPopover'
import PillRow from '../../components/PillRow'
import Modal from 'react-modal'
import ExportRecipeModal from '../../components/ExportRecipeModal'
import { getColorForName } from '../../lib/colors'

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

// Grey scrim + white text: sits over the hero image on phones, same treatment
// as the "Change Image" badge so both read as one overlay system
const CHIP_OVERLAY = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 text-white backdrop-blur-sm'

// Timer involvement levels: how much attention the cook needs while a timer
// runs. none = walk away and come back when it rings, low = stay in the
// kitchen and check in every so often, active = hands-on the whole time.
const INVOLVEMENT_META: Record<string, { label: string; title: string }> = {
    none: { label: 'Walk away', title: 'You can walk away and come back when it rings' },
    low: { label: 'Check in', title: 'Stay close — check in every so often' },
    active: { label: 'Active', title: 'You need to stay involved the whole time' }
}
// Recipe-page wording: effort-first phrasing instead of "check in"/"walk away".
const PAGE_INVOLVEMENT_TERMS: Record<string, { label: string; title: string }> = {
    none: { label: 'Hands-off', title: 'Least effort — walk away and come back when it rings' },
    low: { label: 'Swing by', title: 'Some effort — swing by now and then to check on it' }
}
const INVOLVEMENT_RANK: Record<string, number> = { none: 0, low: 1, active: 2 }

function formatDuration(minutes: number) {
    if (minutes > 60) {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return m > 0 ? `${h}h ${m}m` : `${h}h`
    }
    return `${minutes} min`
}

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
        const score = nameWords.filter(nw => !isGenericIngredientWord(nw) && stepWords.some(sw => wordMatches(nw, sw))).length
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
    const [recipeServings, setRecipeServings] = useState<number>(0)
    const [scaleFactor, setScaleFactor] = useState<number>(1)
    const [gramsPerEachMap, setGramsPerEachMap] = useState<Record<string, number>>({})
    const [pendingGrams, setPendingGrams] = useState<number | null>(null)
    const [scaleModalOpen, setScaleModalOpen] = useState(false)
    const gramLookupDoneRef = useRef<string | null>(null)
    const [exportModalOpen, setExportModalOpen] = useState(false)

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
    const [activeSession, setActiveSession] = useState<Record<string, { endTime: number | null; remaining: number; status: string; checkpointsHit: string[]; during?: boolean; preAlertHit?: boolean }>>({})
    const [activeSheet, setActiveSheet] = useState<'none' | 'prep' | 'ingredients' | 'timers'>('none')
    const [alarmPopupClosed, setAlarmPopupClosed] = useState<Set<string>>(new Set())
    const [customTimers, setCustomTimers] = useState<{ id: string; name: string; duration: number; carb?: boolean; stepIndex?: number; during?: boolean; intoMinutes?: number }[]>([])
    const [customTimerName, setCustomTimerName] = useState("")
    const [customTimerMinutes, setCustomTimerMinutes] = useState("")
    const [doneFlow, setDoneFlow] = useState<Set<number>>(new Set())
    // Peek navigation: "View step"-style jumps force-show a card without
    // moving the real flow position; Next/Back on the peeked card returns.
    const [forcedView, setForcedView] = useState<{ idx: number; returnTo: number } | null>(null)
    // Which waiting side phase has its "what you'll do" slide-out expanded.
    const [openCarbSlide, setOpenCarbSlide] = useState<string | null>(null)
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
    const [editTimerInvolvement, setEditTimerInvolvement] = useState("active")
    const [isExtractingTimers, setIsExtractingTimers] = useState(false)
    const [reExtractConfirm, setReExtractConfirm] = useState(false)
    const [addingRecipeTimer, setAddingRecipeTimer] = useState(false)
    const [newTimerName, setNewTimerName] = useState("")
    const [newTimerMinutes, setNewTimerMinutes] = useState("")

    // Cooking flow: prep run-through (if any) then the instruction steps.
    // Timers attach to their step as a poke-out tab underneath the card.
    // Cooking flow: prep run-through (if any) then the instruction steps.
    // Timers attach to their step as a poke-out tab underneath the card.
    // carbChoice: the per-cook carb side decision made in the Start Cooking
    // modal (session-scoped, never written back to the recipe).
    const [carbCatalog, setCarbCatalog] = useState<any[]>([])
    const [carbHistory, setCarbHistory] = useState<any[]>([])
    const [carbModalOpen, setCarbModalOpen] = useState(false)
    const [carbModalType, setCarbModalType] = useState<any>(null)
    const [carbModalVariant, setCarbModalVariant] = useState<string | null>(null)
    // Straight "no carb side" pick — lives in the list as a card so the
    // bottom bar stays a single Start button.
    const [carbModalNone, setCarbModalNone] = useState(false)
    const [carbChoice, setCarbChoice] = useState<any>(null)
    const [carbCatalogLoading, setCarbCatalogLoading] = useState(false)
    const flowItems = useMemo<ReturnType<typeof buildFlowItems>>(() => buildFlowItems(instructions || [], prepWork, carbChoice), [instructions, prepWork, carbChoice])

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

    // Real durations for the side-dish scheduling math: prefer the extracted
    // step time, then the longest timer attached to the step (eg a 90-min
    // simmer timer on a step with no time of its own). An explicit time: 0
    // stays 0 — a genuinely instant step. Steps with neither fall through to
    // the lib's average fallback.
    const schedulingInstructions = useMemo(() => (instructions || []).map((s: any, i: number) => {
        if (s && typeof s.time === 'number' && s.time > 0) return s
        const timerMins = (timersByStep[i] || [])
            .filter((t: any) => typeof t.duration === 'number' && t.duration > 0)
            .reduce((m: number, t: any) => Math.max(m, t.duration), 0)
        if (timerMins > 0) return { ...(s || {}), time: timerMins }
        return s
    }), [instructions, timersByStep])

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

    // Tap-to-see-amount popups for ingredient mentions in step text
    const [popIngredient, setPopIngredient] = useState<any>(null)
    const [popAnchor, setPopAnchor] = useState<DOMRect | null>(null)
    const [popStepIndex, setPopStepIndex] = useState<number | null>(null)
    const ingredientStepMap = useMemo(() => getIngredientStepMap(instructions, listIngreds || []), [instructions, listIngreds])
    const openIngredientPopup = (ingred: any, anchorEl?: HTMLElement, stepIndex?: number) => {
        setPopIngredient(ingred)
        setPopAnchor(anchorEl ? anchorEl.getBoundingClientRect() : null)
        setPopStepIndex(stepIndex ?? null)
    }
    const closeIngredientPopup = () => { setPopIngredient(null); setPopAnchor(null); setPopStepIndex(null) }
    const popAlsoSteps = popIngredient
        ? (ingredientStepMap[String(popIngredient.name).toLowerCase().trim()] || [])
            .filter((i: number) => popStepIndex == null || i !== popStepIndex)
        : []

    const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})

    // Sticky section nav: icon tabs with a scroll-spy active state.
    // Prep uses the knife icon — the chef hat is reserved for Start Cooking.
    const [activeSection, setActiveSection] = useState('top')
    const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({})
    const navSections = useMemo(() => [
        { id: 'ingredients', label: 'Ingredients', icon: ShoppingBasket },
        ...(instructions.length > 0 ? [{ id: 'instructions', label: 'Steps', icon: ListOrdered }] : []),
        { id: 'feedback', label: 'Notes', icon: MessageSquare },
        { id: 'nutrients', label: 'Nutrition', icon: BarChart3 }
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

    // Keep the current step centered in the timeline whenever it changes —
    // a peeked ("View step") card takes over the scroll until it's dismissed.
    useEffect(() => {
        if (!isCookingMode) return
        const el = cardRefs.current[forcedView ? forcedView.idx : currentFlow]
        if (el) {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' })
        }
    }, [currentFlow, isCookingMode, forcedView])

    const costSavedRef = useRef(false)

    const prepTimeEstimate = (prepWork || []).filter((p: any) => !p.optional).reduce((sum: number, p: any) => sum + (p.timeEstimate || 0), 0)
    const cookTimeEstimate = (instructions || []).reduce((sum: number, i: any) => sum + (i.time || 0), 0)
    const totalTimeEstimate = prepTimeEstimate + cookTimeEstimate

    // ---------- Local recipe scaling (servings <-> weight, one factor) ----------
    const baseWeightInfo = useMemo(() => calculateRecipeWeight(listIngreds, gramsPerEachMap), [listIngreds, gramsPerEachMap])
    const baseWeight = baseWeightInfo.totalGrams
    const baseServings = recipeServings > 0 ? recipeServings : 0
    const estimatedWeight = baseWeight * scaleFactor
    const displayedServings = baseServings > 0 ? Math.max(1, Math.round(baseServings * scaleFactor)) : 0
    const scaleQty = (q: any) => formatScaledQuantity(Number(q) * scaleFactor)
    const isScaled = Math.abs(scaleFactor - 1) > 0.0001

    // Modal draft state: one pending "target grams" drives BOTH the weight
    // and servings fields, so they visibly move together while editing.
    const pendingFactor = pendingGrams != null && baseWeight > 0 ? pendingGrams / baseWeight : scaleFactor
    const pendingWeight = baseWeight * pendingFactor
    const pendingServings = baseServings > 0 ? Math.max(1, Math.round(baseServings * pendingFactor)) : 0
    const weightStep = Math.max(1, Math.round(baseWeight / 100))

    const setPendingWeight = (grams: number) => {
        if (baseWeight > 0 && grams > 0) setPendingGrams(grams)
    }
    const setPendingServes = (serves: number) => {
        if (serves > 0 && baseServings > 0) setPendingGrams((serves / baseServings) * baseWeight)
    }
    const applyPendingScale = () => {
        if (baseWeight > 0) setScaleFactor(pendingFactor)
        setScaleModalOpen(false)
    }
    const resetScale = () => {
        setScaleFactor(1)
        setScaleModalOpen(false)
    }
    const openScaleModal = () => {
        setPendingGrams(estimatedWeight)
        setScaleModalOpen(true)
    }

    // Fetch grams-per-each conversion factors for 'each'-unit ingredients so
    // the total weight can be estimated locally (same lookup dailyTracker uses).
    useEffect(() => {
        if (!listIngreds || listIngreds.length === 0 || !id) return
        const cacheKey = String(id)
        if (gramLookupDoneRef.current === cacheKey) return
        gramLookupDoneRef.current = cacheKey
        let cancelled = false
        const token = localStorage.getItem('Token') || ''
        const run = async () => {
            const map: Record<string, number> = {}
            for (const ing of listIngreds) {
                if (cancelled) return
                const name = ing.name || ing.Name
                if (!name || map[name] !== undefined) continue
                try {
                    const res = await fetch(`/api/Ingredients/SearchLogLookup?search_term=${encodeURIComponent(name)}`, { headers: { edgetoken: token } })
                    const data = await res.json()
                    if (data.success && data.res) map[name] = data.res.grams_per_each || 0
                } catch {
                    map[name] = 0
                }
            }
            if (!cancelled && Object.keys(map).length > 0) setGramsPerEachMap(prev => ({ ...prev, ...map }))
        }
        run()
        return () => { cancelled = true }
    }, [listIngreds, id])

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
        const qty = isScaled ? scaleQty(match.quantity) : match.quantity
        return `${formatQuantityDisplay(qty)} ${match.quantity_type_shorthand || match.quantity_type || 'each'}`
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

    // Shared recipe payload for the export modal; buildRecipe*/toFileIngredient
    // normalizers accept either the API ({name, quantity, ...}) or model shape.
    const exportRecipeData = {
        name: recipeName,
        ingredients: listIngreds,
        instructions,
        time: recipeTime,
        genre: recipeGenre,
        mealTypes: recipeMealTypes,
        carbType: recipeCarbType,
        servings: recipeServings,
        sourceUrl: recipe?.sourceUrl,
        prepWork
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

    const logRecipeServe = async (quantity: number = 1) => {
        const token = localStorage.getItem('Token');
        if (!token || !recipe) return;

        const serves = Math.max(1, quantity);
        try {
            const res = await fetch('/api/dailyLog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({
                    date: new Date().toISOString().split('T')[0],
                    type: 'recipe',
                    name: recipe.name,
                    recipe_id: id,
                    quantity: serves, // selected number of serves
                    quantity_unit: 'serving'
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`✅ Logged ${serves} serving${serves === 1 ? '' : 's'} of ${recipe.name}!`);
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
            const involvement = INVOLVEMENT_META[editTimerInvolvement] ? editTimerInvolvement : t.involvement || 'active'
            return { ...t, name, duration, dependencies, stepIndex, involvement }
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
            involvement: 'active',
            dependencies: [{ timerId: 'start', offset: 0 }],
            stepIndex: instructions.length > 0 ? instructions.length - 1 : 0,
            notes: ''
        }
        updateRecipeTimers([...cookingTimers, newTimer])
        setNewTimerName("")
        setNewTimerMinutes("")
        setAddingRecipeTimer(false)
    }

    // Per-step involvement edited from the Timing section's step breakdown:
    // updates the instruction doc and persists the whole array in one PUT.
    const updateStepInvolvement = async (idx: number, level: string) => {
        if (!id) return
        const updated = instructions.map((inst: any, i: number) => i === idx
            ? { ...inst, involvement: level || undefined }
            : inst)
        setInstructions(updated)
        try {
            await fetch(`/api/Recipe/${String(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || "" },
                body: JSON.stringify({ instructions: updated })
            })
        } catch (e) {
            console.error('Failed to save step involvement:', e)
        }
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

    // ---------- Timer involvement ----------
    // Recipe timers carry an AI-extracted involvement level; legacy ones with
    // none default to the safe assumption ('active'). Session timers (carb
    // phases, ad-hoc customs) have their own wait UX — no involvement badge.
    const involvementOf = (timer: any): string | null => {
        if (!timer) return null
        if (timer.carb || !cookingTimers.some((t: any) => t.id === timer.id)) return null
        return INVOLVEMENT_META[timer.involvement] ? timer.involvement : 'active'
    }

    const renderInvolvementTag = (timer: any, page?: boolean) => {
        const level = involvementOf(timer)
        // Active is the assumed default — only flag check-in/walk-away.
        if (!level || level === 'active') return null
        // On the recipe page the terms are effort-based and the tag is neutral
        // (uncoloured); cooking mode keeps its effort-coloured labels.
        const meta = page ? PAGE_INVOLVEMENT_TERMS[level] : INVOLVEMENT_META[level]
        if (!meta) return null
        return <span key={`inv-${timer.id}`} className={`cooking-timer-tag ${page ? '' : `is-inv-${level}`}`} title={meta.title}>{meta.label}</span>
    }

    // The most-attentive level among a step's timers — what the step pill shows
    const stepWorstInvolvement = (stepTimers: any[]): string | null => {
        const levels = (stepTimers || []).map((t: any) => involvementOf(t)).filter(Boolean) as string[]
        if (levels.length === 0) return null
        return levels.reduce((a: string, b: string) => (INVOLVEMENT_RANK[b] > INVOLVEMENT_RANK[a] ? b : a))
    }

    // ---------- Scheduled side phases ----------
    // "During" carb phases are anchored to a step's timer: when that timer
    // starts, each phase activates automatically with an end time
    // `intoMinutes` after the step timer's start — its alarm means "start
    // this now". Extending the step timer shifts phases that haven't fired
    // yet by the same amount so the side still finishes with the step.
    // A blue "heads-up" ring fires a few minutes before each start so the
    // cook has time to get back to the kitchen.
    const SIDE_HEADS_UP_MIN = 3

    const duringPhasesForStep = (stepIndex: number) =>
        ((carbChoice?.phases || []) as any[]).filter((p: any) =>
            p.during && p.timerId && typeof p.insertAfter === 'number' && p.insertAfter === stepIndex)

    const scheduleDuringPhases = (stepIndex: number) => {
        duringPhasesForStep(stepIndex).forEach((p: any) => {
            if (getTimerStatus(p.timerId) !== 'pending') return
            const waitSecs = Math.max(0, (p.intoMinutes || 0) * 60)
            updateTimerSession(p.timerId, () => ({
                endTime: Date.now() + waitSecs * 1000,
                remaining: waitSecs,
                status: 'active',
                checkpointsHit: [],
                during: true
            }))
        })
    }

    const shiftDuringPhases = (stepIndex: number, deltaMs: number) => {
        if (!deltaMs) return
        duringPhasesForStep(stepIndex).forEach((p: any) => {
            updateTimerSession(p.timerId, (session: any) => {
                if (!session?.endTime || session.endTime <= Date.now()) return session // already fired
                return { ...session, endTime: session.endTime + deltaMs }
            })
        })
    }

    const startTimer = (timer: any) => {
        updateTimerSession(timer.id, () => ({
            endTime: Date.now() + timer.duration * 60 * 1000,
            remaining: timer.duration * 60,
            status: 'active',
            checkpointsHit: []
        }))
        // Starting a step's timer auto-schedules its "during" side phases.
        if (!timer.carb && typeof timer.stepIndex === 'number') scheduleDuringPhases(timer.stepIndex)
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
        updateTimerSession(timer.id, (session: any) => {
            const addSec = minutes * 60
            // Completed timers restart from 0 plus the added time.
            if (session?.status === 'completed') {
                return { endTime: null, remaining: addSec, status: 'paused', checkpointsHit: session.checkpointsHit || [] }
            }
            if (session?.status === 'active' || session?.status === 'overdue') {
                const newEndTime = (session.endTime || Date.now()) + addSec * 1000
                return { endTime: newEndTime, remaining: getRemaining({ ...session, endTime: newEndTime }), status: 'active', checkpointsHit: session.checkpointsHit || [] }
            }
            return { endTime: null, remaining: (session.remaining || 0) + addSec, status: session?.status || 'paused', checkpointsHit: session.checkpointsHit || [] }
        })
        // A longer step pushes its not-yet-fired side phases back equally.
        if (!timer.carb && typeof timer.stepIndex === 'number') shiftDuringPhases(timer.stepIndex, minutes * 60 * 1000)
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
        const prevEnd = activeSession[timer.id]?.endTime
        const newEnd = Date.now() + totalSecs * 1000
        updateTimerSession(timer.id, (session: any) => ({
            endTime: newEnd,
            remaining: totalSecs,
            status: 'active',
            checkpointsHit: session?.checkpointsHit || []
        }))
        if (!timer.carb && typeof timer.stepIndex === 'number' && prevEnd) {
            shiftDuringPhases(timer.stepIndex, newEnd - prevEnd)
        }
    }

    const addTimerSeconds = (timer: any, seconds: number) => {
        updateTimerSession(timer.id, (session: any) => {
            if (session?.status === 'active' || session?.status === 'overdue') {
                return { ...session, endTime: (session.endTime || Date.now()) + seconds * 1000, status: 'active' }
            }
            return { ...session, remaining: (session.remaining || 0) + seconds }
        })
        if (!timer.carb && typeof timer.stepIndex === 'number' && ['active', 'overdue'].includes(getTimerStatus(timer.id))) {
            shiftDuringPhases(timer.stepIndex, seconds * 1000)
        }
    }

    const closeCooking = () => {
        setActiveSession({})
        setCustomTimers([])
        setAlarmPopupClosed(new Set())
        setForcedView(null)
        if (id) {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('timer-session-'))
            keys.forEach(k => localStorage.removeItem(k))
        }
        setIsCookingMode(false)
        setCurrentFlow(0)
        setDoneFlow(new Set())
        setActiveSheet('none')
        setCarbChoice(null)
        setCarbModalOpen(false)
        setScaleFactor(1)
        setScaleModalOpen(false)
    }

    // ---------- Carb side (Start Cooking) ----------

    // Recipe is marked as needing a carb side and our injector (not the
    // recipe's own steps) should provide it.
    const needsCarbChoice = () => recipe?.carbSide?.needs === true
        && recipe?.carbSide?.state === 'analyzed'
        && recipe?.carbSide?.analysis?.alreadyInInstructions !== true

    const loadCarbData = async () => {
        if (carbCatalog.length > 0) return true
        setCarbCatalogLoading(true)
        try {
            const token = { 'edgetoken': localStorage.getItem('Token') || '' }
            const [catRes, histRes] = await Promise.all([
                fetch('/api/carbTypes', { headers: token }),
                fetch('/api/carbChoice', { headers: token })
            ])
            const catData = await catRes.json()
            const histData = await histRes.json()
            const catalog = catData.success && Array.isArray(catData.data) ? catData.data : []
            const history = histData.success && Array.isArray(histData.data) ? histData.data : []
            setCarbCatalog(catalog)
            setCarbHistory(history)
            if (catalog.length > 0) {
                const rec = recommendCarbOption(catalog, history, recipe?.carbSide?.type)
                setCarbModalType(rec)
                setCarbModalVariant(resolveVariant(rec, history[0]?.variant))
            }
            return catalog.length > 0
        } catch (e) {
            console.error('Failed to load carb catalog:', e)
            return false
        } finally {
            setCarbCatalogLoading(false)
        }
    }

    // One entry point for both Start Cooking buttons: asks the carb-side
    // question first (only when the recipe wants one), or resumes an
    // in-progress session with its stored carb decision.
    const startCooking = async () => {
        setActiveSheet('none')
        let saved: any = null
        try { saved = JSON.parse(localStorage.getItem(`timer-session-${String(id)}`) || 'null') } catch {}
        const resuming = saved && typeof saved === 'object' &&
            (saved.currentFlow > 0 || (Array.isArray(saved.doneFlow) && saved.doneFlow.length > 0))
        if (resuming) {
            if (saved.carbChoice) setCarbChoice(saved.carbChoice)
            // Carb phase timers live in component state, not the DB — restore
            // them so the side's timers/tabs survive a page reload mid-wait.
            if (Array.isArray(saved.customTimers)) setCustomTimers(saved.customTimers as any)
            setIsCookingMode(true)
            return
        }
        if (needsCarbChoice()) {
            const hasCatalog = await loadCarbData()
            if (hasCatalog) {
                setCarbModalNone(false)
                setCarbModalOpen(true)
                return
            }
            // Catalog unreachable — keep working with the recipe's stored analysis
            const fallback = fallbackCarbChoice()
            if (fallback) {
                setCarbChoice(fallback)
            }
        } else {
            setCarbChoice(null)
        }
        setIsCookingMode(true)
    }

    // Catalog unreachable fallback: build a single-phase choice from the
    // recipe's stored analysis.
    const fallbackCarbChoice = () => {
        const fallback = recipe?.carbSide
        const serves = displayedServings || (recipe?.servings && recipe.servings > 0 ? recipe.servings : 0)
        if (Array.isArray(fallback?.phases) && fallback.phases.length > 0) {
            const phasedTime = fallback.phases.reduce((a: number, p: any) => a + (p.minutes || 0), 0) || fallback.timeMinutes || 20
            const phased = computePhaseInsertPoints(schedulingInstructions, fallback.phases.map((p: any) => ({ ...p })))
            return {
                type: fallback.type,
                label: fallback.type,
                phases: phased.map((p: any, pi: number) => ({
                    name: fallback.phases[pi]?.name || p.name,
                    minutes: p.minutes,
                    instruction: fillCarbPhaseText(
                        fallback.phases[pi]?.instruction || p.instruction || fallback.stepText || `Cook ${fallback.type} on the side.`,
                        null,
                        serves
                    ),
                    insertAfter: p.insertAfter,
                    during: p.during,
                    intoMinutes: p.intoMinutes
                })),
                totalMinutes: phasedTime
            }
        }
        if (fallback?.stepText) {
            const fallbackMinutes = fallback.timeMinutes || 20
            const slot = resolveCarbSlot(schedulingInstructions, fallbackMinutes)
            // A stored AI hint agreeing within one step wins and pins the
            // phase to that step boundary (timings always win otherwise).
            const hintOk = typeof fallback.insertAfter === 'number'
                && Math.abs(fallback.insertAfter - slot.index) <= 1
            const insertIdx = hintOk ? fallback.insertAfter : slot.index
            const intoMin = hintOk ? 0 : slot.intoMinutes
            return {
                type: fallback.type,
                label: fallback.type,
                phases: [{
                    name: 'Cook on the side',
                    minutes: fallbackMinutes,
                    instruction: fillCarbPhaseText(fallback.stepText, null, serves),
                    insertAfter: insertIdx,
                    during: intoMin > 0,
                    intoMinutes: intoMin
                }],
                totalMinutes: fallbackMinutes
            }
        }
        return null
    }

    const resolveCarbChoice = (entry: any, variant: string | null) => {
        const v = resolveVariant(entry, variant)
        const timing = resolveCarbTiming(entry, v)
        // Serve quantities ({qty:rice}/{serves}) are filled against the
        // recipe's own serving count at the moment the side is picked.
        const serves = displayedServings || (recipe?.servings && recipe.servings > 0 ? recipe.servings : 0)
        let phases = (timing?.phases || [{ name: 'Cook', minutes: 20 }]).map((p: any) => ({ ...p }))
        // Legacy entries without phase instructions fall back to the
        // catalog's template text so cards are never blank
        phases = phases.map((p: any) => ({
            ...p,
            // EVERY phase text (catalog tokens included) gets its serve
            // quantities filled here — {qty:rice}/{serves} never reach the card
            instruction: fillCarbPhaseText(p.instruction, timing, serves)
                || fillCarbPhaseText(entry?.defaultStepText, timing, serves)
                || `Cook ${entry.name} on the side.`
        }))
        const total = phases.some((p: any) => p.minutes > 0)
            ? phases.reduce((a: number, p: any) => a + p.minutes, 0)
            : (recipe?.carbSide?.timeMinutes || timing?.totalMinutes || 20)
        const phased = computePhaseInsertPoints(schedulingInstructions, phases)
        return {
            type: entry.name,
            variant: timing?.variant,
            label: timing?.label || entry.name,
            phases: phased,
            totalMinutes: total
        }
    }

    const confirmCarbPick = (entry: any, variant: string | null) => {
        setCarbModalOpen(false)
        if (!entry) {
            setCarbChoice(null)
            setIsCookingMode(true)
            return
        }
        const base = resolveCarbChoice(entry, variant)
        // One session timer per phase with time (custom timers keep alarms,
        // finish-gate and the timers sheet working), pending until the user
        // starts each in the flow — or until the anchor step's timer starts
        // it automatically for "during" phases.
        const stamp = Date.now().toString(36)
        const phases = base.phases.map((p: any, pi: number) => {
            const tid = p.minutes > 0 ? `carb-${stamp}-p${pi}` : undefined
            if (tid) {
                setCustomTimers(prev => [...prev, {
                    id: tid,
                    name: `${base.label}: ${p.name}`,
                    duration: p.minutes,
                    carb: true,
                    // Anchor step + mid-step offset: when the anchor step's
                    // timer starts, "during" phases are scheduled to fire
                    // intoMinutes after it starts.
                    stepIndex: p.insertAfter,
                    during: !!p.during,
                    intoMinutes: p.intoMinutes || 0
                } as any])
            }
            return { ...p, timerId: tid }
        })
        const choice = { ...base, phases }
        setCarbChoice(choice)
        setIsCookingMode(true)
        fetch('/api/carbChoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
            body: JSON.stringify({ type: entry.name, variant: choice.variant })
        }).catch(() => {})
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

    // Auto-analyze once per visit — for ANY recipe, not just pre-marked
    // ones: the AI decides whether the dish wants a carb side (populating
    // the editor flag) and whether one already exists in the steps.
    // Results are persisted, so Start Cooking / bulk ops never re-run.
    const carbAnalyzedRef = useRef(false)
    useEffect(() => {
        if (!id || !recipe?.name) return
        const carbSide = recipe?.carbSide
        if (carbSide?.state === 'analyzed' || carbAnalyzedRef.current) return
        carbAnalyzedRef.current = true
        const run = async () => {
            try {
                const res = await fetch('/api/ai/analyze_carb_side', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
                    body: JSON.stringify({ recipeId: id })
                })
                const data = await res.json()
                if (data.success && data.data) {
                    setRecipe((prev: any) => (prev ? { ...prev, carbSide: data.data } : prev))
                } else {
                    console.error('Carb side analysis failed:', data.message)
                    carbAnalyzedRef.current = false
                }
            } catch (e) {
                console.error('Carb side analysis failed:', e)
                carbAnalyzedRef.current = false
            }
        }
        run()
    }, [recipe, id])

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
                // Keep the ingredient scale the cook chose last time
                if (typeof parsed.scaleFactor === 'number' && parsed.scaleFactor > 0 && parsed.scaleFactor !== 1) {
                    setScaleFactor(parsed.scaleFactor)
                }

                const legacy = legacyFlowStepIndices(instructions || [], cookingTimers)
                const prepShift = (prepWork || []).length > 0 ? 1 : 0
                const toFlowIndices = (idxs: any[]): number[] => {
                    const mapped: number[] = parsed.v >= 4
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
                v: 5,
                timers: activeSession,
                currentFlow,
                doneFlow: Array.from(doneFlow),
                carbChoice,
                customTimers,
                scaleFactor
            }))
        } catch {}
    }, [activeSession, currentFlow, doneFlow, id, customTimers, scaleFactor])

    // Tick clock + countdown engine. A 100ms clock drives re-renders while any
    // timer runs, so countdowns step at true second boundaries (ceiled) and
    // progress bars glide; completion/checkpoint detection fires within ~100ms
    // of the real end time instead of up to a second off.
    const [nowMs, setNowMs] = useState(() => Date.now())
    const activeSessionRef = useRef(activeSession)
    activeSessionRef.current = activeSession
    const customTimersRef = useRef(customTimers)
    customTimersRef.current = customTimers
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
                    // Scheduled side phases ring as "start now", not "done"
                    const firingTimer = getTimerById(cookingTimers, timerId) || customTimersRef.current.find((x: any) => x.id === timerId)
                    sendNotification(
                        firingTimer?.carb ? 'Side dish time' : 'Timer Complete',
                        firingTimer?.carb ? `Time to start: ${firingTimer?.name || 'side'}` : `${firingTimer?.name || 'Timer'} is done!`
                    )
                    // A fresh overdue event — make sure the alarm popup shows for it again
                    setAlarmPopupClosed(prev => {
                        if (!prev.has(timerId)) return prev
                        const next = new Set(Array.from(prev))
                        next.delete(timerId)
                        return next
                    })
                    continue
                }
                // Blue heads-up ring: a few minutes before a scheduled side
                // phase starts, so the cook has time to get back to the
                // kitchen. Rings once; the real alarm still fires at start time.
                if (session.during && !session.preAlertHit && session.endTime - now <= SIDE_HEADS_UP_MIN * 60000) {
                    updates[timerId] = { ...session, preAlertHit: true }
                    playAlarm()
                    lastAlarmAtRef.current = now
                    const sideTimer = customTimersRef.current.find((x: any) => x.id === timerId)
                    sendNotification('Head back to the kitchen', `${sideTimer?.name || 'Side dish'} — starts in about ${SIDE_HEADS_UP_MIN} min`)
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
            <Layout title="Recipes" hideMobileToolbar>
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
        <Layout
            title={recipeName || "Recipe"}
            hideMobileToolbar
            bottomBar={!isCookingMode && (
                <nav className="recipe-nav" aria-label="Recipe sections">
                    <button
                        onClick={() => router.push('/recipes')}
                        className="recipe-nav-back"
                        title="Back to recipes"
                        aria-label="Back to recipes"
                    >
                        <ChevronLeft size={17} />
                    </button>
                    <span className="recipe-nav-sep" aria-hidden />
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
                        onClick={() => { startCooking() }}
                        className="recipe-nav-start"
                        title="Start Cooking"
                        aria-label="Start Cooking"
                    >
                        <ChefHat size={17} />
                    </button>
                </nav>
            )}
        >
            {/* Full-bleed wrapper: breaks out of the .container side padding on
                desktop so the card colour reaches the viewport edges */}
            <div className="pb-4 min-[769px]:-mx-6">
                {/* Hero Header — one reading layout with or without an image:
                    the image is a full-bleed banner and never changes text insets */}
                <div className="bg-card text-card-foreground overflow-hidden mb-0">
                    {imageData ? (
                        <div className="relative h-44 sm:h-64 md:h-80 w-full cursor-pointer group" onClick={handleClick} title="Change image">
                            <img src={imageData} alt={recipeName} className="w-full h-full object-cover" />
                            <div className="absolute bottom-3 left-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-wrap gap-1.5">
                                    {renderCategoryChips(CHIP_OVERLAY)}
                                </div>
                            </div>
                            <div className="absolute top-3 right-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-full backdrop-blur-sm font-semibold">Change Image</span>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="relative h-44 w-full cursor-pointer group"
                            onClick={handleClick}
                            title="Add image"
                            style={{ backgroundColor: getColorForName(recipeName) }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/30 pointer-events-none" />
                            <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-8 pointer-events-none">
                                <span
                                    className="text-3xl sm:text-4xl text-white/90 text-center leading-tight drop-shadow-sm line-clamp-2"
                                    style={{ fontFamily: 'var(--font-cursive)' }}
                                >
                                    {recipeName}
                                </span>
                            </div>
                            <div className="absolute bottom-3 left-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-wrap gap-1.5">
                                    {renderCategoryChips(CHIP_OVERLAY)}
                                </div>
                            </div>
                            <div className="absolute top-3 right-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-full backdrop-blur-sm font-semibold">Add Image</span>
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
                                    {recipeServings > 0 && baseWeightInfo.totalCount > 0 && (
                                        <span className="relative inline-flex items-center gap-1.5">
                                            <button
                                                onClick={openScaleModal}
                                                className="inline-flex items-center gap-1.5 cursor-pointer hover:text-accent transition-colors"
                                                title="Scale all ingredients to a target weight"
                                            >
                                                <Scale className="w-4 h-4 text-muted-foreground" />
                                                <span className="tabular-nums">{formatWeight(baseWeight > 0 ? estimatedWeight : NaN)}</span>
                                            </button>
                                            {isScaled && (
                                                <button
                                                    onClick={resetScale}
                                                    className="text-muted-foreground hover:text-accent cursor-pointer"
                                                    title="Reset to original amounts"
                                                    aria-label="Reset scale"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                </button>
                                            )}
                                        </span>
                                    )}
                                    {recipeServings > 0 && (
                                        <span className="relative inline-flex items-center gap-1.5">
                                            <button
                                                onClick={openScaleModal}
                                                className="inline-flex items-center gap-1.5 cursor-pointer hover:text-accent transition-colors"
                                                title="Change servings — scales all ingredients"
                                            >
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <span className="tabular-nums">{displayedServings} serving{displayedServings === 1 ? '' : 's'}</span>
                                            </button>
                                            {isScaled && (
                                                <button
                                                    onClick={resetScale}
                                                    className="text-muted-foreground hover:text-accent cursor-pointer"
                                                    title="Reset to original servings"
                                                    aria-label="Reset scale"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                </button>
                                            )}
                                        </span>
                                    )}
                                </div>
                            )}
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
                                onClick={() => setExportModalOpen(true)}
                                variant="outline"
                                className="h-12 sm:h-14 px-3 sm:px-6 rounded-md bg-secondary/70 hover:bg-secondary text-foreground/85 font-semibold text-sm flex items-center justify-center gap-1.5 transition-all shrink-0 !border-0"
                                title="Export, copy or download this recipe"
                                aria-label="Export recipe"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Export</span>
                            </Button>
                            <Button
                    onClick={() => { startCooking() }}
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
                                    ingredient={isScaled && !isNaN(Number(ingred.quantity)) ? { ...ingred, quantity: scaleQty(ingred.quantity) } : ingred}
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
                                {instructions.map((instruction, index) => {
                                    const recs = ingredsByStep[index]?.recommended || []
                                    const longStep = isLongStep(instruction.Text)
                                    return (
                                    <div key={index} className="flex gap-3 sm:gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-sm font-bold text-foreground/70">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`step-font text-foreground/80 leading-relaxed font-medium ${longStep ? 'text-sm sm:text-[15px]' : 'text-[15px] sm:text-base'}`}>
                                                {renderStepText(instruction.Text, {
                                                    ingredients: recs,
                                                    onIngredientClick: (ingred, anchor) => openIngredientPopup(ingred, anchor, index)
                                                })}
                                            </div>
                                            {instruction.time && (
                                                <div className="mt-1 text-xs text-muted-foreground">~{formatDuration(instruction.time)}</div>
                                            )}
                                        </div>
                                    </div>
                                    )
                                })}
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

                        {(() => {
                            const timerList = cookingTimers.filter((t: any) => t.type === 'timer')
                            if (timerList.length === 0) return null
                            const totals: Record<string, number> = { active: 0, low: 0, none: 0 }
                            timerList.forEach((t: any) => {
                                const inv = INVOLVEMENT_META[t.involvement] ? t.involvement : 'active'
                                totals[inv] += t.duration || 0
                            })
                            const tiles = [
                                {inv: 'active', label: 'Active'},
                                {inv: 'low', label: 'Swing by'},
                                {inv: 'none', label: 'Hands-off'},
                            ]
                            return (
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {tiles.map(t => (
                                        <div key={t.inv} className="p-3 rounded-xl bg-secondary/60 flex flex-col items-center justify-center text-center">
                                            <p className="text-lg font-bold leading-tight">{totals[t.inv]}<span className="text-xs font-semibold text-muted-foreground ml-0.5">min</span></p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )
                        })()}

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
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider">Attention</span>
                                                    <select
                                                        value={editTimerInvolvement}
                                                        onChange={(e) => setEditTimerInvolvement(e.target.value)}
                                                        className="bg-secondary text-foreground/85 rounded-lg px-2 py-1 focus:outline-none"
                                                        title="How much attention this timer needs"
                                                    >
                                                        <option value="none">Hands-off</option>
                                                        <option value="low">Swing by</option>
                                                        <option value="active">Active</option>
                                                    </select>
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
                                                <span className="text-muted-foreground">{formatDuration(timer.duration)}</span>
                                            </div>
                                                    {(depTimer || (timer.stepIndex != null && instructions.length > 0)) && (
                                                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                                            {timer.stepIndex != null && instructions.length > 0 ? `Step ${timer.stepIndex + 1}` : ''}
                                                            {timer.stepIndex != null && instructions.length > 0 && depTimer ? ' · ' : ''}
                                                            {depTimer ? `starts ${depOffset < 0 ? `${-depOffset} min before ${depTimer.name} finishes` : `when ${depTimer.name} finishes`}` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                                {renderInvolvementTag(timer, true)}
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
                                                        setEditTimerInvolvement(INVOLVEMENT_META[timer.involvement] ? timer.involvement : 'active')
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
                                        <div key={idx} className="px-3 py-1.5 rounded-lg bg-secondary/60 text-sm flex items-center gap-1.5">
                                            <span className="font-semibold text-foreground/85">Step {idx + 1}</span>
                                            <span className="text-muted-foreground">~{formatDuration(instruction.time)}</span>
                                            <select
                                                value={instruction.involvement || ''}
                                                onChange={(e) => updateStepInvolvement(idx, e.target.value)}
                                                className={`bg-transparent outline-none cursor-pointer text-[10px] font-bold uppercase tracking-[0.08em] rounded-md px-1.5 py-0.5 max-w-[6.5rem] transition-colors focus:bg-secondary ${
                                                    instruction.involvement === 'none' ? 'text-sky-600'
                                                        : instruction.involvement === 'low' ? 'text-amber-600'
                                                        : instruction.involvement === 'active' ? 'text-red-500'
                                                        : 'text-muted-foreground/60'
                                                }`}
                                                title="Set how much attention this step needs"
                                            >
                                                <option value="">Set…</option>
                                                <option value="none">Hands-off</option>
                                                <option value="low">Swing by</option>
                                                <option value="active">Active</option>
                                            </select>
                                        </div>
                                    ) : null)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Source notes — recipe tips/notes scraped from the original site */}
                    {recipe?.sourceNotes && (
                        <div data-section="source-notes" className="recipe-band recipe-section px-4 py-6 sm:px-8 sm:py-10">
                            <div className="flex items-center gap-2.5 mb-4">
                                <Info className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight">From the source</h2>
                            </div>
                            <div className="rounded-xl bg-secondary/40 border border-border/50 px-4 py-3 space-y-2">
                                {recipe.sourceNotes.split(/\n{2,}/).map((note: string, idx: number) => (
                                    <p key={idx} className="text-sm text-foreground/80 whitespace-pre-wrap">{note}</p>
                                ))}
                            </div>
                        </div>
                    )}

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

                        {recipe?.carbSide?.state === 'analyzed' && (
                            <div className="mt-4 rounded-xl bg-secondary/40 border border-border/50 px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Carb side analysis</p>
                                <p className="text-sm text-foreground/80">
                                    {recipe.carbSide.analysis?.alreadyInInstructions
                                        ? `The recipe already handles the ${recipe.carbSide.type} — see ${typeof recipe.carbSide.analysis.matchedStepIndex === 'number' ? `step ${recipe.carbSide.analysis.matchedStepIndex + 1}` : 'the steps'}.`
                                        : recipe.carbSide.needs
                                            ? `Serve with ${recipe.carbSide.type || 'a carb side'}${recipe.carbSide.analysis?.note ? ` — ${recipe.carbSide.analysis.note}` : ''}`
                                            : recipe.carbSide.analysis?.note || 'No carb side needed for this dish.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Nutrients density — always visible */}
                    <div data-section="nutrients" className="recipe-band recipe-section px-4 py-6 sm:px-8 sm:py-10">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-4 h-4 text-accent" />
                            <h2 className="text-sm font-bold uppercase tracking-wider">
                                Nutritional Density
                            </h2>
                        </div>

                        <div className="rounded-2xl bg-secondary/50 p-4 sm:p-6">
                            <IngredientNutrientGraph
                                ingredients={matchedListIngreds}
                                onLogServe={logRecipeServe}
                                recipeServings={displayedServings || recipeServings}
                            />
                        </div>
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

                {/* Export modal — clipboard / JSON / Markdown options */}
                <ExportRecipeModal
                    isOpen={exportModalOpen}
                    onClose={() => setExportModalOpen(false)}
                    recipe={exportRecipeData}
                    imageSrc={imageData}
                />

                {/* Recipe Scale Modal — centered card, weight & servings in one place */}
                <Modal
                    isOpen={scaleModalOpen}
                    onRequestClose={() => setScaleModalOpen(false)}
                    style={{
                        content: {
                            backgroundColor: 'var(--background)',
                            color: 'var(--foreground)',
                            border: '1px solid var(--border)',
                            maxWidth: '360px',
                            width: 'calc(100% - 2rem)',
                            margin: '0 auto',
                            padding: '1.25rem',
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
                            alignItems: 'center',
                            justifyContent: 'center'
                        }
                    }}
                    contentLabel="Scale recipe"
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Scale className="w-4 h-4 text-muted-foreground" /> Scale recipe
                        </h2>
                        <button
                            onClick={() => setScaleModalOpen(false)}
                            className="bg-secondary hover:bg-secondary/80 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                            aria-label="Close"
                        >
                            <img src="/cross.png" className="w-4 h-4 invert-[.25] dark:invert" alt="close" />
                        </button>
                    </div>

                    <p className="text-xs text-muted-foreground mb-4">
                        Drag or type in either one — weight and servings stay in sync and update all ingredients.
                    </p>

                    {/* Weight */}
                    <div className="rounded-xl bg-secondary/50 p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target weight</span>
                            {baseWeight > 0 && (
                                <span className="text-xs font-semibold tabular-nums text-foreground/80">{formatWeight(pendingWeight)}</span>
                            )}
                        </div>
                        {baseWeight > 0 ? (
                            <>
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="range"
                                        min={1}
                                        max={baseWeight * 3}
                                        step={weightStep}
                                        value={Math.min(Math.max(pendingWeight, 1), baseWeight * 3)}
                                        onChange={e => setPendingWeight(Number(e.target.value))}
                                        className="flex-1 accent-emerald-500 cursor-pointer"
                                        aria-label="Target weight slider"
                                    />
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="number" min="1" inputMode="numeric"
                                        value={Math.round(pendingWeight)}
                                        onChange={e => setPendingWeight(Number(e.target.value))}
                                        onKeyDown={e => { if (e.key === 'Enter') applyPendingScale() }}
                                        className="w-24 bg-background border border-border focus:border-accent outline-none rounded-md text-sm tabular-nums px-2 py-1.5"
                                    />
                                    <span className="text-xs text-muted-foreground">g total</span>
                                    <div className="flex flex-wrap gap-1.5 ml-auto justify-end">
                                        {[0.5, 1.5, 2, 3].map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setPendingWeight(baseWeight * m)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${Math.abs(pendingFactor - m) < 0.0001 ? 'bg-emerald-500 text-white' : 'bg-background hover:bg-background/60 border border-border text-foreground/80'}`}
                                            >
                                                {m}×
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {baseWeightInfo.resolvedCount < baseWeightInfo.totalCount && (
                                    <p className="text-[10px] text-muted-foreground">
                                        Estimate — {baseWeightInfo.totalCount - baseWeightInfo.resolvedCount} of {baseWeightInfo.totalCount} ingredients couldn't be weighed.
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-xs text-muted-foreground">Fetching ingredient weights…</p>
                        )}
                    </div>

                    {/* OR separator */}
                    <div className="flex items-center gap-3 my-4">
                        <span className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">or</span>
                        <span className="flex-1 h-px bg-border" />
                    </div>

                    {/* Servings */}
                    {baseServings > 0 && (
                        <div className="rounded-xl bg-secondary/50 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Servings</span>
                                <span className="text-xs font-semibold tabular-nums text-foreground/80">{pendingServings} serving{pendingServings === 1 ? '' : 's'}</span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={Math.max(3, baseServings * 3)}
                                step={1}
                                value={Math.min(Math.max(pendingServings, 1), Math.max(3, baseServings * 3))}
                                onChange={e => setPendingServes(Number(e.target.value))}
                                className="w-full accent-emerald-500 cursor-pointer mb-2"
                                aria-label="Servings slider"
                            />
                            <div className="flex items-center gap-2 mb-3">
                                <button
                                    onClick={() => setPendingServes(pendingServings - 1)}
                                    className="w-8 h-8 rounded-md bg-background hover:bg-background/60 border border-border flex items-center justify-center cursor-pointer" aria-label="Fewer servings"
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                    type="number" min="1" inputMode="numeric"
                                    value={pendingServings}
                                    onChange={e => setPendingServes(Number(e.target.value))}
                                    onKeyDown={e => { if (e.key === 'Enter') applyPendingScale() }}
                                    className="w-16 bg-background border border-border focus:border-accent outline-none rounded-md text-sm tabular-nums text-center px-2 py-1.5"
                                />
                                <button
                                    onClick={() => setPendingServes(pendingServings + 1)}
                                    className="w-8 h-8 rounded-md bg-background hover:bg-background/60 border border-border flex items-center justify-center cursor-pointer" aria-label="More servings"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                                <div className="flex flex-wrap gap-1.5 ml-auto justify-end">
                                    {[1, 2, 4, 6, 8].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setPendingServes(s)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${pendingServings === s ? 'bg-emerald-500 text-white' : 'bg-background hover:bg-background/60 border border-border text-foreground/80'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mt-4">
                        <button onClick={resetScale} disabled={!isScaled} className="text-xs text-muted-foreground hover:text-accent disabled:opacity-30 cursor-pointer flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Reset to original
                        </button>
                        <Button size="sm" onClick={applyPendingScale} className="h-9 px-6 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-md">
                            Apply scale
                        </Button>
                    </div>
                </Modal>

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

                {/* Carb side choice — asked at Start Cooking when the recipe
                    needs one. Session-scoped decision. Bottom sheet on phones
                    (thumb reach) / centred panel on larger screens. "No carb
                    side" is the first list option, so the footer is a single
                    Start button. */}
                {carbModalOpen && (
                    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm" onClick={() => setCarbModalOpen(false)}>
                        <div
                            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border">
                                <h3 className="text-lg font-bold flex items-center gap-2"><ChefHat size={18} className="text-emerald-500" /> Serve with a carb side?</h3>
                                {recipe?.carbSide?.analysis?.note && (
                                    <p className="text-xs text-muted-foreground mt-1">{recipe.carbSide.analysis.note}</p>
                                )}
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2">
                                {/* No carb side — first option, same card style */}
                                <button
                                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all touch-manipulation ${carbModalNone
                                        ? 'bg-emerald-500/10 border-emerald-500/40'
                                        : 'bg-secondary border-border hover:border-accent'}`}
                                    onClick={() => { setCarbModalNone(true); setCarbModalType(null) }}
                                >
                                    <span className="min-w-0">
                                        <span className={`block text-sm font-semibold ${carbModalNone ? 'text-emerald-400' : 'text-foreground'}`}>Nothing — no carb side</span>
                                        <span className="block text-[11px] text-muted-foreground">Cook the dish as written, no extra steps for carbs</span>
                                    </span>
                                    {carbModalNone && <Check size={16} className="text-emerald-400 shrink-0" />}
                                </button>
                                {carbCatalog.map((entry: any) => {
                                    const isSel = !carbModalNone && carbModalType?._id === entry._id
                                    const isRec = recommendCarbOption(carbCatalog, carbHistory, recipe?.carbSide?.type)?._id === entry._id
                                    return (
                                        <div key={entry._id} className="space-y-1.5">
                                            <button
                                                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all touch-manipulation ${isSel
                                                    ? 'bg-emerald-500/10 border-emerald-500/40'
                                                    : 'bg-secondary border-border hover:border-accent'}`}
                                                onClick={() => { setCarbModalNone(false); setCarbModalType(entry); setCarbModalVariant(resolveVariant(entry, carbModalVariant)) }}
                                            >
                                                <span className="min-w-0 truncate">
                                                    <span className={`text-sm font-semibold ${isSel ? 'text-emerald-400' : 'text-muted-foreground'}`}>{entry.name}</span>
                                                    {isRec && <span className="ml-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">recommended</span>}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground shrink-0 truncate max-w-[45%] text-right">
                                                    {(entry.variants || []).map((v: any) => v.name).join(' / ')}
                                                </span>
                                            </button>
                                            {isSel && (entry.variants || []).length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pl-2">
                                                    {(entry.variants || []).map((v: any) => (
                                                        <button
                                                            key={v.name}
                                                            className={`px-3 py-2 rounded-full border text-xs font-semibold transition-all touch-manipulation ${!carbModalNone && carbModalVariant === v.name
                                                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                                                : 'bg-secondary border-border text-muted-foreground hover:border-accent'}`}
                                                            onClick={() => setCarbModalVariant(v.name)}
                                                        >
                                                            {v.name} · {(v.phases?.reduce((a: number, x: any) => a + x.minutes, 0)) || ((v.cookMinutes || 0) + (v.prepMinutes || 0))} min
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="shrink-0 px-5 pt-3 pb-5 sm:pb-4 border-t border-border" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                                <Button
                                    className="w-full cooking-next-btn is-primary touch-manipulation"
                                    onClick={() => confirmCarbPick(carbModalNone ? null : carbModalType, carbModalNone ? null : carbModalVariant)}
                                    disabled={!carbModalNone && !carbModalType}
                                >
                                    <ChefHat size={16} /> Start cooking
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

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
                    // Peek: force-show a card without moving the real flow
                    // position — Next/Back on the peeked card returns to it.
                    const peekTo = (idx: number) => {
                        const target = Math.max(0, Math.min(idx, flowItems.length - 1))
                        setForcedView(prev => prev || { idx: target, returnTo: clampedCurrent })
                    }
                    const goBack = () => {
                        if (forcedView) { setForcedView(null); return }
                        setCurrentFlow(Math.max(0, clampedCurrent - 1))
                    }
                    const openSheet = (name: 'prep' | 'ingredients' | 'timers') => setActiveSheet(prev => (prev === name ? 'none' : name))

                    const formatCountdown = (remaining: number) => {
                        const sign = remaining < 0 ? '-' : ''
                        const abs = Math.abs(remaining)
                        if (abs < 60) return `${sign}${abs}s`
                        const mins = Math.floor(abs / 60)
                        if (mins < 60) return `${sign}${mins}m`
                        const hours = Math.floor(mins / 60)
                        const remMins = mins % 60
                        return `${sign}${hours}h${remMins > 0 ? ` ${remMins}m` : ''}`
                    }

                    const advance = () => {
                        // Peeking at another card: Next wraps up the peek and
                        // returns to the step the cook was actually on.
                        if (forcedView) {
                            setDoneFlow(prev => new Set([...Array.from(prev), forcedView.idx]))
                            setForcedView(null)
                            return
                        }
                        if (isLast) {
                            if (runningTimerCount > 0 || customTimers.length > 0) setFinishConfirm(true)
                            else closeCooking()
                            return
                        }
                        setDoneFlow(prev => new Set([...Array.from(prev), clampedCurrent]))
                        // Timers the user never started are ticked off as if they
                        // completed — skipping a step means they manage timing themselves.
                        const cur = flowItems[clampedCurrent]
                        if (cur?.kind === 'step') {
                            ;(timersByStep[cur.stepIndex] || []).forEach((t: any) => {
                                if (getTimerStatus(t.id) === 'pending') completeTimer(t)
                            })
                        }
                        setCurrentFlow(clampedCurrent + 1)
                    }

                    // While peeking, the primary button wraps up the peek and
                    // names where it returns to.
                    const peekReturnLabel = (() => {
                        const t = forcedView ? flowItems[forcedView.returnTo] : undefined
                        if (!t) return 'Back'
                        return t.kind === 'prep'
                            ? 'Back to prep'
                            : t.kind === 'carb'
                                ? 'Back to side'
                                : `Back to Step ${t.stepIndex + 1}`
                    })()
                    const nextLabel = forcedView
                        ? peekReturnLabel
                        : isLast ? 'Finish' : 'Next step'
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
                                            <p className="cooking-card-text is-current">Optional prep - get these ready first</p>
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

                    const renderStepCard = (item: any, idx: number, state: 'done' | 'current' | 'upcoming', isNext: boolean, peeked: boolean = false) => {
                        const text = instructions[item.stepIndex]?.Text || ''
                        const recs = ingredsByStep[item.stepIndex]?.recommended || []
                        const prepRecs = prepByStep[item.stepIndex]?.recommended || []
                        const uncheckedPrep = prepRecs.filter((p: any) => {
                            const realIdx = prepWork.findIndex((w: any) => w.action === p.action && w.ingredient === p.ingredient)
                            return realIdx >= 0 && !checkedPrep.has(realIdx)
                        })
                        const showChips = state === 'current' || (state === 'upcoming' && isNext)
                        const stepTimers = timersByStep[item.stepIndex] || []
                        // Side-lane tracking: this is the main-dish step the
                        // cook returns to after any side phase — show the
                        // side's status so parallel work stays visible.
                        const phasesHere = (carbChoice?.phases || []).filter((p: any) => p.insertAfter === item.stepIndex)
                        const allPhases = carbChoice?.phases || []
                        const returnPhase = phasesHere.reduce((acc: any, p: any) => {
                            if (!p.timerId) return acc
                            const live = ['active', 'paused', 'overdue'].includes(getTimerStatus(p.timerId))
                            const pending = !['completed', 'overdue'].includes(getTimerStatus(p.timerId))
                            if (live && !acc?.live) return { phase: p, pi: allPhases.findIndex((q: any) => q.timerId === p.timerId), live: true }
                            if (pending && !acc) return { phase: p, pi: allPhases.findIndex((q: any) => q.timerId === p.timerId), live: false }
                            return acc
                        }, undefined)
                        const returnTimer = returnPhase?.phase?.timerId
                            ? customTimers.find((t: any) => t.id === returnPhase.phase.timerId)
                            : undefined
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
                                        <span className="cooking-card-label text-muted-foreground" title="Main dish step">Main dish</span>
                                        {state === 'done' && (
                                            <span className="cooking-card-label"><Check size={13} strokeWidth={3} /> Step {item.stepIndex + 1}</span>
                                        )}
                                        {state === 'current' && (
                                            <span className="cooking-card-label is-accent">Step {item.stepIndex + 1} of {instructions.length}</span>
                                        )}
                                        {state === 'current' && (() => {
                                            // Step's own involvement (edited in the Timing
                                            // section) wins; fall back to its timers' levels.
                                            const stepLevel = instructions[item.stepIndex]?.involvement
                                            const inv = INVOLVEMENT_META[stepLevel] ? stepLevel : stepWorstInvolvement(stepTimers)
                                            // No "Active" tag — active is the assumed
                                            // default; only flag check-in/walk-away.
                                            if (!inv || inv === 'active') return null
                                            const meta = INVOLVEMENT_META[inv]
                                            return <span className={`cooking-timer-tag is-inv-${inv}`} title={meta.title}>{meta.label}</span>
                                        })()}
                                        {state === 'upcoming' && (
                                            <span className="cooking-card-label">{isNext ? 'Up next' : `Step ${item.stepIndex + 1}`}</span>
                                        )}
                                        {state !== 'current' && (item.stepIndex + 1) === instructions.length && (
                                            <span className="cooking-card-label">Last step</span>
                                        )}
                                    </div>
                                    <div className={`cooking-card-text is-${state} ${state === 'current' && splitSentences(text).length >= 2 ? 'is-stacked' : ''} ${state === 'current' && isLongStep(text) ? 'is-long' : ''}`}>
                                        {renderStepText(text, {
                                            ingredients: state === 'done' ? [] : recs,
                                            onIngredientClick: (ingred, anchor) => openIngredientPopup(ingred, anchor, item.stepIndex)
                                        })}
                                    </div>
                                    {/* Returning to the main dish after a side
                                        phase: keep the side's status in sight */}
                                    {returnTimer && state === 'current' && (() => {
                                        const status = getTimerStatus(returnTimer.id)
                                        const live = ['active', 'paused', 'overdue'].includes(status)
                                        const during = !!returnPhase.phase.during
                                        const hintHeadsup = during && live && !!activeSession[returnTimer.id]?.preAlertHit
                                        return (
                                            <button
                                                className={`cooking-prep-hint ${hintHeadsup ? 'is-headsup' : ''}`}
                                                onClick={() => {
                                                    const fi = flowItems.findIndex(f => f.kind === 'carb' && f.phaseIndex === returnPhase.pi)
                                                    if (fi >= 0) peekTo(fi)
                                                }}
                                            >
                                                <span className="cooking-prep-hint-task">
                                                    <ChefHat size={12} />
                                                    <span className="cooking-prep-hint-text">
                                                        {carbChoice.label}: {returnPhase.phase.name} — {live
                                                            ? (during
                                                                ? (activeSession[returnTimer.id]?.preAlertHit
                                                                    ? `head back! starts in ${formatCountdown(getRemaining(activeSession[returnTimer.id], nowMs))}`
                                                                    : `starts in ${formatCountdown(getRemaining(activeSession[returnTimer.id], nowMs))} (heads-up ${SIDE_HEADS_UP_MIN} min before)`)
                                                                : `${formatCountdown(getRemaining(activeSession[returnTimer.id], nowMs))} left`)
                                                            : 'not started yet'}
                                                        {live && (activeSession[returnTimer.id]?.endTime) && <span className="cooking-prep-hint-more"> ({during ? 'start at' : 'done at'} {new Date(activeSession[returnTimer.id].endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>}
                                                    </span>
                                                </span>
                                                <span className="cooking-prep-hint-cta">tap to view side</span>
                                            </button>
                                        )
                                    })()}
                                    {peeked && state === 'current' && (
                                        <div className="cooking-current-hint">Peeking · Next returns to where you were</div>
                                    )}
                                    {showChips && recs.length > 0 && (
                                        <div className="cooking-chips">
                                            {recs.map((ingred: any, ci: number) => (
                                                <span key={ci} className="cooking-chip">
                                                    <span className="cooking-chip-name">{ingred.name}</span>
                                                    <span className="cooking-chip-qty">{scaleQty(ingred.quantity)} {ingred.quantity_type_shorthand || ingred.quantity_type}</span>
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

                    // Side-dish phase card: injected flow item carrying one
                    // phase of the chosen carb (boil, cook, fluff…). Its
                    // timer lives as a "custom" timer (per phase) so alarms +
                    // finish-gate work; user starts it manually, then returns
                    // to the main-dish step they left off at.
                    const renderCarbCard = (item: any, idx: number, state: 'done' | 'current' | 'upcoming', isNext: boolean, peeked: boolean = false) => {
                        const phases = carbChoice?.phases || []
                        const phase = phases[item.phaseIndex] || phases[0] || { name: 'Side step', instruction: '', minutes: 0 }
                        const phaseCount = phases.length
                        const text = phase.instruction || `${carbChoice?.label}: ${phase.name}`
                        const carbTimer = phase.timerId ? customTimers.find((t: any) => t.id === phase.timerId) : undefined
                        const nextPending = phases.find((p: any, pi: number) => pi > item.phaseIndex
                            && p.timerId
                            && !['completed', 'overdue'].includes(getTimerStatus(p.timerId)))
                        // Scheduled ("during") phases present as a WAIT while their
                        // timer counts down to the start moment — calm blue card,
                        // "Wait X min" headline, the actual work in a slide-out.
                        // Once the timer fires the card flips to "do it now".
                        // Only auto-scheduled waits count; a phase started by hand
                        // is work in progress, not waiting.
                        const waitSession = phase.during && carbTimer ? activeSession[carbTimer.id] : undefined
                        const isWaiting = !!(waitSession && waitSession.during && ['active', 'paused'].includes(waitSession.status))
                        const isDoing = !isWaiting && !!phase.during && !!carbTimer && ['active', 'paused'].includes(getTimerStatus(carbTimer.id))
                        const isDue = waitSession && waitSession.status === 'overdue'
                        const headsup = !!(waitSession && waitSession.preAlertHit)
                        const waitRemaining = waitSession ? getRemaining(waitSession, nowMs) : 0
                        const waitMins = Math.max(1, Math.ceil(waitRemaining / 60))
                        const waitStartStr = waitSession?.endTime
                            ? new Date(waitSession.status === 'paused' ? Date.now() + (waitSession.remaining || 0) * 1000 : waitSession.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : null
                        const slideId = phase.timerId || `phase-${item.phaseIndex}`
                        const slideOpen = openCarbSlide === slideId
                        return (
                            <div
                                key={idx}
                                ref={(el: HTMLDivElement | null) => { cardRefs.current[idx] = el }}
                                className="cooking-step-group"
                            >
                                {/* Optional recommendation: dashed border keeps it
                                    visually distinct from recipe steps (waiting
                                    phases go solid in their own calm colour) */}
                                <div
                                    className={`cooking-card cooking-card-step cooking-card-carb is-${state} ${isWaiting ? 'is-waiting' : ''} ${isNext && state === 'upcoming' ? 'is-next' : ''} ${state === 'done' ? 'is-clickable' : ''}`}
                                    style={{ borderStyle: isWaiting ? 'solid' : 'dashed' }}
                                    onClick={state === 'done' ? () => jumpTo(idx) : undefined}
                                >
                                    <div className="cooking-card-top">
                                        {state === 'done' && (
                                            <span className="cooking-card-label"><Check size={13} strokeWidth={3} /> Recommended side · done</span>
                                        )}
                                        {!isWaiting && state === 'current' && (
                                            <span className="cooking-card-label is-accent"><ChefHat size={13} /> Recommended side · {isDue ? 'do it now' : carbChoice?.label}</span>
                                        )}
                                        {isWaiting && state !== 'done' && (
                                            <span className="cooking-card-label is-wait"><Hourglass size={13} /> Recommended side · waiting</span>
                                        )}
                                        {!isWaiting && state === 'upcoming' && (
                                            <span className="cooking-card-label">{isNext ? 'Up next' : 'Side dish'}</span>
                                        )}
                                    </div>
                                    {phaseCount > 1 && (
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                            Phase {item.phaseIndex + 1} of {phaseCount} · {phase.name}
                                        </p>
                                    )}
                                    {isWaiting && state !== 'done' ? (
                                        <>
                                            <p className="cooking-wait-headline">
                                                Wait <span className="cooking-wait-count">{waitSession?.status === 'paused' ? 'paused' : formatDuration(waitMins)}</span> to start the next step
                                            </p>
                                            <p className="cooking-wait-sub">
                                                {headsup
                                                    ? <>Head back — {phase.name}{waitStartStr ? ` starts at ${waitStartStr}` : ''}</>
                                                    : <>then {phase.name}{waitStartStr ? ` · start at ${waitStartStr}` : ''} · we'll ring {SIDE_HEADS_UP_MIN} min before</>}
                                                {' '}— Step {item.stepIndex + 1} keeps cooking
                                            </p>
                                            <button
                                                className={`cooking-slide-toggle ${slideOpen ? 'is-open' : ''}`}
                                                onClick={() => setOpenCarbSlide(slideOpen ? null : slideId)}
                                            >
                                                What you'll do <ChevronDown size={13} />
                                            </button>
                                            <div className={`cooking-side-slideout ${slideOpen ? 'open' : ''}`}>
                                                <p className="cooking-slideout-text">{text}</p>
                                            </div>
                                        </>
                                            ) : (
                                                <>
                                            <p className={`cooking-card-text is-${state}`}>{text}</p>
                                            {peeked && (
                                                <div className="cooking-current-hint">Peeking · Next returns to where you were</div>
                                            )}
                                            {isDue && state === 'current' && !peeked && (
                                                <>
                                                    <div className="cooking-current-hint">
                                                        Time to do this now — <strong>Step {item.stepIndex + 1} · main dish</strong> keeps cooking in the background{nextPending ? `, and its next phase (${nextPending.name}) comes up later` : ''}
                                                    </div>
                                                    {carbTimer && (
                                                        <button className="cooking-start-timer" onClick={() => completeTimer(carbTimer)}>
                                                            <Check size={16} strokeWidth={3} />
                                                            Done ✓
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {!isDue && state === 'current' && !peeked && (
                                                <div className="cooking-current-hint">
                                                    {carbTimer
                                                        ? (isDoing
                                                            ? <>Timer running — carry on with <strong>Step {item.stepIndex + 1} · main dish</strong> — the side runs in the background{nextPending ? `, and its next phase (${nextPending.name}) comes up later` : ''}</>
                                                            : phase.during
                                                                ? <>Timer fires ~{phase.intoMinutes} min into <strong>Step {item.stepIndex + 1} · main dish</strong> once that timer runs — or start it below yourself; the side runs in the background{nextPending ? `, and its next phase (${nextPending.name}) comes up later` : ''}</>
                                                                : <>Start the timer below, then carry on with <strong>Step {item.stepIndex + 1} · main dish</strong> — the side runs in the background{nextPending ? `, and its next phase (${nextPending.name}) comes up later` : ''}</>)
                                                        : <>Do this as the last step finishes, then move on below</>}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                {carbTimer && renderTimerTab(carbTimer, state, isWaiting ? 'wait' : undefined)}
                            </div>
                        )
                    }

                    // Timer attached to its step: pokes out underneath the step card,
                    // suggests/controls the timer that helps complete the step.
                    const renderTimerTab = (timer: any, state: 'done' | 'current' | 'upcoming', variant?: 'wait') => {
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
                        // Walk-away timers keep the calm blue "waiting" card
                        // once they start running; red alarm only on overdue.
                        const walk = involvementOf(timer) === 'none'
                        const liveTone = walk && !isOverdue ? 'is-wait' : 'is-accent'
                        const liveNameTone = walk && !isOverdue ? 'is-wait' : 'is-accent'
                        const doneLiveTone = walk && !isOverdue ? 'is-wait' : 'is-live'

                        // Blue waiting tab: the countdown runs down to the moment
                        // this scheduled phase starts (not to its completion).
                        if (variant === 'wait' && (status === 'active' || status === 'paused')) {
                            const waitTotalSecs = Math.max(1, (timer.intoMinutes || 0) * 60)
                            const waitProgress = Math.min(100, Math.max(0, ((waitTotalSecs - remaining) / waitTotalSecs) * 100))
                            const headsup = !!session?.preAlertHit
                            return (
                                <div key={timer.id} className={`cooking-timer-tab is-wait ${headsup ? 'is-headsup' : ''}`}>
                                    <div className="cooking-timer-tab-head">
                                        <span className="cooking-timer-tab-name is-wait"><Hourglass size={12} /> {name}</span>
                                        <span className="cooking-timer-tag">{headsup ? 'Head back' : 'Waiting'}</span>
                                    </div>
                                    <div className="cooking-countdown is-wait">{formatCountdown(remaining)}</div>
                                    {finishTimeStr && (
                                        <div className="cooking-countdown-sub">
                                            {headsup ? 'Head back — start at ' : 'Start at '}{finishTimeStr} · rings {SIDE_HEADS_UP_MIN} min before
                                        </div>
                                    )}
                                    <div className="cooking-progress-track">
                                        <div className="cooking-progress-fill is-wait" style={{ width: `${waitProgress}%` }} />
                                    </div>
                                    <div className="cooking-timer-actions">
                                        <button className="cooking-timer-btn" onClick={() => pauseResumeTimer(timer)}>{status === 'active' ? 'Pause' : 'Resume'}</button>
                                        <button className="cooking-timer-btn" onClick={() => addTimerSeconds(timer, 300)}>+5 min</button>
                                        <button
                                            className="cooking-timer-btn is-primary"
                                            onClick={() => completeTimer(timer)}
                                        >
                                            Do it now
                                        </button>
                                    </div>
                                </div>
                            )
                        }

                        if (state === 'done') {
                            if (live) {
                                return (
                                    <div key={timer.id} className={`cooking-timer-tab ${doneLiveTone} ${isOverdue ? 'is-overdue' : ''}`}>
                                        <div className="cooking-timer-tab-head">
                                            <span className={`cooking-timer-tab-name ${liveNameTone}`}>{walk ? <Hourglass size={12} /> : <Clock size={12} />} {name}</span>
                                            {renderInvolvementTag(timer)}
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
                                <div key={timer.id} className={`cooking-timer-tab is-muted ${walk ? 'is-wait' : ''}`}>
                            <div className="cooking-timer-tab-head">
                                    <span className="cooking-timer-tab-name"><Clock size={12} /> {name} · {formatDuration(timer.duration)}</span>
                                    {renderInvolvementTag(timer)}
                                </div>
                                </div>
                            )
                        }

                        if (live) {
                            return (
                                <div key={timer.id} className={`cooking-timer-tab ${liveTone} ${isOverdue ? 'is-overdue' : ''}`}>
                                    <div className="cooking-timer-tab-head">
                                        <span className={`cooking-timer-tab-name ${liveNameTone}`}>{walk ? <Hourglass size={12} /> : <Clock size={12} />} {name}</span>
                                            {renderInvolvementTag(timer)}
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
                            <div key={timer.id} className={`cooking-timer-tab ${walk ? (depDone ? 'is-wait' : 'is-wait is-muted') : depDone ? 'is-accent' : 'is-muted'}`}>
                                <div className="cooking-timer-tab-head">
                                    <span className={`cooking-timer-tab-name ${depDone ? 'is-accent' : ''}`}>
                                        {walk ? <Hourglass size={12} /> : <Clock size={12} />} {name} · {formatDuration(timer.duration)}
                                    </span>
                                    {renderInvolvementTag(timer)}
                                </div>
                                {!depDone ? (
                                    <div className="cooking-timer-tab-note">Waiting for “{depName}” to finish</div>
                                ) : walk ? (
                                    <div className="cooking-timer-tab-note">Start it, then walk away — rings when it's time</div>
                                ) : (
                                    <div className="cooking-timer-tab-note">Run a timer to help with this step</div>
                                )}
                                <button
                                    className="cooking-start-timer"
                                    disabled={!depDone}
                                    onClick={() => startTimer(timer)}
                                >
                                    <Clock size={16} />
                                    Start {formatDuration(timer.duration)} timer
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
                        // Walk-away timers run in the calm blue treatment
                        const walkMgr = involvementOf(timer) === 'none'

                        if (status === 'active' || status === 'paused' || status === 'overdue') {
                            const isOverdue = status === 'overdue'
                            const mgrWait = walkMgr && !isOverdue
                            return (
                                <div key={timer.id} className={`cooking-mgr-card is-${status} ${mgrWait ? 'is-wait' : ''}`}>
                                    <div className="cooking-mgr-head">
                                        <span className={`cooking-mgr-name ${mgrWait ? 'is-wait' : ''}`}>{timer.name}</span>
                                        <div className="cooking-mgr-head-actions">
                                            {renderInvolvementTag(timer)}
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
                                            className={`cooking-mgr-countdown ${isOverdue ? 'is-overdue' : ''} ${mgrWait ? 'is-wait' : ''}`}
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
                                        <div className="cooking-mgr-head-actions">
                                            {renderInvolvementTag(timer)}
                                            {timer.stepIndex != null && <span className="cooking-mgr-tag">Step {timer.stepIndex + 1}</span>}
                                        </div>
                                    </div>
                                    {isPastStep ? (
                                        <button className="cooking-timer-btn is-full" onClick={() => completeTimer(timer)}>✓ Mark complete</button>
                                    ) : !depDone ? (
                                        <div className="cooking-mgr-waiting">Waiting for {depName}</div>
                                    ) : (
                                        <button className="cooking-timer-btn is-full is-accent" onClick={() => startTimer(timer)}>Start {formatDuration(timer.duration)}</button>
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
                                    // Scheduled side phase sitting in its wait: blue
                                    // card counting down to the start moment.
                                    const isWait = !!(timer.during && session?.during && ['active', 'paused'].includes(status))
                                    const waitHeadsup = isWait && !!session?.preAlertHit
                                    const waitStartStr = session?.endTime
                                        ? new Date(session.status === 'paused' ? Date.now() + (session.remaining || 0) * 1000 : session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : null
                                    if (status === 'active' || status === 'paused' || status === 'overdue') {
                                        return (
                                            <div key={timer.id} className={`cooking-mgr-card is-${status} ${isWait ? 'is-wait' : ''} ${waitHeadsup ? 'is-headsup' : ''}`}>
                                    <div className="cooking-mgr-head">
                                        <span className={`cooking-mgr-name ${isWait ? 'is-wait' : ''}`}>{timer.name}</span>
                                            <div className="cooking-mgr-head-actions">
                                            {isWait && <span className="cooking-timer-tag is-wait">{waitHeadsup ? 'Head back' : 'Waiting'}</span>}
                                                        {isOverdue && <span className="cooking-timer-tag is-overdue">Overdue</span>}
                                                        <button className="cooking-mgr-link" onClick={() => resetTimer(timer)}>Reset</button>
                                                        <button className="cooking-mgr-link is-danger" onClick={() => removeCustomTimer(timer.id)}>✕</button>
                                                    </div>
                                                </div>
                                                <div className={`cooking-mgr-countdown ${isOverdue ? 'is-overdue' : ''} ${isWait ? 'is-wait' : ''}`}>{formatCountdown(remaining)}
                                                    <span className="cooking-mgr-countdown-hint">
                                                        {isWait ? (waitStartStr ? `${waitHeadsup ? 'head back — start at ' : 'start at '}${waitStartStr}` : 'waiting') : 'tap to adjust'}
                                                    </span>
                                                </div>
                                                <div className="cooking-progress-wrap">
                                                    <div className="cooking-progress-track">
                                                        <div className={`cooking-progress-fill ${isWait ? 'is-wait' : ''}`} style={{ width: `${progress}%` }} />
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
                                                        {isWait ? (
                                                            <button
                                                                className="cooking-timer-btn is-primary"
                                                                onClick={() => completeTimer(timer)}
                                                            >
                                                                Do it now
                                                            </button>
                                                        ) : (
                                                            <button className="cooking-timer-btn is-primary" onClick={() => completeTimer(timer)}>Done ✓</button>
                                                        )}
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
                                <div key={timer.id} className={`cooking-mgr-card is-pending ${involvementOf(timer) === 'none' ? 'is-wait' : ''}`}>
                                            <div className="cooking-mgr-head">
                                                <span className="cooking-mgr-name">{timer.name}</span>
                                                <button className="cooking-mgr-link is-danger" onClick={() => removeCustomTimer(timer.id)}>✕</button>
                                            </div>
                                            <button className="cooking-timer-btn is-full is-accent" onClick={() => startTimer(timer)}>Start {formatDuration(timer.duration)}</button>
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
                                                <span className="cooking-ingredient-qty">{scaleQty(ingred.quantity)} {ingred.quantity_type_shorthand || ingred.quantity_type}</span>
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
                                                <span className="cooking-ingredient-qty">{scaleQty(ingred.quantity)} {ingred.quantity_type_shorthand || ingred.quantity_type}</span>
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
                                <button className="cooking-icon-btn" onClick={() => { setIsCookingMode(false); setDoneFlow(new Set()); setForcedView(null) }} aria-label="Exit cooking mode">
                                    <img src="/cross.png" className="w-4 h-4 invert-[.25] dark:invert" alt="close" />
                                </button>
                                <div className="cooking-header-center">
                                    <div className="cooking-header-title">
                                        {(() => {
                                            // While peeking, the title names the
                                            // peeked card, not the flow position.
                                            const titleItem = forcedView ? flowItems[forcedView.idx] : current
                                            return titleItem ? (
                                                titleItem.kind === 'prep'
                                                    ? <>Prep work</>
                                                    : titleItem.kind === 'carb'
                                                        ? <>Side · {(carbChoice?.phases || [])[titleItem.phaseIndex]?.name || carbChoice?.label}</>
                                                        : <>Step {titleItem.stepIndex + 1} of {instructions.length}</>
                                            ) : 'Cooking'
                                        })()}
                                    </div>
                                    {/* Sticky side-status pill: shows which side
                                        phase is running/next so the parallel
                                        lane stays glanceable anywhere */}
                                    {carbChoice?.phases?.some((p: any) => p.timerId) && (() => {
                                        const phases = carbChoice.phases as any[]
                                        const live = phases.find((p: any) => ['active', 'paused', 'overdue'].includes(getTimerStatus(p.timerId)))
                                        const shownTimer = live ? activeSession[live.timerId] : undefined
                                        if (live) {
                                            const remaining = shownTimer ? getRemaining(shownTimer, nowMs) : live.minutes * 60
                                            return (
                                                <button
                                                    className="cooking-side-pill"
                                                    onClick={() => {
                                                        const fi = flowItems.findIndex(f => f.kind === 'carb' && carbChoice.phases[f.phaseIndex]?.timerId === live.timerId)
                                                        if (fi >= 0) peekTo(fi)
                                                    }}
                                                    title={'Side: ' + live.name}
                                                >
                                                    <ChefHat size={11} />
                                                    <span>{carbChoice.label}: {live.name}</span>
                                                    <strong>{live.during && shownTimer?.status === 'active' ? `in ${formatCountdown(remaining)}` : formatCountdown(remaining)}</strong>
                                                </button>
                                            )
                                        }
                                        const pending = phases.find((p: any) => p.timerId && !['completed', 'overdue'].includes(getTimerStatus(p.timerId)))
                                        if (!pending) return null
                                        return (
                                            <button
                                                className="cooking-side-pill is-pending"
                                                onClick={() => {
                                                    const fi = flowItems.findIndex(f => f.kind === 'carb' && carbChoice.phases[f.phaseIndex]?.timerId === pending.timerId)
                                                    if (fi >= 0) peekTo(fi)
                                                }}
                                            >
                                                <ChefHat size={11} />
                                                <span>{carbChoice.label}: {pending.name}</span>
                                                <strong>start?</strong>
                                            </button>
                                        )
                                    })()}
                                    <div className="cooking-progress">
                                        {flowItems.map((item, idx) => {
                                            const segDone = idx < clampedCurrent || doneFlow.has(idx)
                                            const segCurrent = idx === clampedCurrent || idx === forcedView?.idx
                                            const label = item.kind === 'prep'
                                                ? 'Prep work'
                                                : item.kind === 'carb'
                                                    ? `${carbChoice?.label || 'Side'}: ${carbChoice?.phases?.[item.phaseIndex]?.name || 'phase'}`
                                                    : `Step ${item.stepIndex + 1}`
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => jumpTo(idx)}
                                                    className={`cooking-progress-seg ${item.kind === 'carb' ? 'is-side' : ''} ${segDone ? 'is-done' : ''} ${segCurrent ? 'is-current' : ''}`}
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
                                        // A peeked card renders as current on top
                                        // of the real flow position beneath it.
                                        const peeked = forcedView?.idx === idx
                                        const state = peeked
                                            ? 'current'
                                            : idx < clampedCurrent ? 'done' : idx === clampedCurrent ? 'current' : 'upcoming'
                                        const isNext = idx === clampedCurrent + 1
                                        return item.kind === 'prep'
                                            ? renderPrepCard(idx, state)
                                            : item.kind === 'carb'
                                                ? renderCarbCard(item, idx, state, isNext, peeked)
                                                : renderStepCard(item, idx, state, isNext, peeked)
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
                                    disabled={clampedCurrent === 0 && !forcedView}
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
                                                // Carb phase timers point at their flow
                                                // card; recipe timers at their step.
                                                const stepFlowIdx = timer.carb
                                                    ? flowItems.findIndex(f => f.kind === 'carb' && carbChoice?.phases?.[f.phaseIndex]?.timerId === timer.id)
                                                    : (typeof timer.stepIndex === 'number'
                                                        ? flowItems.findIndex(f => f.kind === 'step' && f.stepIndex === timer.stepIndex)
                                                        : -1)
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
                                                                    // Peek at the card without
                                                                    // abandoning the current step.
                                                                    peekTo(stepFlowIdx)
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
                                    setForcedView(null)
                                    if (id) {
                                        const keys = Object.keys(localStorage).filter(k => k.startsWith('timer-session-'))
                                        keys.forEach(k => localStorage.removeItem(k))
                                    }
                                    setCurrentFlow(0)
                                    setDoneFlow(new Set())
                                    setActiveSheet('none')
                                    // The old carb decision dies with the session:
                                    // prompt again like a fresh Start Cooking.
                                    setCarbChoice(null)
                                    if (needsCarbChoice()) {
                                        loadCarbData().then(hasCatalog => {
                                            if (hasCatalog) {
                                                setCarbModalNone(false)
                                                setCarbModalOpen(true)
                                            } else {
                                                const fallback = fallbackCarbChoice()
                                                if (fallback) setCarbChoice(fallback)
                                            }
                                        })
                                    }
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
            {popIngredient && (
                <IngredientPopover
                    ingred={popIngredient}
                    anchorRect={popAnchor}
                    alsoSteps={popAlsoSteps}
                    onClose={closeIngredientPopup}
                />
            )}
        </Layout>
    )
}
