import { callGroqChat } from '../ai'
import { PreParseResult } from './preParse'

export type GeneratedSelectors = {
    name?: string
    ingredients?: { container?: string; item?: string; name?: string; amount?: string; unit?: string; note?: string }
    instructions?: { container?: string; item?: string; text?: string; note?: string }
    notes?: { container?: string; item?: string }
}

interface GeneratedRuleResult {
    rule: GeneratedSelectors | null
    recipe: {
        name: string
        ingredients: { ingredient: string; converted: any }[]
        instructions: { stepNumber: number; instruction: string }[]
        sourceNotes?: string
    } | null
}

const SYSTEM_PROMPT = `You are a web scraping expert. You will receive trimmed HTML fragments from a recipe page, grouped by which section they likely belong to (ingredients, instructions/method, notes/tips).

Your job:
1. Produce CSS selectors (compatible with cheerio) that extract the recipe data from the FULL page HTML.
2. Extract the actual recipe data from the fragments provided.

Rules for selectors:
- Use stable attributes when available (id, itemprop, data-* attributes, semantic class names like "wprm-recipe-ingredient"). Avoid generated/hash-like class names and brittle nth-child chains unless nothing else works.
- For ingredients: selectors.container is an optional outer wrapper, selectors.item matches each ingredient row, and selectors.name/amount/unit/note are optional child selectors within a row. If each row is plain text, omit name/amount/unit/note.
- For instructions: selectors.item matches each step, selectors.text optionally targets the step's text child.
- For notes: selectors.container + optional selectors.item for the recipe notes/tips section at the bottom. Omit entirely if no notes section is present.
- If a category has no reliable selector, omit that category.

Respond ONLY with a JSON object of this exact shape:
{
  "selectors": {
    "name": "css selector for recipe title h1, or omit",
    "ingredients": { "container": "...", "item": "...", "name": "...", "amount": "...", "unit": "...", "note": "..." },
    "instructions": { "container": "...", "item": "...", "text": "..." },
    "notes": { "container": "...", "item": "..." }
  },
  "recipe": {
    "name": "recipe title",
    "ingredients": ["raw ingredient line 1", "..."],
    "instructions": ["step 1 text", "..."],
    "notes": ["note/tip paragraph 1", "..."]
  }
}
The "recipe" object must contain the data exactly as it appears in the fragments. Omit "notes" if none exist.`

const buildFragmentBlock = (pre: PreParseResult): string => {
    const parts: string[] = []
    for (const category of ['ingredients', 'instructions', 'notes'] as const) {
        const candidates = pre.candidates[category] || []
        if (candidates.length === 0) continue
        parts.push(`=== LIKELY ${category.toUpperCase()} SECTIONS (cssPath) ===`)
        for (const candidate of candidates) {
            const fragment = pre.fragments[candidate.cssPath] || ''
            if (!fragment) continue
            parts.push(`[cssPath: ${candidate.cssPath}]\n${fragment}`)
        }
    }
    // Always give the AI the page's h1 for the recipe name
    const h1Match = Object.entries(pre.fragments).find(([, html]) => /<h1/i.test(html))
    if (!h1Match) parts.push('=== NOTE ===\nNo h1 found in fragments; the recipe title may need a simple "h1" selector.')
    return parts.join('\n\n').slice(0, 120000)
}

const safeJsonParse = (raw: string): any => {
    try {
        return JSON.parse(raw)
    } catch {
        const start = raw.indexOf('{')
        const end = raw.lastIndexOf('}')
        if (start >= 0 && end > start) {
            try { return JSON.parse(raw.slice(start, end + 1)) } catch { return null }
        }
        return null
    }
}

const sanitizeSelector = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    if (!trimmed || trimmed.length > 500) return undefined
    // Reject selectors that could break cheerio or inject anything weird
    if (/[<>{};]/.test(trimmed)) return undefined
    return trimmed
}

const sanitizeSelectors = (raw: any): GeneratedSelectors | null => {
    if (!raw || typeof raw !== 'object') return null
    const out: GeneratedSelectors = {}
    const name = sanitizeSelector(raw.name)
    if (name) out.name = name

    const sanitizeGroup = (group: any, fields: string[]) => {
        if (!group || typeof group !== 'object') return undefined
        const cleaned: Record<string, string> = {}
        for (const field of fields) {
            const v = sanitizeSelector(group[field])
            if (v) cleaned[field] = v
        }
        return Object.keys(cleaned).length > 0 ? cleaned : undefined
    }

    out.ingredients = sanitizeGroup(raw.ingredients, ['container', 'item', 'name', 'amount', 'unit', 'note']) as any
    out.instructions = sanitizeGroup(raw.instructions, ['container', 'item', 'text', 'note']) as any
    out.notes = sanitizeGroup(raw.notes, ['container', 'item']) as any
    if (!out.ingredients && !out.instructions) return null
    return out
}

export const generateScrapeRule = async (
    url: string,
    html: string,
    pre: PreParseResult
): Promise<GeneratedRuleResult> => {
    const fragmentBlock = buildFragmentBlock(pre)
    if (!fragmentBlock) return { rule: null, recipe: null }

    const userPrompt = `URL: ${url}\n\nHere are the pre-parsed candidate sections from the page:\n\n${fragmentBlock}\n\nGenerate the selectors JSON and extract the recipe.`

    const content = await callGroqChat(
        [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
        ],
        true
    )

    const parsed = safeJsonParse(content)
    if (!parsed) return { rule: null, recipe: null }

    const selectors = sanitizeSelectors(parsed.selectors)

    const rawRecipe = parsed.recipe || {}
    const ingredients: any[] = (Array.isArray(rawRecipe.ingredients)
        ? rawRecipe.ingredients
        : []
    ).filter((x: any) => typeof x === 'string' && x.trim())
        .map((x: string) => ({ ingredient: x.trim(), converted: null }))

    const instructions = (Array.isArray(rawRecipe.instructions) ? rawRecipe.instructions : [])
        .filter((x: any) => typeof x === 'string' && x.trim())
        .map((x: string, i: number) => ({ stepNumber: i + 1, instruction: x.trim() }))

    const notes = Array.isArray(rawRecipe.notes)
        ? rawRecipe.notes.filter((x: any) => typeof x === 'string' && x.trim())
        : []

    const recipe = {
        name: typeof rawRecipe.name === 'string' ? rawRecipe.name.trim() : '',
        ingredients,
        instructions,
        sourceNotes: notes.length ? notes.join('\n\n') : undefined
    }

    const hasData = recipe.ingredients.length >= 1 && recipe.instructions.length >= 1
    if (!hasData && !selectors) return { rule: null, recipe: null }

    return {
        rule: selectors,
        recipe: hasData ? recipe : null
    }
}
