// On-demand geocoding for the world map. Uses OpenStreetMap's Nominatim (no
// API key). Nominatim's usage policy requires a descriptive User-Agent and at
// most ~1 request/second — callers must space requests out (see geocodePlaces).

import { hasRegionArea } from './locationStatus'

export interface GeoPlace {
    country?: string
    region?: string
    city?: string
}

export interface GeoPoint {
    lat: number
    lng: number
    displayName: string
    /** Structured country name from Nominatim (English when accept-language=en). */
    country?: string
    /** ISO 3166-1 alpha-2 country code from Nominatim. */
    countryCode?: string
}

export interface DishPlaceInput extends GeoPlace {
    name: string
    category?: string
    /** Blurb — often contains strong regional/origin cues. */
    description?: string
}

export interface RegionGuess {
    region?: string
    city?: string
    confident: boolean
}

export interface ResolvedDish {
    country?: string
    region?: string
    city?: string
    lat: number
    lng: number
    /** True when region/city were inferred by the AI rather than scraped. */
    guessed?: boolean
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'Recipebook/1.0 (dish-list map; contact: editorial@tasteatlas.com)'

/** How many dishes go into a single AI region-guess call. */
export const GUESS_BATCH_SIZE = 10

export const buildGeocodeQuery = (place: GeoPlace): string => {
    const parts = [place.city, place.region, place.country]
        .map(p => (p || '').trim())
        .filter(Boolean)
    // Drop duplicates (city/region are often identical, e.g. "Naples, Naples, Italy")
    const unique = parts.filter((p, i) => parts.findIndex(x => x.toLowerCase() === p.toLowerCase()) === i)
    return unique.join(', ')
}

export const geocodePlace = async (place: GeoPlace): Promise<GeoPoint | null> => {
    const query = buildGeocodeQuery(place)
    if (!query) return null
    try {
        const url = `${NOMINATIM_URL}?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`
        const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en' },
            signal: AbortSignal.timeout(20000)
        })
        if (!res.ok) return null
        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0) return null
        const hit = data[0]
        const lat = Number(hit.lat)
        const lng = Number(hit.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        const address = hit.address || {}
        return {
            lat,
            lng,
            displayName: String(hit.display_name || query),
            country: typeof address.country === 'string' ? address.country : undefined,
            countryCode: typeof address.country_code === 'string' ? address.country_code : undefined
        }
    } catch (err: any) {
        console.error('[dishLists] Geocode failed:', err?.message || err)
        return null
    }
}

/** Geocodes sequentially with a polite delay to respect Nominatim's limits. */
export const geocodePlaces = async (places: GeoPlace[], delayMs = 1100): Promise<(GeoPoint | null)[]> => {
    const out: (GeoPoint | null)[] = []
    for (let i = 0; i < places.length; i++) {
        out.push(await geocodePlace(places[i]))
        if (i < places.length - 1) await new Promise(r => setTimeout(r, delayMs))
    }
    return out
}

// ---------------------------------------------------------------------------
// Region/city guessing (batched AI) with a country-level fallback
// ---------------------------------------------------------------------------

const GUESS_SYSTEM = [
    'You are a culinary geography expert. For each numbered dish, identify the region (state/province) and city where the dish is most famous and popular — the place a visitor would go in that country to eat it — using the dish name and its description as evidence (origin words, ingredients, cooking style, cuisine name).',
    'Prefer the area the dish is best known for, even when that differs from where it originated.',
    'Most dishes are strongly tied to one place — when the evidence points clearly at a specific region or city, provide it and set "confident": true even if the exact city is uncertain (then give the region and leave "city" null).',
    'Each dish has its own country — do not assume dishes share a country.',
    'Only set "confident": false when the dish is generic, widespread across many regions, or the evidence is genuinely unclear.',
    'Never invent places that the evidence does not support.',
    'Reply with JSON only: {"results":[{"index": <same number>, "region": string|null, "city": string|null, "confident": boolean}, ...]}, one entry per dish, in order.'
].join(' ')

/**
 * Prompt for guessing a batch of dishes' regions/cities. Kept pure so it can be
 * unit-tested without hitting the network.
 */
export const buildBatchGuessMessages = (inputs: DishPlaceInput[]) => {
    const lines = inputs.map((input, i) => {
        const blurb = (input.description || '').replace(/\s+/g, ' ').trim().slice(0, 400)
        return [
            `${i + 1}.`,
            `Name: ${input.name}`,
            input.category ? `Category: ${input.category}` : '',
            input.country ? `Country: ${input.country}` : '',
            blurb ? `Description: ${blurb}` : ''
        ].filter(Boolean).join(' | ')
    })
    return [
        { role: 'system', content: GUESS_SYSTEM },
        { role: 'user', content: lines.join('\n') }
    ]
}

/**
 * Guesses region/city for a batch of dishes in a single AI call. Returns an
 * array aligned to `inputs` (null where a dish has no name/country or failed).
 */
export const guessDishRegions = async (inputs: DishPlaceInput[]): Promise<(RegionGuess | null)[]> => {
    if (!inputs || inputs.length === 0) return []
    const anyUsable = inputs.some(i => i.name && i.country)
    if (!anyUsable) return inputs.map(() => null)
    try {
        const { callGroqChat } = await import('../ai')
        const content = await callGroqChat(buildBatchGuessMessages(inputs), true)
        const parsed = JSON.parse(content)
        const results: any[] = Array.isArray(parsed?.results) ? parsed.results : []
        const byIndex = new Map<number, any>()
        results.forEach((r, i) => {
            const idx = Number(r?.index)
            byIndex.set(Number.isFinite(idx) ? idx : i + 1, r)
        })
        return inputs.map((input, i) => {
            if (!input.name || !input.country) return null
            const hit = byIndex.get(i + 1)
            if (!hit) return null
            const region = typeof hit.region === 'string' && hit.region.trim() ? hit.region.trim() : undefined
            const city = typeof hit.city === 'string' && hit.city.trim() ? hit.city.trim() : undefined
            return { region, city, confident: hit.confident === true }
        })
    } catch (err: any) {
        console.error('[dishLists] Region guess failed:', err?.message || err)
        return inputs.map(() => null)
    }
}

/** Lowercases and strips accents/punctuation so country names compare cleanly. */
const normalizeCountry = (value: string): string =>
    (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

/** Alternative / official names for countries whose stored name differs. */
const COUNTRY_ALIASES: Record<string, string[]> = {
    'united states of america': ['united states', 'usa', 'u s a'],
    'united states': ['united states of america', 'usa', 'u s a'],
    'united kingdom': ['great britain', 'uk', 'u k'],
    turkiye: ['turkey'],
    turkey: ['turkiye'],
    'south korea': ['republic of korea', 'korea'],
    'north korea': ['democratic people s republic of korea'],
    czechia: ['czech republic'],
    'czech republic': ['czechia'],
    russia: ['russian federation'],
    vietnam: ['viet nam'],
    uae: ['united arab emirates'],
    'united arab emirates': ['uae'],
    'bosnia and herzegovina': ['bosnia'],
    macedonia: ['north macedonia'],
    'north macedonia': ['macedonia'],
    'ivory coast': ["cote d ivoire"],
    'cote d ivoire': ['ivory coast']
}

/**
 * Loose check that a Nominatim result actually sits in the expected country.
 * Uses the structured address country when available (so localized display
 * names don't cause false negatives) and falls back to known aliases.
 */
export const countryMatches = (displayName: string, country?: string, addressCountry?: string): boolean => {
    if (!country) return true
    const needle = normalizeCountry(country)
    if (!needle) return true
    const haystacks = [displayName, addressCountry]
        .map(v => normalizeCountry(v || ''))
        .filter(Boolean)
    if (haystacks.some(h => h.includes(needle))) return true
    const aliases = COUNTRY_ALIASES[needle] || []
    return aliases.some(alias => haystacks.some(h => h.includes(alias)))
}

export const hasSpecificPlace = (input: GeoPlace): boolean => hasRegionArea(input)

/**
 * Geocodes a single dish given an (optional) pre-computed region guess:
 *  1. Use a scraped region/city if present.
 *  2. Otherwise use the AI guess only when confident AND Nominatim places the
 *     result inside the right country.
 *  3. Otherwise fall back to the country centroid ("if ambiguous, just country").
 */
export const geocodeWithGuess = async (input: DishPlaceInput, guess: RegionGuess | null): Promise<ResolvedDish | null> => {
    if (hasSpecificPlace(input)) {
        const point = await geocodePlace({ country: input.country, region: input.region, city: input.city })
        if (point) {
            return { country: input.country, region: input.region, city: input.city, lat: point.lat, lng: point.lng }
        }
    }

    if (input.country && guess?.confident && (guess.region || guess.city)) {
        const candidate: GeoPlace = { country: input.country, region: guess.region, city: guess.city }
        const point = await geocodePlace(candidate)
        if (point && countryMatches(point.displayName, input.country, point.country)) {
            return { ...candidate, lat: point.lat, lng: point.lng, guessed: true }
        }
    }

    if (input.country) {
        const countryPoint = await geocodePlace({ country: input.country })
        if (countryPoint) {
            return { country: input.country, lat: countryPoint.lat, lng: countryPoint.lng }
        }
    }

    if (hasSpecificPlace(input)) {
        const point = await geocodePlace({ region: input.region, city: input.city })
        if (point) return { region: input.region, city: input.city, lat: point.lat, lng: point.lng }
    }
    return null
}

/** Single-dish convenience wrapper (batches of one). */
export const resolveDishLocation = async (input: DishPlaceInput): Promise<ResolvedDish | null> => {
    const guesses = await guessDishRegions([input])
    return geocodeWithGuess(input, guesses[0] || null)
}

/**
 * Refinement for an item that already has coordinates but only at country
 * level: keeps the country, and only returns a result when a confident
 * region/city guess geocodes inside that country. Returns null otherwise so
 * the existing country point is left untouched.
 */
export const refineDishLocation = async (input: DishPlaceInput, guess: RegionGuess | null): Promise<ResolvedDish | null> => {
    if (!input.country || !guess?.confident || !(guess.region || guess.city)) return null
    const candidate: GeoPlace = { country: input.country, region: guess.region, city: guess.city }
    const point = await geocodePlace(candidate)
    if (point && countryMatches(point.displayName, input.country, point.country)) {
        return { ...candidate, lat: point.lat, lng: point.lng, guessed: true }
    }
    return null
}

/** Mongo $set patch (dot notation) for a resolved location. */
export const locationPatch = (resolved: ResolvedDish, options: { includeCountry?: boolean } = {}): Record<string, any> => {
    const set: Record<string, any> = { 'location.lat': resolved.lat, 'location.lng': resolved.lng }
    if (options.includeCountry && resolved.country) set['location.country'] = resolved.country
    if (resolved.region) set['location.region'] = resolved.region
    if (resolved.city) set['location.city'] = resolved.city
    return set
}

// ---------------------------------------------------------------------------
// Recipe origins (country + region + city) with a country-level fallback
// ---------------------------------------------------------------------------

export interface OriginPlaceInput {
    name: string
    /** Cuisine genre, e.g. "Italian" — a strong origin cue. */
    genre?: string
    /** Comma-joined ingredient names. */
    ingredients?: string
    /** Notes / description used as origin evidence. */
    description?: string
    country?: string
    region?: string
    city?: string
}

export interface OriginGuess {
    country?: string
    region?: string
    city?: string
    confident: boolean
}

const ORIGIN_SYSTEM = [
    'You are a culinary geography expert. For each numbered recipe, identify the country, region (state/province) and city it most likely comes from, using its name, cuisine genre, ingredients and description as evidence.',
    'The recipes may belong to any country — do not assume they share one.',
    'When the evidence points clearly at a country, set "confident": true and provide the most specific region/city the evidence supports (leave region or city null when you cannot support one, but still return the country).',
    'Only set "confident": false when the cuisine is generic, widespread or the evidence is genuinely unclear.',
    'Never invent places the evidence does not support.',
    'Reply with JSON only: {"results":[{"index": <same number>, "country": string|null, "region": string|null, "city": string|null, "confident": boolean}, ...]}, one entry per recipe, in order.'
].join(' ')

/**
 * Prompt for guessing a batch of recipes' country/region/city. Kept pure so it
 * can be unit-tested without hitting the network.
 */
export const buildOriginGuessMessages = (inputs: OriginPlaceInput[]) => {
    const lines = inputs.map((input, i) => {
        const blurb = (input.description || '').replace(/\s+/g, ' ').trim().slice(0, 400)
        const ingredients = (input.ingredients || '').replace(/\s+/g, ' ').trim().slice(0, 300)
        return [
            `${i + 1}.`,
            `Name: ${input.name}`,
            input.genre ? `Cuisine: ${input.genre}` : '',
            ingredients ? `Ingredients: ${ingredients}` : '',
            input.country ? `Known country: ${input.country}` : '',
            blurb ? `Description: ${blurb}` : ''
        ].filter(Boolean).join(' | ')
    })
    return [
        { role: 'system', content: ORIGIN_SYSTEM },
        { role: 'user', content: lines.join('\n') }
    ]
}

/**
 * Guesses country/region/city for a batch of recipes in a single AI call.
 * Returns an array aligned to `inputs` (null where a recipe has no name/failed).
 */
export const guessRecipeOrigins = async (inputs: OriginPlaceInput[]): Promise<(OriginGuess | null)[]> => {
    if (!inputs || inputs.length === 0) return []
    if (!inputs.some(i => i.name)) return inputs.map(() => null)
    try {
        const { callGroqChat } = await import('../ai')
        const content = await callGroqChat(buildOriginGuessMessages(inputs), true)
        const parsed = JSON.parse(content)
        const results: any[] = Array.isArray(parsed?.results) ? parsed.results : []
        const byIndex = new Map<number, any>()
        results.forEach((r, i) => {
            const idx = Number(r?.index)
            byIndex.set(Number.isFinite(idx) ? idx : i + 1, r)
        })
        return inputs.map((input, i) => {
            if (!input.name) return null
            const hit = byIndex.get(i + 1)
            if (!hit) return null
            const country = typeof hit.country === 'string' && hit.country.trim() ? hit.country.trim() : undefined
            const region = typeof hit.region === 'string' && hit.region.trim() ? hit.region.trim() : undefined
            const city = typeof hit.city === 'string' && hit.city.trim() ? hit.city.trim() : undefined
            const effectiveCountry = country || input.country
            if (!effectiveCountry && !region && !city) return { confident: false }
            return { country: effectiveCountry, region, city, confident: hit.confident === true }
        })
    } catch (err: any) {
        console.error('[dishLists] Origin guess failed:', err?.message || err)
        return inputs.map(() => null)
    }
}

/**
 * Resolves a recipe's origin to place names + coordinates. Guesses the missing
 * country/region/city via AI, then geocodes — falling back to the country
 * centroid when only the country is confident.
 */
export const resolveRecipeLocation = async (input: OriginPlaceInput): Promise<ResolvedDish | null> => {
    const fullySpecified = Boolean(input.country && hasRegionArea(input))
    const guess = fullySpecified ? null : ((await guessRecipeOrigins([input]))[0] || null)
    return geocodeRecipeOrigin(input, guess)
}

/**
 * Same as resolveRecipeLocation but for callers that already batched the AI
 * guess (e.g. the world-map endpoint) to avoid one AI call per recipe.
 */
export const geocodeRecipeOrigin = async (input: OriginPlaceInput, guess: OriginGuess | null): Promise<ResolvedDish | null> => {
    const country = input.country || guess?.country
    const asDish: DishPlaceInput = {
        name: input.name,
        description: input.description,
        country,
        region: input.region,
        city: input.city
    }
    return geocodeWithGuess(asDish, guess ? { region: guess.region, city: guess.city, confident: guess.confident } : null)
}
