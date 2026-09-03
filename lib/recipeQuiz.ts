export type QuizTime = 'short' | 'medium' | 'long'
export type QuizPrice = 'cheap' | 'medium' | 'expensive'
export type QuizNovelty = 'new' | 'classic'

export interface QuizRecipe {
    _id: string
    name: string
    image?: string
    time?: string | null
    priceCategory?: string | null
    mealTypes?: string[] | null
    timesCooked?: number | null
    servings?: number | null
    genre?: string
    hidden?: boolean
    created_at?: string | null
}

export interface QuizAnswers {
    mealType: string | null
    people: number | null
    time: QuizTime | null
    novelty: QuizNovelty | null
    price: QuizPrice | null
}

export const DEFAULT_ANSWERS: QuizAnswers = {
    mealType: null,
    people: null,
    time: null,
    novelty: null,
    price: null
}

export const QUIZ_MEAL_OPTIONS = ['Breakfast', 'Lunch', 'Main', 'Entree', 'Dessert', 'Snack']
export const QUIZ_TIME_OPTIONS: QuizTime[] = ['short', 'medium', 'long']
export const QUIZ_PRICE_OPTIONS: QuizPrice[] = ['cheap', 'medium', 'expensive']
export const QUIZ_NOVELTY_OPTIONS: QuizNovelty[] = ['new', 'classic']
export const CLASSIC_THRESHOLD = 3

export function answerCount(answers: QuizAnswers): number {
    return (answers.mealType ? 1 : 0) +
        (answers.people ? 1 : 0) +
        (answers.time ? 1 : 0) +
        (answers.novelty ? 1 : 0) +
        (answers.price ? 1 : 0)
}

export function filterRecipes(recipes: QuizRecipe[], answers: QuizAnswers): QuizRecipe[] {
    return recipes.filter(recipe => {
        if (recipe.hidden) return false

        if (answers.mealType) {
            const meals = recipe.mealTypes
            if (Array.isArray(meals) && meals.length > 0 && !meals.includes(answers.mealType)) return false
        }

        if (answers.time) {
            const time = recipe.time
            if (time && time !== answers.time) return false
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

        return true
    })
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
