// Time-of-day meal suggestion for the dashboard. Pure functions so the
// selection rules stay unit-testable (tests/mealSuggestion.test.js).

export type MealSlot = 'Breakfast' | 'Lunch' | 'Snack' | 'Main'

export interface SuggestableRecipe {
    _id?: string
    name?: string
    hidden?: boolean
    rating?: number
    timesCooked?: number
    mealTypes?: string[] | null
    genre?: string | null
}

// Minutes-from-midnight windows. Rolls over to Breakfast outside 05:00-22:00
// so a late-night visit already ponders tomorrow's breakfast.
const SLOT_WINDOWS: { slot: MealSlot; start: number; end: number }[] = [
    { slot: 'Breakfast', start: 5 * 60, end: 10 * 60 + 30 }, // 05:00-10:30
    { slot: 'Lunch', start: 10 * 60 + 30, end: 14 * 60 },    // 10:30-14:00
    { slot: 'Snack', start: 14 * 60, end: 16 * 60 + 30 },    // 14:00-16:30 (covers 3pm)
    { slot: 'Main', start: 16 * 60 + 30, end: 22 * 60 },     // 16:30-22:00
]

export const SLOT_LABELS: Record<MealSlot, string> = {
    Breakfast: 'Breakfast',
    Lunch: 'Lunch',
    Snack: 'Afternoon snack',
    Main: 'Dinner',
}

export const SLOT_EMOJI: Record<MealSlot, string> = {
    Breakfast: '🍳',
    Lunch: '🥗',
    Snack: '🍎',
    Main: '🍽️',
}

export function getMealSlot(now: Date = new Date()): MealSlot {
    const mins = now.getHours() * 60 + now.getMinutes()
    for (const w of SLOT_WINDOWS) {
        if (mins >= w.start && mins < w.end) return w.slot
    }
    return 'Breakfast'
}

// Day order for slot comparisons (planner "Dinner" maps onto "Main").
export const SLOT_ORDER: MealSlot[] = ['Breakfast', 'Lunch', 'Snack', 'Main']

/** Planner meal types (Breakfast/Lunch/Snack/Dinner) → our slot names. */
export function normalizeMealType(type: string | null | undefined): MealSlot | null {
    const t = String(type || '').trim().toLowerCase()
    if (t === 'dinner' || t === 'main' || t === 'entree') return 'Main'
    const match = SLOT_ORDER.find(s => s.toLowerCase() === t)
    return match || null
}

/**
 * Which slot the dashboard's "XXX idea" card should pitch for: start at the
 * current time slot and take the first slot that has no meal planned today
 * (wrapping once past midnight), so we never suggest what's already on the
 * plan. When every slot is planned, fall back to Snack.
 */
export function selectIdeaSlot(now: Date, plannedMealTypes: (string | null | undefined)[]): MealSlot {
    const planned = new Set(
        plannedMealTypes.map(normalizeMealType).filter((s): s is MealSlot => s !== null)
    )
    const start = SLOT_ORDER.indexOf(getMealSlot(now))
    for (let i = 0; i < SLOT_ORDER.length; i++) {
        const slot = SLOT_ORDER[(start + i) % SLOT_ORDER.length]
        if (!planned.has(slot)) return slot
    }
    return 'Snack'
}

/**
 * True only when the idea's slot lands strictly after every planned meal
 * (the idea fills the tail of the day); before/among planned meals → false.
 * Used to decide whether the idea card sits left or right of Today's Meals.
 */
export function ideaIsAfterAllPlanned(
    ideaSlot: MealSlot,
    plannedMealTypes: (string | null | undefined)[]
): boolean {
    const orders = plannedMealTypes
        .map(normalizeMealType)
        .filter((s): s is MealSlot => s !== null)
        .map(s => SLOT_ORDER.indexOf(s))
    if (orders.length === 0) return false
    return SLOT_ORDER.indexOf(ideaSlot) > Math.max(...orders)
}

function matchesSlot(recipe: SuggestableRecipe, slot: MealSlot): boolean {
    const types = (recipe.mealTypes || []).map(m => String(m || '').trim().toLowerCase())
    const genre = String(recipe.genre || '').toLowerCase()
    switch (slot) {
        case 'Breakfast':
            return types.some(t => t.includes('breakfast'))
        case 'Lunch':
            return types.some(t => t.includes('lunch'))
        case 'Snack':
            // Mirrors the planner: snackiness can come from genre too.
            return types.some(t => t.includes('snack')) || genre.includes('snack')
        case 'Main':
            // Generated recipes use Main/Entree; older data may say Dinner.
            return types.some(t => ['main', 'entree', 'dinner'].some(k => t.includes(k)))
    }
}

function sortCandidates(list: SuggestableRecipe[]): SuggestableRecipe[] {
    return [...list].sort((a, b) => {
        const ratingDiff = (b.rating || 0) - (a.rating || 0)
        if (ratingDiff !== 0) return ratingDiff
        const cookedDiff = (b.timesCooked || 0) - (a.timesCooked || 0)
        if (cookedDiff !== 0) return cookedDiff
        return String(a.name || '').localeCompare(String(b.name || ''))
    })
}

/**
 * Recipes to suggest for the slot, best first. Hidden recipes are dropped;
 * when nothing matches the slot we relax to every visible recipe so the card
 * always has something to show while the user still has recipes at all.
 */
export function selectSuggestedMeals<T extends SuggestableRecipe>(recipes: T[], slot: MealSlot): T[] {
    const visible = (recipes || []).filter(r => !r.hidden)
    const matches = visible.filter(r => matchesSlot(r, slot))
    return sortCandidates(matches.length ? matches : visible) as T[]
}
