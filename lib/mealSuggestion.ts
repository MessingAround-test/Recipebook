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
