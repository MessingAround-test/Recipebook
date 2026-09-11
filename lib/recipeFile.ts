import { decimalToFraction } from './fractionFormat'

/**
 * Recipe export/import file format.
 *
 * Export and import both live here so the file format is defined in exactly
 * one place — anything this module writes back, this module can read.
 *
 * File shape:
 * {
 *   format: "recipebook-recipe",
 *   version: 1,
 *   exportedAt: ISO date string,
 *   recipe: {
 *     name, ingredients [{ Name, Amount, AmountType, note }],
 *     instructions [{ Text, time, note }],
 *     time, genre, mealTypes, carbType, servings, sourceUrl, prepWork,
 *     image: "data:image/...;base64,..." (optional, embedded)
 *   }
 * }
 *
 * Ingredient/instruction field casing matches the Mongoose model
 * (models/Recipe.js): lowercase `note`. Import maps to the editor's
 * capital-`Note` shape (lib/recipeExtraction.ts Ingredient/Instruction).
 */

export const RECIPE_FILE_FORMAT = 'recipebook-recipe'
export const RECIPE_FILE_VERSION = 1

export interface RecipeFileIngredient {
    Name: string
    Amount: string | number
    AmountType: string
    note?: string
}

export interface RecipeFileInstruction {
    Text: string
    time?: number
    note?: string
}

export interface RecipeFileData {
    name: string
    ingredients?: RecipeFileIngredient[]
    instructions?: RecipeFileInstruction[]
    time?: string
    genre?: string
    mealTypes?: string[]
    carbType?: string
    servings?: number
    sourceUrl?: string
    prepWork?: any[]
    image?: string
}

export interface RecipeFilePayload {
    format: typeof RECIPE_FILE_FORMAT
    version: number
    exportedAt: string
    recipe: RecipeFileData
}

/** Accepts either the API/list shape ({name, quantity, quantity_type, note}) or the canonical model shape and returns the canonical file shape. */
export const toFileIngredient = (i: any): RecipeFileIngredient => ({
    Name: String(i?.Name ?? i?.name ?? '').trim(),
    Amount: i?.Amount ?? i?.quantity ?? '',
    AmountType: i?.AmountType ?? i?.quantity_type ?? 'each',
    ...(i?.note ? { note: i.note } : i?.Note ? { note: i.Note } : {})
})

export const toFileInstruction = (i: any): RecipeFileInstruction => {
    const out: RecipeFileInstruction = { Text: String(i?.Text ?? i?.text ?? '').trim() }
    if (typeof i?.time === 'number' && i.time > 0) out.time = i.time
    if (i?.note) out.note = i.note
    if (i?.Note) out.note = i.Note
    return out
}

export const buildRecipeExport = (data: Partial<RecipeFileData>): RecipeFilePayload => ({
    format: RECIPE_FILE_FORMAT,
    version: RECIPE_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    recipe: {
        name: String(data.name || ''),
        ...(data.ingredients ? { ingredients: data.ingredients.map(toFileIngredient) } : {}),
        ...(data.instructions ? { instructions: data.instructions.map(toFileInstruction) } : {}),
        ...(data.time ? { time: data.time } : {}),
        ...(data.genre ? { genre: data.genre } : {}),
        ...(data.mealTypes?.length ? { mealTypes: data.mealTypes } : {}),
        ...(data.carbType ? { carbType: data.carbType } : {}),
        ...(data.servings != null && data.servings > 0 ? { servings: data.servings } : {}),
        ...(data.sourceUrl ? { sourceUrl: data.sourceUrl } : {}),
        ...(data.prepWork?.length ? { prepWork: data.prepWork } : {}),
        ...(data.image ? { image: data.image } : {})
    }
})

const formatIngredientLine = (i: any): string => {
    const ing = toFileIngredient(i)
    if (!ing.Name) return ''
    const bits: string[] = []
    if (ing.Amount !== '' && ing.Amount != null) {
        let amount = String(decimalToFraction(ing.Amount))
        if (ing.AmountType) amount += ` ${ing.AmountType}`
        bits.push(amount.trim())
    }
    bits.push(ing.Name)
    if (ing.note) bits.push(`(${ing.note})`)
    return bits.join(' ')
}

const formatInstructionLine = (i: any): string => {
    const ins = toFileInstruction(i)
    let line = ins.Text
    if (ins.time && ins.time > 0) line += ` (${ins.time} min)`
    if (ins.note) line += ` – ${ins.note}`
    return line
}

const formatMetaLine = (r: RecipeFileData): string => {
    const bits: string[] = []
    if (r.servings != null && r.servings > 0) bits.push(`Servings: ${r.servings}`)
    if (r.time) bits.push(`Time: ${r.time}`)
    if (r.genre) bits.push(r.genre)
    return bits.join(' · ')
}

/** Builds a plain-text export of a recipe (headers with spacing, ingredient list, numbered steps) for pasting into notes/messages. */
export const buildRecipeTextExport = (recipe: Partial<RecipeFileData>): string => {
    const data = buildRecipeExport({ ...recipe, image: undefined }).recipe
    const out: string[] = [data.name]
    const meta = formatMetaLine(data)
    if (meta) {
        out.push('')
        out.push(meta)
    }
    if (data.ingredients?.length) {
        out.push('')
        out.push('INGREDIENTS')
        for (const i of data.ingredients) {
            const line = formatIngredientLine(i)
            if (line) out.push(`  • ${line}`)
        }
    }
    if (data.prepWork?.length) {
        out.push('')
        out.push('PREP WORK')
        for (const p of data.prepWork) {
            const line = [p?.action || p?.ingredient, p?.timeEstimate ? `(${p.timeEstimate} min)` : '', !p?.optional ? undefined : '(optional)']
                .filter(Boolean).join(' ').trim()
            if (line) out.push(`  • ${line}`)
        }
    }
    if (data.instructions?.length) {
        out.push('')
        out.push('INSTRUCTIONS')
        data.instructions.forEach((i, idx) => {
            const line = formatInstructionLine(i)
            if (line) out.push(`  ${idx + 1}. ${line}`)
        })
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n'
}

/** Builds a Markdown export: headings, tick-boxes on ingredient list items, numbered instructions. */
export const buildRecipeMarkdownExport = (recipe: Partial<RecipeFileData>): string => {
    const data = buildRecipeExport({ ...recipe, image: undefined }).recipe
    const out: string[] = [`# ${data.name}`]
    const meta = formatMetaLine(data)
    if (meta) {
        out.push('')
        out.push(meta)
    }
    if (data.ingredients?.length) {
        out.push('')
        out.push('## Ingredients')
        for (const i of data.ingredients) {
            const line = formatIngredientLine(i)
            if (line) out.push(`- [ ] ${line}`)
        }
    }
    if (data.prepWork?.length) {
        out.push('')
        out.push('## Prep Work')
        for (const p of data.prepWork) {
            const line = [p?.action || p?.ingredient, p?.timeEstimate ? `(${p.timeEstimate} min)` : '', !p?.optional ? undefined : '(optional)']
                .filter(Boolean).join(' ').trim()
            if (line) out.push(`- ${line}`)
        }
    }
    if (data.instructions?.length) {
        out.push('')
        out.push('## Instructions')
        data.instructions.forEach((i, idx) => {
            const line = formatInstructionLine(i)
            if (line) out.push(`${idx + 1}. ${line}`)
        })
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n'
}

/** Generic text file download (used for the Markdown export; JSON uses downloadRecipeFile). */
export const downloadTextFile = (content: string, filename: string, mime = 'text/plain;charset=utf-8'): void => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

export const sanitizeRecipeFilename = (name: string): string => {
    const cleaned = (name || '')
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)
    return cleaned || 'recipe'
}

export const downloadRecipeFile = (payload: RecipeFilePayload): void => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sanitizeRecipeFilename(payload.recipe.name)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

/** Fetches an image URL and converts it to a data URL so it can be embedded in the export file. Returns undefined on any failure. */
export const fetchImageAsDataUrl = async (url: string): Promise<string | undefined> => {
    if (!url) return undefined
    try {
        // Already a data URL (legacy inline image) — embed as-is
        if (url.startsWith('data:')) return url
        const res = await fetch(url)
        if (!res.ok) return undefined
        const blob = await res.blob()
        if (!blob.type.startsWith('image/')) return undefined
        return await new Promise<string | undefined>((resolve) => {
            const reader = new FileReader()
            reader.readAsDataURL(blob)
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => resolve(undefined)
        })
    } catch {
        return undefined
    }
}

export type ParseRecipeImportResult =
    | { ok: true; recipe: RecipeFileData }
    | { ok: false; error: string }

/** Parses and validates the text of an exported recipe file. Tolerates a bare (unwrapped) recipe object as long as it has a name and ingredient/instruction data. */
export const parseRecipeImport = (text: string): ParseRecipeImportResult => {
    let parsed: any
    try {
        parsed = JSON.parse(text)
    } catch {
        return { ok: false, error: 'Not a valid recipe file (could not read JSON).' }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, error: 'Not a valid recipe file.' }
    }

    const recipeRaw = parsed.format === RECIPE_FILE_FORMAT ? parsed.recipe : parsed
    if (!recipeRaw || typeof recipeRaw !== 'object') {
        return { ok: false, error: 'Not a valid recipe file (no recipe data found).' }
    }
    if (parsed.format === RECIPE_FILE_FORMAT && typeof parsed.version === 'number' && parsed.version > RECIPE_FILE_VERSION) {
        return { ok: false, error: 'This file was exported by a newer version of RecipeBook. Please update the app.' }
    }

    const name = typeof recipeRaw.name === 'string' ? recipeRaw.name.trim() : ''
    if (!name) {
        return { ok: false, error: 'This file is missing a recipe name.' }
    }

    const rawIngredients = Array.isArray(recipeRaw.ingredients) ? recipeRaw.ingredients : undefined
    const ingredients = rawIngredients?.map(toFileIngredient).filter(i => i.Name) ?? undefined
    if (rawIngredients && (!ingredients || ingredients.length === 0)) {
        return { ok: false, error: 'This file has no usable ingredients.' }
    }
    if (!rawIngredients && !Array.isArray(recipeRaw.instructions)) {
        return { ok: false, error: 'This file has no ingredients or instructions to import.' }
    }

    const instructions = Array.isArray(recipeRaw.instructions)
        ? recipeRaw.instructions.map(toFileInstruction).filter(i => i.Text)
        : undefined

    const recipe: RecipeFileData = {
        name,
        ...(ingredients?.length ? { ingredients } : {}),
        ...(instructions?.length ? { instructions } : {}),
        ...(recipeRaw.time ? { time: String(recipeRaw.time) } : {}),
        ...(recipeRaw.genre ? { genre: String(recipeRaw.genre) } : {}),
        ...(Array.isArray(recipeRaw.mealTypes) ? { mealTypes: recipeRaw.mealTypes.map(String) } : {}),
        ...(recipeRaw.carbType ? { carbType: String(recipeRaw.carbType) } : {}),
        ...(typeof recipeRaw.servings === 'number' && recipeRaw.servings > 0 ? { servings: recipeRaw.servings } : {}),
        ...(recipeRaw.sourceUrl ? { sourceUrl: String(recipeRaw.sourceUrl) } : {}),
        ...(Array.isArray(recipeRaw.prepWork) ? { prepWork: recipeRaw.prepWork } : {}),
        ...(typeof recipeRaw.image === 'string' && recipeRaw.image ? { image: recipeRaw.image } : {})
    }
    return { ok: true, recipe }
}

/** Maps a parsed recipe file onto the create/edit editor shapes (capital-`Note` ingredient/instruction fields). */
export const mapRecipeFileToEditor = (recipe: RecipeFileData) => ({
    name: recipe.name,
    ingredients: (recipe.ingredients || []).map(i => ({
        Name: i.Name,
        Amount: i.Amount,
        AmountType: i.AmountType,
        ...(i.note ? { Note: i.note } : {})
    })),
    instructions: (recipe.instructions || []).map(i => ({
        Text: i.Text,
        ...(i.note ? { Note: i.note } : {})
    })),
    time: recipe.time || '',
    genre: recipe.genre || '',
    mealTypes: recipe.mealTypes || [],
    carbType: recipe.carbType || '',
    servings: recipe.servings != null ? recipe.servings : '',
    sourceUrl: recipe.sourceUrl || ''
})
