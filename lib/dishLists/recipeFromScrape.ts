import { formatImportedIngredients, Ingredient, Instruction } from '../recipeExtraction'

// Minimal shape of the /api/recipeSiteExtract/auto response that we rely on.
// Kept structural so the scraper can evolve without breaking this mapping.
export interface ScrapedIngredientResult {
    ingredient?: string
    converted?: { name?: any; quantity?: any; quantity_unit?: any } | null
}

export interface ScrapedRecipeResult {
    name?: string
    ingredients?: ScrapedIngredientResult[]
    instructions?: Array<{ instruction?: string }>
    sourceNotes?: string
}

export interface RemixRecipe {
    name: string
    ingredients: Ingredient[]
    instructions: Instruction[]
    sourceNotes?: string
}

const hasConverted = (i: ScrapedIngredientResult): boolean =>
    i != null && i.converted !== undefined && i.converted !== null

/**
 * Converts a scraped web recipe into the shape the remix flow understands
 * (editor-shaped ingredients/instructions). Only ingredients the scraper
 * managed to convert are kept. Returns null when the parse isn't usable, so
 * the caller can fall back to a different import method.
 */
export const mapScrapedToRemixRecipe = (
    scraped: ScrapedRecipeResult | null | undefined,
    fallbackName = ''
): RemixRecipe | null => {
    if (!scraped || typeof scraped !== 'object') return null

    const ingredients: Ingredient[] = (Array.isArray(scraped.ingredients) ? scraped.ingredients : [])
        .filter(hasConverted)
        .map(i => ({
            Name: String(i.converted?.name || '').trim(),
            Amount: i.converted?.quantity ?? '',
            AmountType: String(i.converted?.quantity_unit || 'each'),
            Note: 'Imported from web'
        }))
        .filter(i => i.Name)

    const instructions: Instruction[] = (Array.isArray(scraped.instructions) ? scraped.instructions : [])
        .map(s => ({ Text: String(s?.instruction || '').trim() }))
        .filter(s => s.Text)

    if (ingredients.length === 0 || instructions.length === 0) return null

    return {
        name: String(scraped.name || fallbackName || '').trim(),
        ingredients,
        instructions,
        sourceNotes: scraped.sourceNotes ? String(scraped.sourceNotes) : undefined
    }
}

/**
 * Like {@link mapScrapedToRemixRecipe} but best-effort runs the scraped rows
 * through the AI ingredient formatter (same split as the normal web import:
 * "chopped garlic" -> garlic + note "chopped"). Falls back to the raw mapping
 * whenever formatting is unavailable.
 */
export const buildRemixRecipeFromScrape = async (
    scraped: ScrapedRecipeResult | null | undefined,
    fallbackName = ''
): Promise<RemixRecipe | null> => {
    const base = mapScrapedToRemixRecipe(scraped, fallbackName)
    if (!base) return null

    const raw = (Array.isArray(scraped?.ingredients) ? scraped!.ingredients! : [])
        .filter(hasConverted)
        .map(i => ({ name: i.converted?.name, quantity: i.converted?.quantity, quantity_unit: i.converted?.quantity_unit }))

    try {
        const formatted = await formatImportedIngredients(raw)
        if (formatted && formatted.length > 0) return { ...base, ingredients: formatted }
    } catch {
        // Keep the raw parse on any formatting failure.
    }
    return base
}
