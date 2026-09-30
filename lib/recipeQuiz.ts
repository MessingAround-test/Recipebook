export type QuizTime = 'short' | 'medium' | 'long'
export type QuizPrice = 'cheap' | 'medium' | 'expensive'
export type QuizNovelty = 'new' | 'classic'

export interface TimeRange {
    min: number
    max: number
}

export const TIME_MAX_MINUTES = 120

export interface QuizRecipe {
    _id: string
    name: string
    image?: string
    time?: string | null
    priceCategory?: string | null
    mealTypes?: string[] | null
    carbType?: string | null
    timesCooked?: number | null
    servings?: number | null
    genre?: string
    hidden?: boolean
    created_at?: string | null
    instructions?: { time?: number | null }[] | null
    prepWork?: { timeEstimate?: number | null }[] | null
}

export interface QuizAnswers {
    mealType: string | null
    people: number | null
    time: TimeRange | null
    novelty: QuizNovelty | null
    price: QuizPrice | null
    // Planner day-quiz extensions
    carbType: string | null
    // 'outlook' = rank matches by how much they lift the day's low nutrients
    priority: 'outlook' | 'none' | null
}

export const DEFAULT_ANSWERS: QuizAnswers = {
    mealType: null,
    people: null,
    time: null,
    novelty: null,
    price: null,
    carbType: null,
    priority: null
}

export const QUIZ_MEAL_OPTIONS = ['Breakfast', 'Lunch', 'Main', 'Entree', 'Dessert', 'Snack']
export const QUIZ_PRICE_OPTIONS: QuizPrice[] = ['cheap', 'medium', 'expensive']
export const QUIZ_NOVELTY_OPTIONS: QuizNovelty[] = ['new', 'classic']
export const CLASSIC_THRESHOLD = 3

// Carb choices for the planner's day quiz. Mirrors Recipe.carbType's enum.
export const QUIZ_CARB_OPTIONS = ['Rice', 'Bread/Wraps', 'Pasta/Noodles', 'Potato', 'Quinoa', 'None/Other']

// Map a planner meal slot to recipe mealTypes the same way the Browse modal
// does: primary mealType, 'Main' → 'Dinner'. Recipes with no mealTypes (or a
// 'General' primary) are wildcards that fit any slot.
function normalizeMealTypeSlot(mt: string): string {
    return /^main$/i.test(mt) ? 'Dinner' : mt
}

export function recipeMatchesPlannerSlot(recipe: { mealTypes?: string[] | null }, slot: string | null): boolean {
    if (!slot) return true
    const meals = recipe?.mealTypes
    if (!Array.isArray(meals) || meals.length === 0) return true
    const primary = normalizeMealTypeSlot(String(meals[0]))
    if (primary === 'General') return true
    return primary === slot
}

export const TIME_BUCKET_RANGES: Record<QuizTime, TimeRange> = {
    short: { min: 0, max: 30 },
    medium: { min: 30, max: 60 },
    long: { min: 60, max: TIME_MAX_MINUTES }
}

export const TIME_QUICK_OPTIONS: { label: string; range: TimeRange }[] = [
    { label: 'Under 15 min', range: { min: 0, max: 15 } },
    { label: 'Under 30 min', range: { min: 0, max: 30 } },
    { label: '30\u201360 min', range: { min: 30, max: 60 } },
    { label: '1 hr +', range: { min: 60, max: TIME_MAX_MINUTES } }
]

export function isFullTimeRange(range: TimeRange): boolean {
    return range.min <= 0 && range.max >= TIME_MAX_MINUTES
}

export function formatTimeRange(range: TimeRange): string {
    const { min, max } = range
    if (isFullTimeRange(range)) return 'Any length'
    if (min <= 0) return max % 60 === 0 ? `Up to ${max / 60} hr` : `Under ${max} min`
    if (max >= TIME_MAX_MINUTES) return min % 60 === 0 ? `${min / 60} hr +` : `${min}+ min`
    return `${min}\u2013${max} min`
}

export function estimateRecipeMinutes(recipe: QuizRecipe): number | null {
    let total = 0
    let found = false
    if (Array.isArray(recipe.instructions)) {
        for (const step of recipe.instructions) {
            if (step && typeof step.time === 'number' && step.time > 0) {
                total += step.time
                found = true
            }
        }
    }
    if (Array.isArray(recipe.prepWork)) {
        for (const item of recipe.prepWork) {
            if (item && typeof item.timeEstimate === 'number' && item.timeEstimate > 0) {
                total += item.timeEstimate
                found = true
            }
        }
    }
    return found ? Math.round(total) : null
}

export function answerCount(answers: QuizAnswers): number {
    return (answers.mealType ? 1 : 0) +
        (answers.people ? 1 : 0) +
        (answers.time ? 1 : 0) +
        (answers.novelty ? 1 : 0) +
        (answers.price ? 1 : 0) +
        (answers.carbType ? 1 : 0)
}

export function filterRecipes(recipes: QuizRecipe[], answers: QuizAnswers): QuizRecipe[] {
    return recipes.filter(recipe => {
        if (recipe.hidden) return false

        if (answers.mealType) {
            const meals = recipe.mealTypes
            if (Array.isArray(meals) && meals.length > 0 && !meals.includes(answers.mealType)) return false
        }

        if (answers.time) {
            const { min, max } = answers.time
            const capped = max < TIME_MAX_MINUTES
            const estimate = estimateRecipeMinutes(recipe)
            if (estimate !== null) {
                if (estimate < min || (capped && estimate > max)) return false
            } else {
                const bucket = TIME_BUCKET_RANGES[recipe.time as QuizTime]
                if (bucket && (bucket.max <= min || (capped && bucket.min >= max))) return false
            }
        }

        if (answers.novelty === 'new') {
            if ((recipe.timesCooked || 0) > 0) return false
        }
        if (answers.novelty === 'classic') {
            if ((recipe.timesCooked || 0) < CLASSIC_THRESHOLD) return false
        }

        if (answers.price) {
            const price = recipe.priceCategory
            if (price && price !== answers.price) return false
        }

        // Carb choice: recipes with an explicit carbType must match it.
        // Recipes with no carbType (or Uncategorized) stay as a wildcard.
        if (answers.carbType) {
            const carb = recipe.carbType
            if (carb && carb !== 'Uncategorized' && carb !== answers.carbType) return false
        }

        return true
    })
}

/**
 * Histogram of the week's planned carb types (excluding leftover blocks —
 * those are already-cooked servings of the same recipe). Used to annotate
 * the carb-choice step with variety info.
 */
export function weekCarbCounts(plannedItems: { carbType?: string | null; isLeftover?: boolean }[]): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const item of plannedItems || []) {
        if (!item || item.isLeftover) continue
        const carb = item.carbType || 'Uncategorized'
        counts[carb] = (counts[carb] || 0) + 1
    }
    return counts
}

export function sortMatches(matches: QuizRecipe[], novelty: QuizNovelty | null): QuizRecipe[] {
    if (novelty === 'classic') {
        return [...matches].sort((a, b) => (b.timesCooked || 0) - (a.timesCooked || 0))
    }
    if (novelty === 'new') {
        return [...matches].sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
            return bTime - aTime
        })
    }
    return [...matches]
}

export function getScaleNote(people: number | null, servings: number | null): string | null {
    if (!people && !servings) return null
    if (!people) return `Serves ${servings}`
    if (!servings) return `For ${people}`
    if (servings >= people) return `Serves ${servings}`
    const scale = Math.round((people / servings) * 10) / 10
    return `Scale \u00d7${scale} to feed ${people}`
}

export function shuffleMatches<T>(items: T[]): T[] {
    const arr = [...items]
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
    }
    return arr
}
