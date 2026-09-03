import { quantity_unit_conversions, resolveUnitKey, normalizeUnicodeFractions } from './conversion'

export interface Ingredient {
    Name: string
    Amount: string | number
    AmountType: string
    Note?: string
}

export interface Instruction {
    Text: string
    Note?: string
}

export interface ExtractedRecipe {
    name?: string
    ingredients?: Ingredient[]
    instructions?: Instruction[]
    time?: string
    genre?: string
    mealTypes?: string[]
    servings?: number
    carbType?: string
}

export interface SaveRecipePayload {
    name: string
    ingreds: Ingredient[]
    instructions?: Instruction[]
    image?: string
    time?: string
    genre?: string
    mealTypes?: string[]
    carbType?: string
    servings?: number
    hidden?: boolean
    sourceUrl?: string
}

export const normalizeAmount = (value: string | number): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    const s = normalizeUnicodeFractions((value || '').toString())
    if (!s) return 0
    const parts = s.split(/\s+/)
    let total = 0
    for (const part of parts) {
        if (part.includes('/')) {
            const [n, d] = part.split('/').map(Number)
            if (d) total += n / d
        } else {
            const v = Number(part)
            if (Number.isFinite(v)) total += v
        }
    }
    return Number.isFinite(total) ? total : 0
}

export const extractRecipeFromImage = async (image: string, notes?: string): Promise<ExtractedRecipe> => {
    const token = localStorage.getItem('Token')
    const res = await fetch('/api/ai/extract_from_image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'edgetoken': token || ''
        },
        body: JSON.stringify({ image, notes })
    })
    const result = await res.json()
    if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to extract recipe from photo")
    }
    return result.data
}

export const extractRecipeFromNotes = async (notes: string): Promise<ExtractedRecipe> => {
    const token = localStorage.getItem('Token')
    const res = await fetch('/api/ai/extract_from_notes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'edgetoken': token || ''
        },
        body: JSON.stringify({ notes })
    })
    const result = await res.json()
    if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to extract recipe from notes")
    }
    return result.data
}

export const saveRecipe = async (payload: SaveRecipePayload): Promise<any> => {
    const token = localStorage.getItem('Token')
    const res = await fetch('/api/Recipe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'edgetoken': token || ''
        },
        body: JSON.stringify({
            name: payload.name,
            image: payload.image,
            time: payload.time || undefined,
            genre: payload.genre || undefined,
            mealTypes: payload.mealTypes,
            carbType: payload.carbType || undefined,
            servings: payload.servings,
            hidden: payload.hidden,
            sourceUrl: payload.sourceUrl || undefined,
            instructions: payload.instructions || [],
            ingreds: (payload.ingreds || []).map(ing => {
                // Safety net: only standard unit keys may be saved (the Recipe
                // model requires AmountType); park anything else in the note.
                const resolvedType = resolveUnitKey(ing.AmountType)
                const isStandard = quantity_unit_conversions[resolvedType] != null
                return {
                    Name: ing.Name,
                    Amount: normalizeAmount(ing.Amount),
                    AmountType: isStandard ? resolvedType : 'each',
                    note: isStandard ? ing.Note : [ing.Note, ing.AmountType].filter(Boolean).join(', ')
                }
            })
        })
    })
    const data = await res.json()
    if (!data.success) {
        throw new Error(data.message || "Failed to create recipe")
    }
    return data.data
}

export interface ConversionWarmResult {
    name: string
    ok: boolean
}

/**
 * Collects the (deduped, trimmed) names of ingredients whose unit is 'each' —
 * these are the rows that need an ingredient-specific grams conversion factor
 * from the IngredientConversion table for pricing/nutrition to resolve.
 */
export const getEachUnitIngredientNames = (ingredients: Ingredient[]): string[] => {
    const seen = new Set<string>()
    const names: string[] = []
    for (const ing of ingredients || []) {
        if (!ing || (ing.AmountType || '').toLowerCase() !== 'each') continue
        const name = (ing.Name || '').trim()
        if (!name) continue
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        names.push(name)
    }
    return names
}

/**
 * Warms the IngredientConversion table for the given ingredient names by
 * calling the SearchLogLookup endpoint (checks the table first, queries AI
 * only on a miss, and caches the result). Never throws — each name resolves
 * to { name, ok } so the UI can stop spinning regardless of failures.
 */
export const warmIngredientConversions = async (
    names: string[],
    fetchImpl: typeof fetch = fetch
): Promise<ConversionWarmResult[]> => {
    const token = localStorage.getItem('Token')
    return Promise.all((names || []).map(async (name): Promise<ConversionWarmResult> => {
        try {
            const res = await fetchImpl(`/api/Ingredients/SearchLogLookup?search_term=${encodeURIComponent(name)}`, {
                headers: { 'edgetoken': token || '' }
            })
            if (!res.ok) return { name, ok: false }
            const data = await res.json()
            return { name, ok: data.success === true }
        } catch {
            return { name, ok: false }
        }
    }))
}
