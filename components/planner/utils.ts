import { PlannedRecipeItem, Recipe } from './types';

export function makeKey(r: PlannedRecipeItem): string {
    return r?.id || r?._id || '';
}

export function newTempId(): string {
    return Math.random().toString(36).substr(2, 9);
}

export function isSnackRecipe(r: Recipe): boolean {
    return (r.mealTypes || []).some(m => /snack/i.test(m)) || /snack/i.test(r.genre || '');
}

export function normalizeMealType(mt: string): string {
    return /^main$/i.test(mt) ? 'Dinner' : mt;
}

export const MEAL_SHORT: Record<string, string> = {
    Breakfast: 'Brekkie',
    Lunch: 'Lunch',
    Dinner: 'Dinner',
    Snack: 'Snack'
};

export const MEAL_COLORS: Record<string, string> = {
    Breakfast: 'text-amber-300',
    Lunch: 'text-emerald-300',
    Dinner: 'text-blue-300',
    Snack: 'text-purple-300'
};

// Carb groups: None/Other sits above Uncategorized at the bottom
export function carbSortPriority(k: string): number {
    return k === 'None/Other' ? 1 : (k === 'Uncategorized' ? 2 : 0);
}

export function sortCarbKeys(a: string, b: string): number {
    const pa = carbSortPriority(a), pb = carbSortPriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
}
