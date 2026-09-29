import { useState, useEffect, useMemo, useCallback } from 'react'
import Router from 'next/router'
import { Layout } from '../components/Layout'
import { useAuthGuard } from '../lib/useAuthGuard'
import { useUser } from '../lib/UserContext'
import { calculateHealthScore, DEFAULT_HEALTH_SCORE_CONFIG, HealthScoreConfig } from '../lib/healthScore'
import { FiShoppingCart, FiCalendar, FiPlus, FiChevronRight, FiCompass, FiSearch, FiX, FiSettings, FiGrid } from 'react-icons/fi'
import IngredientEditor from '../components/IngredientEditor'
import { fileToBase64 } from '../lib/recipeImage'
import { extractRecipeFromImage, saveRecipe, Ingredient } from '../lib/recipeExtraction'
import { useDailyTasks, TASK_SYMPTOM_NAMES } from '../lib/dailyTasks'
import DailyTasksCard from '../components/DailyTasksCard'
import { getDailySuggestionFromCoverage } from '../lib/dailySuggestions'
import TodayNutritionModal from '../components/TodayNutritionModal'
import PlanDayCoverageModal from '../components/PlanDayCoverageModal'
import RoundOutModal from '../components/RoundOutModal'
import DashboardCard from '../components/dashboard/DashboardCard'
import ListRow from '../components/dashboard/ListRow'
import TodaySummary from '../components/dashboard/TodaySummary'
import dashStyles from '../styles/Dashboard.module.css'

const MEAL_EMOJI: Record<string, string> = { Breakfast: '🍳', Lunch: '🥗', Snack: '🍎', Dinner: '🍽️' }

const getLocalDateString = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const UNITS = ['gram', 'each', 'kg', 'ml', 'cup', 'tbsp', 'tsp']

// Default occurrence times (minutes from midnight) used to order "closest to happening".
const MEAL_TIMES: Record<string, number> = { Breakfast: 480, Lunch: 750, Snack: 930, Dinner: 1080 }
// Latest time (minutes from midnight) a meal still shows; meals without an entry never hide.
const MEAL_HIDE_AFTER: Record<string, number> = { Breakfast: 660, Lunch: 900, Dinner: 1320 }

const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse bg-white/[0.04] rounded-xl ${className}`} />
)

const IconChip = ({ className = '', children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) =>
    onClick ? (
        <button
            type="button"
            onClick={onClick}
            aria-label="Show details"
            title="Show details"
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all hover:brightness-125 active:scale-90 ${className}`}
        >
            {children}
        </button>
    ) : (
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${className}`}>{children}</div>
    )

export default function Dashboard() {
    const isAuthed = useAuthGuard()
    const { features, ready } = useUser()

    const [loading, setLoading] = useState(true)
    const [targets, setTargets] = useState<any>(null)
    const [healthScoreConfig, setHealthScoreConfig] = useState<HealthScoreConfig>(DEFAULT_HEALTH_SCORE_CONFIG)
    const [todayLog, setTodayLog] = useState<any>(null)
    const [weekPlan, setWeekPlan] = useState<any>(null)
    const [planCoverage, setPlanCoverage] = useState<any>(null)
    const [shoppingLists, setShoppingLists] = useState<any[]>([])
    const [listItemsCount, setListItemsCount] = useState<number | null>(null)
    const [lastDishList, setLastDishList] = useState<{ _id: string; name: string; counts?: any } | null>(null)
    const [recipes, setRecipes] = useState<any[]>([])
    const [knownIngredients, setKnownIngredients] = useState<string[]>([])
    const [symptomLog, setSymptomLog] = useState<any>(null)

    // Quick-log state
    const [showNutrition, setShowNutrition] = useState(false)
    const [showPlanCoverage, setShowPlanCoverage] = useState(false)
    const [showRoundOut, setShowRoundOut] = useState(false)
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
        const f = features

        try {
            // Only load what the enabled features actually need. The health
            // summary needs dailyIntake/log/symptom data; the daily-tasks widget
            // needs the log + symptom data too, so those are shared.
            const needHealth = f.healthTracker
            const needTasks = f.dailyTasks
            const jobs: Record<string, Promise<any>> = {
                ingredients: fetch('/api/Ingredients/defaults', { headers: { edgetoken: token } }).then(r => r.json()),
            }
            if (needHealth) jobs.target = fetch('/api/dailyIntake', { headers: { edgetoken: token } }).then(r => r.json())
            if (needHealth || needTasks) {
                jobs.log = fetch(`/api/dailyLog?date=${today}`, { headers: { edgetoken: token } }).then(r => r.json())
                jobs.symptoms = fetch(`/api/symptomLog?date=${today}`, { headers: { edgetoken: token } }).then(r => r.json())
            }
            if (f.weeklyPlanner) jobs.plan = fetch(`/api/weeklyPlan?startDate=${today}`, { headers: { edgetoken: token } }).then(r => r.json())
            if (f.shoppingList) jobs.list = fetch('/api/ShoppingList', { headers: { edgetoken: token } }).then(r => r.json())
            if (f.worldList) jobs.dish = fetch('/api/dishLists', { headers: { edgetoken: token } }).then(r => r.json())
            if (f.recipes) jobs.recipe = fetch('/api/Recipe', { headers: { edgetoken: token } }).then(r => r.json())

            const results: Record<string, any> = {}
            await Promise.all(Object.entries(jobs).map(async ([key, promise]) => {
                try { results[key] = await promise } catch { /* ignore individual failures */ }
            }))

            if (results.target?.success) {
                setTargets(results.target.targets)
                if (results.target.healthScoreConfig) {
                    setHealthScoreConfig(results.target.healthScoreConfig)
                }
            }
            if (results.log?.success) {
                setTodayLog(results.log.log)
            }
            if (results.plan?.success && results.plan.plan) {
                setWeekPlan(results.plan.plan)
                // Estimated intake for today if we ate everything planned (the
                // same data the "(i)" modal shows). Feeds the plan-card advice.
                fetch('/api/weeklyPlan/dayCoverage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', edgetoken: token },
                    body: JSON.stringify({ plan: results.plan.plan, day: today })
                })
                    .then(r => r.json())
                    .then(d => { if (d.success) setPlanCoverage(d) })
                    .catch(() => {})
            }
            if (results.list) {
                const lists = (results.list.res || []).filter((l: any) => l.complete !== true)
                lists.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                setShoppingLists(lists)
            }
            if (f.worldList && typeof window !== 'undefined') {
                try {
                    const stored = localStorage.getItem('lastDishList')
                    const parsed = stored ? JSON.parse(stored) : null
                    if (parsed?.id) {
                        const summaries = results.dish?.data || []
                        const match = summaries.find((l: any) => String(l._id) === String(parsed.id))
                        setLastDishList(match
                            ? { _id: String(match._id), name: match.name, counts: match.counts }
                            : { _id: String(parsed.id), name: parsed.name || 'Dish list' })
                    } else {
                        setLastDishList(null)
                    }
                } catch {
                    setLastDishList(null)
                }
            }
            if (results.recipe?.res) {
                setRecipes(results.recipe.res)
            }
            if (results.ingredients?.success) {
                setKnownIngredients(results.ingredients.data || [])
            }
            if (results.symptoms?.success) {
                setSymptomLog(results.symptoms.log)
            }
        } finally {
            setLoading(false)
        }
    }, [features])

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
        if (isAuthed && ready) loadData()
    }, [isAuthed, ready, loadData])

    const latestList = shoppingLists[0] || null

    const { tasks: dailyTasks, allDone: allTasksDone, toggle: toggleDailyTask } = useDailyTasks(
        getLocalDateString(new Date()),
        todayLog,
        symptomLog
    )

    // Sync completed daily tasks into the symptom log for historical tracking.
    const doneTaskSymptoms = useMemo(() => {
        return dailyTasks
            .filter(t => t.done && t.symptomName)
            .map(t => t.symptomName!)
            .sort()
            .join('|')
    }, [dailyTasks])

    useEffect(() => {
        if (!features.dailyTasks) return
        if (typeof window === 'undefined') return
        if (!symptomLog || !symptomLog.symptoms) return
        const token = localStorage.getItem('Token')
        if (!token) return

        const date = getLocalDateString(new Date())
        const current = symptomLog.symptoms || []
        const taskNames = new Set(TASK_SYMPTOM_NAMES.map(n => n.toLowerCase()))
        const desired = dailyTasks.filter(t => t.done && t.symptomName).map(t => t.symptomName!)

        // Skip when already in sync to avoid needless writes / loops
        const currentAuto = current.filter((s: any) => s.auto).map((s: any) => String(s.name || '').toLowerCase())
        const desiredLower = desired.map(n => n.toLowerCase())
        const synced =
            currentAuto.length === desiredLower.length &&
            desiredLower.every(n => currentAuto.includes(n))
        if (synced) return

        const kept = current
            .filter((s: any) => !s.auto && !taskNames.has(String(s.name || '').toLowerCase()))
            .map((s: any) => ({ name: s.name }))
        const merged = [
            ...kept,
            ...desired.map(name => ({ name, auto: true }))
        ]

        fetch('/api/symptomLog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'edgetoken': token },
            body: JSON.stringify({ date, mood: symptomLog.mood || null, symptoms: merged, notes: symptomLog.notes || '' })
        })
            .then(r => r.json())
            .then(data => { if (data.success) setSymptomLog(data.log) })
            .catch(() => {})
    }, [doneTaskSymptoms, symptomLog, features.dailyTasks])

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
        return calculateHealthScore(totals, targets, healthScoreConfig)
    }, [targets, todayLog, totals, healthScoreConfig])

    const planSuggestion = useMemo(() => getDailySuggestionFromCoverage(planCoverage?.dayCoverage), [planCoverage])

    const calories = Math.round(totals.energy_kcal || 0)
    const calorieTarget = targets?.energy_kcal || 0
    const caloriePct = calorieTarget > 0 ? Math.min((calories / calorieTarget) * 100, 100) : 0

    const scoreColor = dailyScore > 80 ? 'text-emerald-400' : dailyScore > 50 ? 'text-amber-400' : 'text-rose-400'

    const todayMealsAll = weekPlan?.plannedRecipes?.filter((r: any) => r.day === getLocalDateString(new Date())) || []
    const todayMeals = useMemo(() => {
        const now = new Date()
        const mins = now.getHours() * 60 + now.getMinutes()
        return todayMealsAll
            .filter((r: any) => MEAL_HIDE_AFTER[r.mealType] == null || mins < MEAL_HIDE_AFTER[r.mealType])
            .sort((a: any, b: any) => (MEAL_TIMES[a.mealType] ?? 0) - (MEAL_TIMES[b.mealType] ?? 0))
    }, [todayMealsAll])

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

    const handleTaskGo = useCallback((action: string) => {
        if (action === 'symptoms' || action === 'exercise') {
            // This widget can be on while the tracker page is off; don't link there.
            if (!features.healthTracker) return
            Router.push(action === 'symptoms' ? '/dailyTracker?view=symptoms' : '/dailyTracker?view=stats')
        } else if (action === 'quicklog') openLog()
    }, [features.healthTracker])

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

    // ── Dashboard cards ──
    const hasTodayData = ((todayLog?.items || []).length > 0) || dailyTasks.some(t => t.done)

    const mealsCard = (
        <DashboardCard
            title="Today's Meals"
            icon={<FiCalendar size={16} />}
            accent="orange"
            onIconClick={() => setShowPlanCoverage(true)}
            iconTitle="Estimated day coverage"
            action={{ label: 'Plan', onClick: () => Router.push('/weeklyPlanner') }}
            bodyClassName="gap-2"
        >
            <p className="mb-1 border-l-2 border-orange-400/50 pl-3 text-sm font-semibold leading-snug text-white/95">
                {planSuggestion ? planSuggestion.message : 'Balanced day, enjoy.'}
            </p>
            <div className="space-y-0.5">
                {todayMeals.slice(0, 4).map((r: any, idx: number) => (
                    <ListRow
                        key={idx}
                        leading={MEAL_EMOJI[r.mealType] || '🍽️'}
                        title={r.recipe_name}
                        subtitle={r.isLeftover ? 'Leftover' : undefined}
                        trailing={<span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{r.mealType}</span>}
                        onClick={r.recipe_id ? () => Router.push(`/recipes/${r.recipe_id}`) : undefined}
                    />
                ))}
            </div>
        </DashboardCard>
    )

    const dailyTasksCard = allTasksDone ? (
        <DailyTasksCard tasks={dailyTasks} allDone={allTasksDone} toggle={toggleDailyTask} compact onGo={handleTaskGo} />
    ) : (
        <DailyTasksCard tasks={dailyTasks} allDone={allTasksDone} toggle={toggleDailyTask} onGo={handleTaskGo} />
    )

    const lastDishTotal = lastDishList?.counts?.total || 0
    const lastDishCooked = lastDishList?.counts?.cooked || 0
    const lastDishPct = lastDishTotal > 0 ? Math.round((lastDishCooked / lastDishTotal) * 100) : 0

    const dishListCard = (
        <DashboardCard
            title="Explore"
            icon={<FiCompass size={16} />}
            accent="amber"
            action={{ label: 'All', onClick: () => Router.push('/dishLists') }}
        >
            {!lastDishList ? (
                <button
                    type="button"
                    onClick={() => Router.push('/dishLists')}
                    className="mt-1 flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.05]"
                >
                    <span className="flex min-w-0 items-center gap-2.5">
                        <FiCompass size={17} className="shrink-0 text-amber-300" />
                        <span className="truncate text-sm font-semibold text-muted-foreground">Explore the world's best dishes</span>
                    </span>
                    <FiChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => Router.push(`/dishLists/${lastDishList._id}`)}
                    className="mt-1 flex w-full flex-col gap-3 rounded-xl bg-black/20 p-4 text-left transition-colors hover:bg-amber-500/10"
                >
                    <div className="w-full min-w-0">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-400">Last Viewed</div>
                        <div className="truncate text-lg font-black transition-colors md:text-xl">{lastDishList.name}</div>
                        {lastDishList.counts && (
                            <div className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                                <span>{lastDishCooked}/{lastDishTotal} cooked</span>
                                <span className="h-1 w-1 rounded-full bg-white/20" />
                                <span className="font-bold text-amber-300">{lastDishPct}%</span>
                            </div>
                        )}
                    </div>
                    <div className="flex w-full items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${lastDishPct}%` }} />
                        </div>
                        <FiChevronRight size={18} className="shrink-0 text-muted-foreground" />
                    </div>
                </button>
            )}
        </DashboardCard>
    )

    const shoppingCard = (
        <DashboardCard
            title="Shopping List"
            icon={<FiShoppingCart size={16} />}
            accent="sky"
            action={{ label: 'All', onClick: () => Router.push('/shoppingList') }}
        >
            {loading && !latestList ? (
                <div className="space-y-2">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-8" />
                </div>
            ) : !latestList ? (
                <button
                    type="button"
                    onClick={() => Router.push('/shoppingList/create')}
                    className="mt-1 flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.05]"
                >
                    <span className="flex min-w-0 items-center gap-2.5">
                        <FiShoppingCart size={17} className="shrink-0 text-sky-300" />
                        <span className="truncate text-sm font-semibold text-muted-foreground">No active list</span>
                    </span>
                    <FiChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </button>
            ) : (
                <ListRow
                    leading={<FiShoppingCart size={16} className="text-sky-300" />}
                    title={latestList.name}
                    meta={
                        <>
                            <span>{new Date(latestList.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                            <span className="h-1 w-1 rounded-full bg-white/20" />
                            <span>{listItemsCount != null ? `${listItemsCount} items` : '—'}</span>
                            {latestList.cost != null && (
                                <>
                                    <span className="h-1 w-1 rounded-full bg-white/20" />
                                    <span className="font-bold text-sky-300">${Number(latestList.cost).toFixed(2)}</span>
                                </>
                            )}
                        </>
                    }
                    onClick={() => Router.push(`/shoppingList/${latestList._id}`)}
                />
            )}
        </DashboardCard>
    )

    return (
        <Layout title="Dashboard" description="Your health, plans and lists at a glance">
            <div className={dashStyles.shell}>
                <TodaySummary
                    dateLabel={new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                    loading={loading}
                    hasData={hasTodayData}
                    score={dailyScore}
                    scoreColor={scoreColor}
                    calories={calories}
                    calorieTarget={calorieTarget}
                    caloriePct={caloriePct}
                    totals={totals}
                    targets={targets}
                    onLog={openLog}
                    onRoundOut={() => setShowRoundOut(true)}
                    onShowNutrition={() => setShowNutrition(true)}
                    showMetrics={features.healthTracker}
                    headerExtra={
                        <div className="flex items-center gap-2 sm:hidden">
                            <button
                                type="button"
                                onClick={() => Router.push('/tools')}
                                aria-label="Tools"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-muted-foreground transition-all hover:text-white active:scale-90"
                            >
                                <FiGrid size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => Router.push('/profile')}
                                aria-label="Profile"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-muted-foreground transition-all hover:text-white active:scale-90"
                            >
                                <FiSettings size={16} />
                            </button>
                        </div>
                    }
                />

                <div className={dashStyles.columns}>
                    <div className={dashStyles.mainCol}>
                        {features.weeklyPlanner && todayMealsAll.length > 0 && mealsCard}
                        {features.dailyTasks && dailyTasksCard}
                    </div>
                    <div className={dashStyles.sideCol}>
                        {features.shoppingList && shoppingCard}
                        {features.worldList && dishListCard}
                    </div>
                </div>
            </div>

            {/* ═══ QUICK LOG MODAL ═══ */}
            {isLoggingOpen && (
                <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center md:p-8">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeLog} />
                    <div className="relative w-full md:max-w-lg bg-background border-b md:border border-white/10 rounded-b-2xl md:rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)]">
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

            <TodayNutritionModal
                open={showNutrition}
                onClose={() => setShowNutrition(false)}
                totals={totals}
                targets={targets}
            />
            <PlanDayCoverageModal
                open={showPlanCoverage}
                onClose={() => setShowPlanCoverage(false)}
                plan={weekPlan}
                day={getLocalDateString(new Date())}
                initialData={planCoverage}
            />
            <RoundOutModal
                open={showRoundOut}
                onClose={() => setShowRoundOut(false)}
                date={getLocalDateString(new Date())}
                onLogged={refreshIntake}
            />
        </Layout>
    )
}
