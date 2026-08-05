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
}

export const normalizeAmount = (value: string | number): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    const s = (value || '').toString().trim()
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
            instructions: payload.instructions || [],
            ingreds: (payload.ingreds || []).map(ing => ({
                Name: ing.Name,
                Amount: normalizeAmount(ing.Amount),
                AmountType: ing.AmountType || 'each',
                note: ing.Note
            }))
        })
    })
    const data = await res.json()
    if (!data.success) {
        throw new Error(data.message || "Failed to create recipe")
    }
    return data.data
}
