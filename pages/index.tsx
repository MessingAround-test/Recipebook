import { useState, useEffect, useMemo, useCallback } from 'react'
import Router from 'next/router'
import { Layout } from '../components/Layout'
import { useAuthGuard } from '../lib/useAuthGuard'
import { NUTRIENT_LABELS } from '../lib/dailyIntake'
import { FiZap, FiActivity, FiShoppingCart, FiCalendar, FiArrowRight, FiPlus, FiCheckCircle, FiChevronRight, FiTrendingUp, FiSearch, FiX, FiCoffee, FiRefreshCw } from 'react-icons/fi'
import IngredientEditor from '../components/IngredientEditor'
import { fileToBase64 } from '../lib/recipeImage'
import { extractRecipeFromImage, saveRecipe, Ingredient } from '../lib/recipeExtraction'

const getLocalDateString = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const getMonday = (d: Date) => {
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const m = new Date(d)
    m.setDate(diff)
    return getLocalDateString(m)
}

const SCORE_KEYS = ['energy_kcal', 'protein_g', 'carbohydrates_g', 'fat_g', 'fiber_g']

const UNITS = ['gram', 'each', 'kg', 'ml', 'cup', 'tbsp', 'tsp']

const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse bg-white/[0.04] rounded-xl ${className}`} />
)

const IconChip = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${className}`}>{children}</div>
)

export default function Dashboard() {
    const isAuthed = useAuthGuard()

    const [loading, setLoading] = useState(true)
    const [targets, setTargets] = useState<any>(null)
    const [todayLog, setTodayLog] = useState<any>(null)
    const [recommendations, setRecommendations] = useState<any>(null)
    const [weekPlan, setWeekPlan] = useState<any>(null)
    const [shoppingLists, setShoppingLists] = useState<any[]>([])
    const [listItemsCount, setListItemsCount] = useState<number | null>(null)
    const [trendDays, setTrendDays] = useState<any[]>([])
    const [recipes, setRecipes] = useState<any[]>([])
    const [knownIngredients, setKnownIngredients] = useState<string[]>([])

    // Quick-log state
    const [isLoggingOpen, setIsLoggingOpen] = useState(false)
    const [logSearch, setLogSearch] = useState('')
    const [logSelection, setLogSelection] = useState<any>(null)
    const [servingsToLog, setServingsToLog] = useState(1)
    const [ingredientQty, setIngredientQty] = useState(100)
    const [ingredientUnit, setIngredientUnit] = useState('gram')
    const [logging, setLogging] = useState(false)

    // Quick-log photo state
    const [logView, setLogView] = useState<'list' | 'photo' | 'validate'>('list')
    const [photoImage, setPhotoImage] = useState<string | null>(null)
    const [photoNotes, setPhotoNotes] = useState('')
    const [photoStatus, setPhotoStatus] = useState('')
    const [photoExtracting, setPhotoExtracting] = useState(false)
    const [draftRecipe, setDraftRecipe] = useState<any>(null)
    const [draftName, setDraftName] = useState('')
    const [draftServings, setDraftServings] = useState<number>(1)
    const [draftIngredients, setDraftIngredients] = useState<Ingredient[]>([])
    const [isCreating, setIsCreating] = useState(false)
    const [refreshing, setRefreshing] = useState(false)

    const loadData = useCallback(async () => {
        const token = localStorage.getItem('Token')
        if (!token) return

        setLoading(true)
        const today = getLocalDateString(new Date())
        const weekStart = getMonday(new Date())
        const trendStart = new Date()
        trendStart.setDate(trendStart.getDate() - 6)

        Promise.allSettled([
            fetch('/api/dailyIntake', { headers: { edgetoken: token } }).then(r => r.json()),
            fetch(`/api/dailyLog?date=${today}`, { headers: { edgetoken: token } }).then(r => r.json()),
            fetch('/api/dailyLog/recommendations', { headers: { edgetoken: token } }).then(r => r.json()),
            fetch(`/api/weeklyPlan?startDate=${weekStart}`, { headers: { edgetoken: token } }).then(r => r.json()),
            fetch('/api/ShoppingList', { headers: { edgetoken: token } }).then(r => r.json()),
            fetch(`/api/trends?startDate=${getLocalDateString(trendStart)}&endDate=${today}`, { headers: { edgetoken: token } }).then(r => r.json()),
            fetch('/api/Recipe', { headers: { edgetoken: token } }).then(r => r.json()),
            fetch('/api/Ingredients/defaults', { headers: { edgetoken: token } }).then(r => r.json()),
        ]).then(([targetRes, logRes, recRes, planRes, listRes, trendRes, recipeRes, ingRes]) => {
            if (targetRes.status === 'fulfilled' && targetRes.value.success) {
                setTargets(targetRes.value.targets)
            }
            if (logRes.status === 'fulfilled' && logRes.value.success) {
                setTodayLog(logRes.value.log)
            }
            if (recRes.status === 'fulfilled' && recRes.value.success) {
                setRecommendations(recRes.value)
            }
            if (planRes.status === 'fulfilled' && planRes.value.success && planRes.value.plan) {
                setWeekPlan(planRes.value.plan)
            }
            if (listRes.status === 'fulfilled') {
                const lists = (listRes.value.res || []).filter((l: any) => l.complete !== true)
                lists.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                setShoppingLists(lists)
            }
            if (trendRes.status === 'fulfilled' && trendRes.value.success) {
                setTrendDays(trendRes.value.days || [])
            }
            if (recipeRes.status === 'fulfilled' && recipeRes.value.res) {
                setRecipes(recipeRes.value.res)
            }
            if (ingRes.status === 'fulfilled' && ingRes.value.success) {
                setKnownIngredients(ingRes.value.data || [])
            }
        }).finally(() => setLoading(false))
    }, [])

    const refreshIntake = useCallback(async () => {
        const token = localStorage.getItem('Token')
        if (!token) return
        setRefreshing(true)
        try {
            await fetch('/api/dailyLog/recompute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({ date: getLocalDateString(new Date()) })
            })
        } catch (err) {
            console.error('Refresh intake error:', err)
        } finally {
            await loadData()
            setRefreshing(false)
        }
    }, [loadData])

    useEffect(() => {
        if (isAuthed) loadData()
    }, [isAuthed, loadData])

    const latestList = shoppingLists[0] || null

    useEffect(() => {
        if (!latestList) return
        const token = localStorage.getItem('Token')
        if (!token) return
        fetch(`/api/ShoppingList/GroupedIngredients?shoppingListId=${latestList._id}`, { headers: { edgetoken: token } })
            .then(r => r.json())
            .then(d => { if (d.success) setListItemsCount((d.res || []).length) })
            .catch(() => {})
    }, [latestList])

    const totals = useMemo(() => {
        return (todayLog?.items || []).reduce((acc: any, item: any) => {
            Object.keys(item.nutrients || {}).forEach(k => {
                acc[k] = (acc[k] || 0) + (item.nutrients[k] || 0)
            })
            return acc
        }, {} as any)
    }, [todayLog])

    const dailyScore = useMemo(() => {
        if (!targets || !todayLog?.items?.length) return 0
        const pcts = SCORE_KEYS.map(k => {
            const target = targets[k]
            if (!target) return 0
            return Math.min(((totals[k] || 0) / target) * 100, 100)
        })
        return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
    }, [targets, todayLog, totals])

    const calories = Math.round(totals.energy_kcal || 0)
    const calorieTarget = targets?.energy_kcal || 0
    const caloriePct = calorieTarget > 0 ? Math.min((calories / calorieTarget) * 100, 100) : 0

    const scoreColor = dailyScore > 80 ? 'text-emerald-400' : dailyScore > 50 ? 'text-amber-400' : 'text-rose-400'

    const trendAvg = useMemo(() => {
        const withScore = trendDays.filter(d => d.score > 0)
        return withScore.length ? Math.round(withScore.reduce((a, b) => a + b.score, 0) / withScore.length) : 0
    }, [trendDays])

    const todayDayName = new Date().toLocaleDateString('en-AU', { weekday: 'long' })
    const todayMeals = weekPlan?.plannedRecipes?.filter((r: any) => r.day === todayDayName) || []
    const plannedCount = weekPlan?.plannedRecipes?.length || 0
    const everydayCount = weekPlan?.everydayItems?.length || 0
    const hasWeekPlan = plannedCount > 0 || everydayCount > 0

    const deficient = recommendations?.deficientNutrient
    const nutrientInfo = deficient ? NUTRIENT_LABELS[deficient as keyof typeof NUTRIENT_LABELS] : null

    // ── Quick-log helpers ──
    const combinedOptions = useMemo(() => {
        const options: any[] = []
        const recipeNames = new Set(recipes.map(r => (r.name || '').toLowerCase()))
        const ingredientNames = new Set(knownIngredients.map(i => (i || '').toLowerCase()))

        recipes.forEach(r => {
            const collides = ingredientNames.has((r.name || '').toLowerCase())
            options.push({
                label: r.name,
                value: r._id,
                type: 'recipe',
                data: r,
                emoji: collides ? '🍲' : null
            })
        })
        knownIngredients.forEach(i => {
            const collides = recipeNames.has((i || '').toLowerCase())
            options.push({ label: i, value: i, type: 'ingredient', data: i, emoji: collides ? '🥗' : null })
        })
        return options
    }, [recipes, knownIngredients])

    const filteredLog = useMemo(() => {
        const q = logSearch.trim().toLowerCase()
        const filtered = q ? combinedOptions.filter(o => o.label.toLowerCase().includes(q)) : combinedOptions
        return filtered.slice(0, 24)
    }, [combinedOptions, logSearch])

    const openLog = () => {
        setLogSearch('')
        setLogSelection(null)
        setServingsToLog(1)
        setIngredientQty(100)
        setIngredientUnit('gram')
        setLogView('list')
        setPhotoImage(null)
        setPhotoNotes('')
        setPhotoStatus('')
        setDraftRecipe(null)
        setDraftName('')
        setDraftServings(1)
        setDraftIngredients([])
        setIsLoggingOpen(true)
    }

    const closeLog = () => {
        setIsLoggingOpen(false)
        setLogSelection(null)
        setLogSearch('')
    }

    const handlePhotoExtract = async () => {
        if (!photoImage || photoExtracting) return
        setPhotoExtracting(true)
        setPhotoStatus("Analyzing visual data...")
        try {
            const extracted = await extractRecipeFromImage(photoImage, photoNotes)
            setDraftRecipe(extracted)
            setDraftName(extracted.name || '')
            setDraftServings(extracted.servings && Number(extracted.servings) > 0 ? Number(extracted.servings) : 1)
            setDraftIngredients(extracted.ingredients || [])
            setLogView('validate')
        } catch (error: any) {
            console.error("Photo extraction error:", error)
            alert(error?.message || "Failed to extract recipe from photo")
        } finally {
            setPhotoExtracting(false)
            setPhotoStatus("")
        }
    }

    const handleCreateAndLog = async () => {
        if (!draftName.trim() || draftIngredients.length === 0 || isCreating) return
        setIsCreating(true)
        try {
            const token = localStorage.getItem('Token')
            const recipe = await saveRecipe({
                name: draftName.trim(),
                ingreds: draftIngredients,
                instructions: draftRecipe?.instructions || [],
                image: photoImage || undefined,
                time: draftRecipe?.time,
                genre: draftRecipe?.genre,
                mealTypes: draftRecipe?.mealTypes,
                carbType: draftRecipe?.carbType,
                servings: Number(draftServings) || 1,
                hidden: true
            })

            const res = await fetch('/api/dailyLog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({
                    date: getLocalDateString(new Date()),
                    type: 'recipe',
                    name: recipe.name || draftName.trim(),
                    recipe_id: recipe._id,
                    quantity: 1
                })
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.message || "Failed to log food")

            closeLog()
            refreshIntake()
        } catch (error: any) {
            console.error("Create & log error:", error)
            alert(error?.message || "Failed to create and log")
        } finally {
            setIsCreating(false)
        }
    }

    const handleLogIngredient = async () => {
        if (!logSelection || logging) return
        setLogging(true)
        const token = localStorage.getItem('Token')
        try {
            const res = await fetch('/api/dailyLog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({
                    date: getLocalDateString(new Date()),
                    type: 'ingredient',
                    name: logSelection.label,
                    quantity: Number(ingredientQty),
                    quantity_unit: ingredientUnit
                })
            })
            const data = await res.json()
            if (data.success) {
                closeLog()
                refreshIntake()
            } else {
                alert(data.message || "Failed to log")
            }
        } catch (err) {
            alert("Log failed")
        } finally {
            setLogging(false)
        }
    }

    const handleLogRecipe = async () => {
        if (!logSelection || logging) return
        setLogging(true)
        const token = localStorage.getItem('Token')
        try {
            const res = await fetch('/api/dailyLog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({
                    date: getLocalDateString(new Date()),
                    type: 'recipe',
                    name: logSelection.label,
                    recipe_id: logSelection.data._id,
                    quantity: Number(servingsToLog)
                })
            })
            const data = await res.json()
            if (data.success) {
                closeLog()
                refreshIntake()
            } else {
                alert(data.message || "Failed to log")
            }
        } catch (err) {
            alert("Log failed")
        } finally {
            setLogging(false)
        }
    }

    const macroCell = (key: string) => {
        const label = NUTRIENT_LABELS[key as keyof typeof NUTRIENT_LABELS]?.label || key
        const unit = NUTRIENT_LABELS[key as keyof typeof NUTRIENT_LABELS]?.unit || ''
        const consumed = Math.round(totals[key] || 0)
        const target = targets?.[key] || 0
        const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
        return (
            <div className="bg-white/[0.04] rounded-xl px-2 py-2.5 text-center">
                <div className="text-sm font-black leading-none">
                    {consumed}<span className="text-[10px] font-bold text-muted-foreground/70 ml-0.5">{unit}</span>
                </div>
                <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-emerald-400/80 rounded-full" style={{ width: `${pct}%` }} />
                </div>
            </div>
        )
    }

    return (
        <Layout title="Dashboard" description="Your health, plans and lists at a glance">
            <div className="-mx-6 md:mx-0">
                <div className="mx-auto max-w-6xl px-3 md:px-4 pt-1 pb-3 md:pt-2 md:pb-8 space-y-3 md:space-y-6">
                    {/* ═══ HEADER ═══ */}
                    <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 shrink-0">Dashboard</p>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                        <h1 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white truncate">
                            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h1>
                    </div>

                    {/* ═══ WEEK PLAN + SHOPPING LIST (central) ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                        {/* Weekly plan */}
                        {hasWeekPlan && (
                        <div className="bg-gradient-to-br from-amber-500/[0.12] via-transparent to-transparent rounded-2xl p-4 md:p-6 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2.5">
                                    <IconChip className="bg-amber-500/15 text-amber-400"><FiCalendar size={16} /></IconChip>
                                    <h3 className="text-sm font-black tracking-tight">This Week</h3>
                                </div>
                                <button
                                    onClick={() => Router.push('/weeklyPlanner')}
                                    className="text-[9px] font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1"
                                >
                                    Plan <FiArrowRight size={11} />
                                </button>
                            </div>

                            {loading && !weekPlan ? (
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-10" />
                                    <Skeleton className="h-12" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex gap-2 mb-4">
                                        <div className="flex-1 bg-black/25 rounded-xl p-3 text-center">
                                            <div className="text-2xl md:text-3xl font-black text-amber-300 leading-none">{plannedCount}</div>
                                            <div className="text-[8px] font-bold uppercase tracking-wider text-amber-200/60 mt-1.5">Meals</div>
                                        </div>
                                        <div className="flex-1 bg-black/25 rounded-xl p-3 text-center">
                                            <div className="text-2xl md:text-3xl font-black leading-none">{everydayCount}</div>
                                            <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mt-1.5">Everyday</div>
                                        </div>
                                        <div className="flex-1 bg-black/25 rounded-xl p-3 text-center">
                                            <div className="text-2xl md:text-3xl font-black leading-none">{todayMeals.length}</div>
                                            <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mt-1.5">Today</div>
                                        </div>
                                    </div>

                                    {todayMeals.length > 0 ? (
                                        <div className="flex-1 space-y-1">
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-amber-200/50 mb-1">{todayDayName}</div>
                                            {todayMeals.slice(0, 3).map((r: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between gap-2 py-1.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                                        <span className="text-xs font-semibold truncate">{r.recipe_name}</span>
                                                    </div>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">{r.mealType}{r.isLeftover ? ' • L' : ''}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center text-xs font-semibold text-muted-foreground">
                                            Nothing scheduled for {todayDayName} yet.
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        )}

                        {/* Shopping list */}
                        <div className={`bg-gradient-to-br from-sky-500/[0.12] via-transparent to-transparent rounded-2xl p-4 md:p-6 flex flex-col ${hasWeekPlan ? '' : 'md:col-span-2'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2.5">
                                    <IconChip className="bg-sky-500/15 text-sky-400"><FiShoppingCart size={16} /></IconChip>
                                    <h3 className="text-sm font-black tracking-tight">Shopping List</h3>
                                </div>
                                <button
                                    onClick={() => Router.push('/shoppingList')}
                                    className="text-[9px] font-bold uppercase tracking-widest text-sky-400 hover:text-sky-300 transition-colors inline-flex items-center gap-1"
                                >
                                    All <FiArrowRight size={11} />
                                </button>
                            </div>

                            {loading && !latestList ? (
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-14" />
                                    <Skeleton className="h-8" />
                                </div>
                            ) : !latestList ? (
                                <button
                                    onClick={() => Router.push('/shoppingList/create')}
                                    className="flex-1 w-full flex items-center justify-between p-4 bg-black/25 rounded-xl hover:bg-sky-500/15 transition-all text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <FiShoppingCart size={18} className="text-sky-300" />
                                        <span className="text-sm font-semibold text-muted-foreground">No active list</span>
                                    </div>
                                    <FiChevronRight size={16} className="text-muted-foreground shrink-0" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => Router.push(`/shoppingList/${latestList._id}`)}
                                    className="flex-1 w-full flex items-center justify-between gap-3 p-4 bg-black/25 rounded-xl hover:bg-sky-500/15 transition-all text-left group"
                                >
                                    <div className="min-w-0">
                                        <div className="text-[8px] font-bold uppercase tracking-widest text-sky-400 mb-1">Most Recent</div>
                                        <div className="text-lg md:text-xl font-black truncate group-hover:text-sky-300 transition-colors">{latestList.name}</div>
                                        <div className="flex items-center gap-2 mt-1.5 text-[10px] font-semibold text-muted-foreground">
                                            <span>{new Date(latestList.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                            <span>{listItemsCount != null ? `${listItemsCount} items` : '—'}</span>
                                            {latestList.cost != null && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                                    <span className="text-sky-300 font-bold">${Number(latestList.cost).toFixed(2)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <FiChevronRight size={20} className="text-muted-foreground group-hover:text-sky-300 shrink-0" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ═══ TODAY + NUTRITION ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                        {/* Today's intake */}
                        <div className="bg-gradient-to-br from-emerald-500/[0.12] via-transparent to-transparent rounded-2xl p-4 md:p-6 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <IconChip className="bg-emerald-500/15 text-emerald-400"><FiActivity size={16} /></IconChip>
                                <h3 className="text-sm font-black tracking-tight">Today's Intake</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col items-center">
                                    <div className={`text-xl md:text-2xl font-black leading-none ${dailyScore ? scoreColor : 'text-muted-foreground'}`}>{dailyScore || '--'}%</div>
                                    <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Score</div>
                                </div>
                                {/* Refresh button (currently hidden). Uncomment to re-enable.
                                <button
                                    onClick={refreshIntake}
                                    disabled={refreshing}
                                    aria-label="Recalculate Today's Intake"
                                    title="Recalculate Today's Intake"
                                    className="shrink-0 p-2 rounded-xl bg-white/[0.06] text-emerald-400 hover:bg-white/10 transition-all active:scale-95 disabled:opacity-60"
                                >
                                    <FiRefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                                </button>
                                */}
                                <button
                                    onClick={openLog}
                                    aria-label="Log Food"
                                    className="shrink-0 p-2 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
                                >
                                    <FiPlus size={16} />
                                </button>
                            </div>
                            </div>

                            {loading && !targets ? (
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-8 w-full" />
                                    <div className="grid grid-cols-4 gap-2">
                                        <Skeleton className="h-12" />
                                        <Skeleton className="h-12" />
                                        <Skeleton className="h-12" />
                                        <Skeleton className="h-12" />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="text-2xl md:text-3xl font-black leading-none mb-1">
                                        {calories.toLocaleString()}
                                        <span className="text-sm font-bold text-muted-foreground"> / {calorieTarget.toLocaleString()} kcal</span>
                                    </div>
                                    <div className="h-2 w-full bg-black/25 rounded-full overflow-hidden mt-3 mb-5">
                                        <div className={`h-full rounded-full transition-all duration-700 ${caloriePct >= 100 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${caloriePct}%` }} />
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 flex-1 items-stretch">
                                        {macroCell('protein_g')}
                                        {macroCell('carbohydrates_g')}
                                        {macroCell('fat_g')}
                                        {macroCell('fiber_g')}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Nutrition insights */}
                        <div className="bg-gradient-to-br from-violet-500/[0.12] via-transparent to-transparent rounded-2xl p-4 md:p-6 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2.5">
                                    <IconChip className="bg-violet-500/15 text-violet-300"><FiZap size={16} /></IconChip>
                                    <h3 className="text-sm font-black tracking-tight">Nutrition Insights</h3>
                                </div>
                                {deficient && recommendations.currentWeeklyPct != null && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-violet-200/60 bg-black/25 px-2.5 py-1 rounded-full">{recommendations.currentWeeklyPct}% of target</span>
                                )}
                            </div>

                            {loading && !recommendations ? (
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-2/3" />
                                    <Skeleton className="h-12" />
                                    <Skeleton className="h-12" />
                                </div>
                            ) : !deficient ? (
                                <div className="flex items-center gap-2.5 py-4 flex-1">
                                    <FiCheckCircle size={20} className="text-emerald-400 shrink-0" />
                                    <p className="text-sm font-semibold text-emerald-300">{recommendations?.message || "You're meeting all your targets!"}</p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                        Lowest nutrient: <span className="text-white font-bold capitalize">{nutrientInfo?.label || deficient}</span>. Try adding:
                                    </p>
                                    <div className="space-y-1.5 flex-1">
                                        {(recommendations.recommendations || []).slice(0, 3).map((rec: any) => {
                                            const boost = Math.round(((rec.value || 0) / (targets?.[deficient] || 1)) * 100)
                                            return (
                                                <button
                                                    key={rec.name}
                                                    onClick={() => Router.push('/ingredientResearch')}
                                                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-black/25 rounded-xl hover:bg-violet-500/15 transition-all text-left group"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold capitalize truncate">{rec.name} <span className="text-muted-foreground/60 font-medium">/100g</span></div>
                                                        <div className="text-[10px] font-bold text-violet-300">+{Math.max(boost, 1)}% {nutrientInfo?.label}</div>
                                                    </div>
                                                    <FiChevronRight size={16} className="text-muted-foreground group-hover:text-violet-300 shrink-0" />
                                                </button>
                                            )
                                        })}
                                        {(recommendations.recipeRecommendations || []).length > 0 && (
                                            <button
                                                onClick={() => Router.push(`/recipes/${recommendations.recipeRecommendations[0].id}`)}
                                                className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-black/25 rounded-xl hover:bg-violet-500/15 transition-all text-left group"
                                            >
                                                {recommendations.recipeRecommendations[0].image && <img src={recommendations.recipeRecommendations[0].image} alt={recommendations.recipeRecommendations[0].name} className="w-9 h-9 rounded-lg object-cover shrink-0" />}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold truncate group-hover:text-violet-300 transition-colors">{recommendations.recipeRecommendations[0].name}</div>
                                                    <div className="text-[10px] font-bold text-violet-300">Try this recipe</div>
                                                </div>
                                                <FiArrowRight size={16} className="text-muted-foreground group-hover:text-violet-300 shrink-0" />
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ═══ MINI SCORE TREND ═══ */}
                    <div className="bg-gradient-to-br from-teal-500/[0.10] via-transparent to-transparent rounded-2xl p-4 md:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <IconChip className="bg-teal-500/15 text-teal-300"><FiTrendingUp size={16} /></IconChip>
                                <h3 className="text-sm font-black tracking-tight">Score Trend</h3>
                            </div>
                            {loading && trendDays.length === 0 ? (
                                <Skeleton className="h-4 w-20" />
                            ) : (
                                <span className="text-[10px] font-semibold text-muted-foreground">Last 7 days · avg <span className="text-teal-300 font-black">{trendAvg}%</span></span>
                            )}
                        </div>

                        {loading && trendDays.length === 0 ? (
                            <Skeleton className="h-20 md:h-24 w-full" />
                        ) : trendDays.length === 0 ? (
                            <p className="text-xs font-semibold text-muted-foreground py-6 text-center">No tracking data yet.</p>
                        ) : (
                            <div className="flex items-end gap-1.5 h-20 md:h-24">
                                {trendDays.map((d, idx) => {
                                    const score = Math.max(d.score || 0, 0)
                                    const height = score > 0 ? Math.max(score, 5) : 3
                                    const dayLabel = new Date(`${d.date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'narrow' })
                                    return (
                                        <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                                            <div className="w-full max-w-[20px] rounded-t-lg bg-gradient-to-t from-teal-500/80 to-emerald-400/70 transition-all" style={{ height: `${height}%` }} />
                                            <span className={`text-[8px] font-bold uppercase ${idx === trendDays.length - 1 ? 'text-teal-300' : 'text-muted-foreground/60'}`}>{dayLabel}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* ═══ WEEK PLAN (empty, at bottom) ═══ */}
                    {!loading && !hasWeekPlan && (
                        <div className="bg-white/[0.02] rounded-2xl p-3 md:p-4 opacity-60">
                            <button
                                onClick={() => Router.push('/weeklyPlanner')}
                                className="w-full flex items-center justify-between gap-2 text-left"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <FiCalendar size={16} className="text-amber-300 shrink-0" />
                                    <span className="text-xs font-semibold text-muted-foreground truncate">No meals planned for this week</span>
                                </div>
                                <FiChevronRight size={16} className="text-muted-foreground shrink-0" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ QUICK LOG MODAL ═══ */}
            {isLoggingOpen && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-8">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeLog} />
                    <div className="relative w-full md:max-w-lg bg-background border-t md:border border-white/10 rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)]">
                        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur-md border-b border-white/5">
                            <div className="flex items-center gap-2.5">
                                <IconChip className="bg-emerald-500/15 text-emerald-400"><FiPlus size={16} /></IconChip>
                                <h2 className="text-sm font-black tracking-tight">Log Food</h2>
                            </div>
                            <button onClick={closeLog} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <FiX size={20} />
                            </button>
                        </div>

                        <div className="p-4">
                            {logView === 'photo' ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Photo</div>
                                        <button onClick={() => setLogView('list')} className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white shrink-0">Back</button>
                                    </div>

                                    {photoImage ? (
                                        <label className="block w-full border-2 border-dashed border-white/10 rounded-2xl overflow-hidden cursor-pointer hover:border-emerald-500/40 transition-all group relative">
                                            <input
                                                accept="image/*"
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => { if (e.target.files && e.target.files[0]) fileToBase64(e.target.files[0], setPhotoStatus).then(setPhotoImage) }}
                                            />
                                            <img src={photoImage} alt="Meal preview" className="w-full aspect-video object-cover" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm">
                                                Click to change photo
                                            </div>
                                        </label>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className="block border-2 border-dashed border-white/10 rounded-2xl p-5 text-center cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all group">
                                                <input
                                                    accept="image/*"
                                                    capture="environment"
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => { if (e.target.files && e.target.files[0]) fileToBase64(e.target.files[0], setPhotoStatus).then(setPhotoImage) }}
                                                />
                                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📸</div>
                                                <span className="text-xs font-bold block">Camera</span>
                                            </label>
                                            <label className="block border-2 border-dashed border-white/10 rounded-2xl p-5 text-center cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all group">
                                                <input
                                                    accept="image/*"
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => { if (e.target.files && e.target.files[0]) fileToBase64(e.target.files[0], setPhotoStatus).then(setPhotoImage) }}
                                                />
                                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🖼️</div>
                                                <span className="text-xs font-bold block">Gallery</span>
                                            </label>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Adaptation notes (optional)</label>
                                        <input
                                            type="text"
                                            value={photoNotes}
                                            onChange={e => setPhotoNotes(e.target.value)}
                                            placeholder="e.g. Make it vegetarian..."
                                            className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>

                                    <button
                                        onClick={handlePhotoExtract}
                                        disabled={!photoImage || photoExtracting}
                                        className="w-full py-3.5 rounded-xl bg-emerald-500 text-black text-sm font-black hover:bg-emerald-400 transition-all disabled:opacity-60 flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-500/25"
                                    >
                                        {photoExtracting ? (
                                            <>
                                                <span className="flex items-center gap-2"><FiPlus size={16} /> Analyzing photo...</span>
                                                {photoStatus && <span className="text-[10px] font-bold text-black/60 animate-pulse uppercase tracking-wider">{photoStatus}</span>}
                                            </>
                                        ) : (
                                            'Extract from Photo'
                                        )}
                                    </button>
                                </div>
                            ) : logView === 'validate' ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Confirm Ingredients</div>
                                        <button onClick={() => setLogView('photo')} className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white shrink-0">Back</button>
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Recipe Name</label>
                                        <input
                                            type="text"
                                            value={draftName}
                                            onChange={e => setDraftName(e.target.value)}
                                            placeholder="Dish name"
                                            className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Servings</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={draftServings}
                                            onChange={e => setDraftServings(Math.max(Number(e.target.value) || 1, 1))}
                                            className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>

                                    <div className="bg-white/[0.03] rounded-xl p-3">
                                        <IngredientEditor ingredients={draftIngredients} onChange={setDraftIngredients} />
                                    </div>

                                    <button
                                        onClick={handleCreateAndLog}
                                        disabled={!draftName.trim() || draftIngredients.length === 0 || isCreating}
                                        className="w-full py-3.5 rounded-xl bg-emerald-500 text-black text-sm font-black hover:bg-emerald-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
                                    >
                                        <FiPlus size={16} /> {isCreating ? 'Creating & logging...' : 'Create & Log Food'}
                                    </button>
                                    <p className="text-[10px] text-muted-foreground text-center">Saves as a hidden recipe and logs 1 serving to today's intake.</p>
                                </div>
                            ) : logSelection ? (
                                logSelection.type === 'recipe' ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">Recipe</div>
                                            <div className="text-base font-black truncate">{logSelection.label}</div>
                                        </div>
                                        <button onClick={() => setLogSelection(null)} className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white shrink-0">Change</button>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 bg-white/[0.03] rounded-xl p-4">
                                        <div>
                                            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Servings to Log</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">of {logSelection.data?.servings || 1} total</div>
                                        </div>
                                        <input
                                            type="number"
                                            min={1}
                                            value={servingsToLog}
                                            onChange={e => setServingsToLog(Math.max(Number(e.target.value) || 1, 1))}
                                            className="w-20 bg-black/30 rounded-xl px-3 py-2.5 text-center text-lg font-black outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>
                                    <button
                                        onClick={handleLogRecipe}
                                        disabled={logging}
                                        className="w-full py-3.5 rounded-xl bg-emerald-500 text-black text-sm font-black hover:bg-emerald-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
                                    >
                                        <FiPlus size={16} /> {logging ? 'Logging...' : `Log ${servingsToLog} Serving${servingsToLog !== 1 ? 's' : ''}`}
                                    </button>
                                    <p className="text-[10px] text-muted-foreground text-center">Expands into constituent ingredients for accuracy.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">Ingredient</div>
                                            <div className="text-base font-black capitalize truncate">{logSelection.label}</div>
                                        </div>
                                        <button onClick={() => setLogSelection(null)} className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white shrink-0">Change</button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            value={ingredientQty}
                                            onChange={e => setIngredientQty(Math.max(Number(e.target.value) || 0, 0))}
                                            className="flex-1 bg-white/[0.04] rounded-xl px-4 py-3 text-lg font-black outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                        <select
                                            value={ingredientUnit}
                                            onChange={e => setIngredientUnit(e.target.value)}
                                            className="bg-white/[0.04] rounded-xl px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        >
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleLogIngredient}
                                        disabled={logging}
                                        className="w-full py-3.5 rounded-xl bg-emerald-500 text-black text-sm font-black hover:bg-emerald-400 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
                                    >
                                        <FiPlus size={16} /> {logging ? 'Logging...' : `Log ${ingredientQty} ${ingredientUnit}`}
                                    </button>
                                    <p className="text-[10px] text-muted-foreground text-center">Logs nutrients for this food against today's intake.</p>
                                </div>
                            )
                            ) : (
                                <div className="space-y-4">
                                    <button
                                        onClick={() => setLogView('photo')}
                                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.04] hover:bg-emerald-500/10 transition-all text-left border border-dashed border-white/10"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center text-base shrink-0">📷</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold">Take a photo or add from gallery</div>
                                            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">AI identifies the dish & ingredients</div>
                                        </div>
                                        <FiChevronRight size={16} className="text-muted-foreground shrink-0" />
                                    </button>

                                    <div className="relative">
                                        <FiSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            autoFocus
                                            type="text"
                                            value={logSearch}
                                            onChange={e => setLogSearch(e.target.value)}
                                            placeholder="Search recipes or ingredients..."
                                            className="w-full bg-white/[0.04] rounded-xl pl-10 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>

                                    {filteredLog.length > 0 ? (
                                        <div className="space-y-1">
                                            {filteredLog.map(opt => (
                                                <button
                                                    key={`${opt.type}-${opt.value}`}
                                                    onClick={() => setLogSelection(opt)}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-emerald-500/10 transition-all text-left"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center text-base shrink-0">
                                                        {opt.type === 'recipe' ? (opt.data?.image ? <img src={opt.data.image} alt="" className="w-8 h-8 rounded-lg object-cover" /> : '🍲') : (opt.emoji || '🥗')}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold truncate">{opt.label}</div>
                                                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{opt.type === 'recipe' ? `Recipe • Serves ${opt.data?.servings || 1}` : 'Ingredient'}</div>
                                                    </div>
                                                    <FiChevronRight size={16} className="text-muted-foreground shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center text-xs font-semibold text-muted-foreground py-8">No matches for "{logSearch}".</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
