// Sanitisers for the additive explore-overlay fields on a Recipe. Kept here so
// the create and update handlers agree on shape and never persist stray keys.

export interface DishListRef {
    listId?: string
    itemId?: string
    listName?: string
}

const isId = (value: unknown): boolean =>
    typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)

export const sanitizeDishListRefs = (input: unknown): DishListRef[] | undefined => {
    if (!Array.isArray(input)) return undefined
    const out: DishListRef[] = []
    for (const raw of input) {
        if (!raw || typeof raw !== 'object') continue
        const ref = raw as any
        if (!isId(ref.listId) && !isId(ref.itemId)) continue
        out.push({
            listId: isId(ref.listId) ? ref.listId : undefined,
            itemId: isId(ref.itemId) ? ref.itemId : undefined,
            listName: typeof ref.listName === 'string' ? ref.listName.trim().slice(0, 200) : undefined
        })
    }
    return out
}

export interface RecipeLocation {
    country?: string
    region?: string
    city?: string
    lat?: number
    lng?: number
    // Set when an origin search ran but found nothing (editor only).
    regionSearchFailed?: boolean
}

const str = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed ? trimmed.slice(0, 200) : undefined
}

const num = (value: unknown): number | undefined => {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
}

export const sanitizeRecipeLocation = (input: unknown): RecipeLocation | undefined => {
    if (!input || typeof input !== 'object') return undefined
    const src = input as any
    const loc: RecipeLocation = {
        country: str(src.country),
        region: str(src.region),
        city: str(src.city),
        lat: num(src.lat),
        lng: num(src.lng)
    }
    // A manual region/city means the origin was found, so clear the marker.
    // Otherwise carry the "we tried and found nothing" flag through so the
    // editor can show it (and stop re-running the search).
    if (loc.region || loc.city) loc.regionSearchFailed = false
    else if (src.regionSearchFailed === true) loc.regionSearchFailed = true
    const hasValue = Object.values(loc).some(v => v !== undefined)
    return hasValue ? loc : undefined
}
