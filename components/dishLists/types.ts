export interface DishListSummary {
    _id: string
    name: string
    description?: string
    sourceType: 'tasteatlas' | 'manual' | 'custom'
    sourceUrl?: string
    dietaryFilters: string[]
    isSystem?: boolean
    counts?: { total: number; cooked: number; imported: number }
}

export interface DishListLocation {
    country?: string
    region?: string
    city?: string
    regionId?: string
    lat?: number
    lng?: number
    // Set when a region/city search ran but found nothing (editor only).
    regionSearchFailed?: boolean
}

export interface DishListItem {
    _id: string
    listId: string
    slug: string
    rank?: number
    name: string
    category?: string
    rating?: number
    location?: DishListLocation
    description?: string
    image?: string
    imageOriginalUrl?: string
    hasImage?: boolean
    sourceUrl?: string
    recipeSourceUrl?: string
    cooked?: boolean
    cookedAt?: string
    notes?: string
    recipeId?: string
    recipeIds?: string[]
    importStatus?: 'none' | 'linked'
    enrichedAt?: string
}

export interface RecipeSourceCandidate {
    title: string
    url: string
    snippet: string
}
