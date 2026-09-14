// Dietary/key criteria that can be layered onto a dish-list recipe search.
// Values intentionally mirror User.dietary_preference / dietary_restrictions
// so a user's profile settings can be reused verbatim.

import { buildDietaryConstraints } from '../dietaryRules'

export interface CriterionOption {
    value: string
    label: string
    /** Extra words appended to the web-search query. */
    query: string
}

export const CRITERIA_OPTIONS: CriterionOption[] = [
    { value: 'vegetarian', label: 'Vegetarian', query: 'vegetarian' },
    { value: 'vegan', label: 'Vegan', query: 'vegan' },
    { value: 'pescetarian', label: 'Pescetarian', query: 'pescatarian' },
    { value: 'gluten_free', label: 'Gluten-free', query: 'gluten free' },
    { value: 'dairy_free', label: 'Dairy-free', query: 'dairy free' },
    { value: 'nut_free', label: 'Nut-free', query: 'nut free' },
    { value: 'low_fodmap', label: 'Low-FODMAP', query: 'low fodmap' },
    { value: 'kosher', label: 'Kosher', query: 'kosher' },
    { value: 'halal', label: 'Halal', query: 'halal' }
]

const CRITERIA_BY_VALUE = new Map(CRITERIA_OPTIONS.map(c => [c.value, c]))

export const criterionLabel = (value: string): string =>
    CRITERIA_BY_VALUE.get(value)?.label || value.replace(/_/g, ' ')

/** Keeps only recognised criteria, de-duplicated, preserving order. */
export const normalizeCriteria = (input: unknown): string[] => {
    if (!Array.isArray(input)) return []
    const out: string[] = []
    for (const raw of input) {
        if (typeof raw !== 'string') continue
        const value = raw.trim().toLowerCase()
        if (!value || !CRITERIA_BY_VALUE.has(value) || out.includes(value)) continue
        out.push(value)
    }
    return out
}

/**
 * Builds the recipe-source search query: the dish first, then each criteria
 * qualifier, then any free-text extra, then the literal "recipe" keyword.
 */
export const buildSearchQuery = (name: string, criteria: string[] = [], extra?: string): string => {
    const parts: string[] = []
    const cleanName = (name || '').replace(/\s+/g, ' ').trim()
    if (cleanName) parts.push(cleanName)
    for (const value of normalizeCriteria(criteria)) {
        const q = CRITERIA_BY_VALUE.get(value)?.query
        if (q) parts.push(q)
    }
    const cleanExtra = (extra || '').replace(/\s+/g, ' ').trim()
    if (cleanExtra) parts.push(cleanExtra)
    parts.push('recipe')
    return parts.join(' ')
}

/**
 * Maps a preset list's dietary filters onto TasteAtlas' vegetarian/vegan
 * variants so the "which list" choice respects the criteria where possible.
 */
export const tasteAtlasVariantKey = (criteria: string[] = []): 'vegetarian-dishes' | 'vegan-dishes' | null => {
    const set = new Set(normalizeCriteria(criteria))
    if (set.has('vegan')) return 'vegan-dishes'
    if (set.has('vegetarian')) return 'vegetarian-dishes'
    return null
}

/** Pulls default criteria off a user document (preference + restrictions). */
export const criteriaFromUser = (user: any): string[] => {
    const out: string[] = []
    const pref = user?.dietary_preference
    if (pref && pref !== 'none') out.push(pref)
    const restrictions = Array.isArray(user?.dietary_restrictions) ? user.dietary_restrictions : []
    out.push(...restrictions)
    return normalizeCriteria(out)
}

const PREFERENCE_VALUES = ['vegetarian', 'vegan', 'pescetarian']

/**
 * Turns the selected criteria into the shared dietary-rules sentence used by
 * the planner AI, so recipe extraction can adapt/substitute accordingly.
 * Returns '' when nothing is selected.
 */
export const criteriaInstruction = (criteria: string[] = []): string => {
    const norm = normalizeCriteria(criteria)
    if (norm.length === 0) return ''
    const preference = norm.find(c => PREFERENCE_VALUES.includes(c)) || 'none'
    const restrictions = norm.filter(c => !PREFERENCE_VALUES.includes(c))
    const text = buildDietaryConstraints({ dietary_preference: preference, dietary_restrictions: restrictions })
    return text === 'No dietary restrictions.' ? '' : text
}
