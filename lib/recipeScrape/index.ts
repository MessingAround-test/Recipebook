import axios from 'axios'
import * as cheerio from 'cheerio'
import dbConnect from '../dbConnect'
import SiteHtmlIndex from '../../models/SiteHtmlIndex'
import SiteScrapeRule from '../../models/SiteScrapeRule'
import ScrapeLog from '../../models/ScrapeLog'
import { convertMetricReading } from '../conversion'
import { preParseHtml, elementText, computePageSignature, PreParseResult, ScrapeCategory } from './preParse'
import { SYNONYMS_VERSION } from './synonyms'
import { generateScrapeRule } from './aiRuleGen'

export interface ScrapedIngredient {
    ingredient: string
    converted: ReturnType<typeof convertMetricReading> | null
}

export interface ScrapedInstruction {
    stepNumber: number
    instruction: string
}

export interface ScrapedRecipe {
    name: string
    ingredients: ScrapedIngredient[]
    instructions: ScrapedInstruction[]
    sourceNotes?: string
    extractionTier: 'jsonld' | 'stored-rule' | 'heuristic' | 'ai-generated' | 'legacy'
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** Leading bullet/square glyphs some recipe themes leave in <li> text. */
const stripListMarkers = (text: string): string =>
    text.replace(/^[▢□▪◦•*•\-–]+\s*/, '').trim()

/** Meta lines (prep time, yield, author bylines) that leak into step lists. */
const METALINE_RE = /^(prep|cook(ing)?|total|additional|rest(ing)?|chill(ing)?|inactive|active)?\s*time[:\s.]/i

/**
 * Resolves a stored/cssPath selector defensively — paths were built from
 * real DOM but a selector could still be unparsable (or the DOM changed on
 * a per-page basis). Returns null when unresolvable.
 */
const safeResolve = ($: cheerio.CheerioAPI, cssPath: string) => {
    try {
        return $(cssPath)
    } catch {
        return null
    }
}

const FALLBACK_UA = 'curl/8.0.1'

const axiosGet = async (url: string, userAgent: string) =>
    axios.get(url, {
        headers: {
            'User-Agent': userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        validateStatus: null,
        responseType: 'text'
    })

const BOT_CHALLENGE_RE = /_fs-ch-|challenge-platform|cf-browser-verification|captcha/i

/** Detects bot-challenge / stub pages: tiny documents that are clearly not recipes. */
const isChallengePage = (html: string): boolean =>
    html.length < 8000 && BOT_CHALLENGE_RE.test(html)

export const fetchHtml = async (url: string): Promise<string> =>
    (await fetchHtmlWithMeta(url)).html

export interface FetchedPage {
    html: string
    userAgent: 'browser' | 'curl'
}

export const fetchHtmlWithMeta = async (url: string): Promise<FetchedPage> => {
    // Primary: full browser UA. Some sites reject it (bot checks return 403 or
    // a challenge stub) — those fall back to a plain curl UA, the same trick
    // the facebook scraper uses.
    const attempt = async (userAgent: string) => {
        try {
            return await axiosGet(url, userAgent)
        } catch {
            return null
        }
    }

    let response: any = await attempt(BROWSER_UA)
    let userAgent: 'browser' | 'curl' = 'browser'
    if (!response || response.status !== 200 || isChallengePage(response.data)) {
        const fallback = await attempt(FALLBACK_UA)
        if (fallback && fallback.status === 200 && !isChallengePage(fallback.data)) {
            response = fallback
            userAgent = 'curl'
        }
    }

    if (!response) throw new Error(`Request to ${url} failed`)
    if (response.status !== 200) {
        throw new Error(`Request failed with status ${response.status}`)
    }
    const html = typeof response.data === 'string' ? response.data : String(response.data)
    return { html, userAgent }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const validateExtraction = (recipe: Partial<ScrapedRecipe>): boolean => {
    if (!recipe.ingredients || recipe.ingredients.length < 1) return false
    if (!recipe.instructions || recipe.instructions.length < 1) return false
    const ingOk = recipe.ingredients.some(i => (i.ingredient || '').trim().length > 1)
    const insOk = recipe.instructions.some(i => (i.instruction || '').trim().length > 15)
    return ingOk && insOk
}

// ---------------------------------------------------------------------------
// Tier 1: JSON-LD (schema.org Recipe)
// ---------------------------------------------------------------------------

const collectJsonLdRecipes = (html: string): any[] => {
    const out: any[] = []
    const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(html)) !== null) {
        const raw = match[1].trim()
        if (!raw) continue
        try {
            const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''))
            const queue = Array.isArray(parsed) ? [...parsed] : [parsed]
            while (queue.length) {
                const node = queue.shift()
                if (!node || typeof node !== 'object') continue
                if (Array.isArray(node['@graph'])) queue.push(...node['@graph'])
                const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']]
                if (types && types.map(String).some(t => t.toLowerCase() === 'recipe')) out.push(node)
            }
        } catch {
            // malformed JSON-LD — skip
        }
    }
    return out
}

export const extractJsonLd = (html: string): ScrapedRecipe | null => {
    const recipes = collectJsonLdRecipes(html)
    if (recipes.length === 0) return null
    const r = recipes[0]

    const name = typeof r.name === 'string' ? r.name.trim() : ''

    const ingredients: ScrapedIngredient[] = (Array.isArray(r.recipeIngredient)
        ? r.recipeIngredient
        : Array.isArray(r.ingredients) ? r.ingredients : []
    ).filter((x: any) => typeof x === 'string' && x.trim())
        .map((x: string) => ({ ingredient: x.trim(), converted: safeConvert(x) }))

    const instructions: ScrapedInstruction[] = []
    const rawInstructions = Array.isArray(r.recipeInstructions)
        ? r.recipeInstructions
        : typeof r.recipeInstructions === 'string' ? [r.recipeInstructions] : []
    let step = 1
    for (const item of rawInstructions) {
        let text = ''
        if (typeof item === 'string') text = item
        else if (item && typeof item === 'object') {
            text = typeof item.text === 'string' ? item.text : ''
            if (!text && item.itemListElement) {
                const nested = Array.isArray(item.itemListElement) ? item.itemListElement : []
                text = nested.map((n: any) => (typeof n === 'string' ? n : n?.text || '')).filter(Boolean).join(' ')
            }
        }
        text = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        if (text) instructions.push({ stepNumber: step++, instruction: text })
    }

    const notesParts: string[] = []
    const rawNotes = r.recipeNotes ?? r.tip ?? r.tips
    if (typeof rawNotes === 'string') notesParts.push(rawNotes)
    else if (Array.isArray(rawNotes)) notesParts.push(...rawNotes.filter((n: any) => typeof n === 'string'))

    const recipe: ScrapedRecipe = {
        name,
        ingredients,
        instructions,
        sourceNotes: notesParts.join('\n\n').trim() || undefined,
        extractionTier: 'jsonld'
    }
    return validateExtraction(recipe) ? recipe : null
}

const safeConvert = (text: string): ReturnType<typeof convertMetricReading> | null => {
    try {
        return convertMetricReading(text)
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// Tier 2: Stored rules (cheerio selectors from SiteScrapeRule)
// ---------------------------------------------------------------------------

interface RuleSelectors {
    name?: string
    ingredients?: { container?: string; item?: string; name?: string; amount?: string; unit?: string; note?: string }
    instructions?: { container?: string; item?: string; text?: string; note?: string }
    notes?: { container?: string; item?: string }
}

export const applyCssRule = (html: string, selectors: RuleSelectors): ScrapedRecipe | null => {
    const $ = cheerio.load(html)
    const recipe: Partial<ScrapedRecipe> = { name: '', ingredients: [], instructions: [] }

    if (selectors.name) recipe.name = elementText($, $(selectors.name).first())

    const ingContainer = selectors.ingredients?.container
        ? $(selectors.ingredients.container).first()
        : $.root()
    const ingItems = selectors.ingredients?.item
        ? ingContainer.find(selectors.ingredients.item).toArray()
        : ingContainer.find('li').toArray()
    for (const item of ingItems) {
        const $item = $(item)
        const amount = selectors.ingredients?.amount ? elementText($, $item.find(selectors.ingredients.amount).first()) : ''
        const unit = selectors.ingredients?.unit ? elementText($, $item.find(selectors.ingredients.unit).first()) : ''
        const name = selectors.ingredients?.name
            ? elementText($, $item.find(selectors.ingredients.name).first())
            : elementText($, $item)
        const note = selectors.ingredients?.note ? elementText($, $item.find(selectors.ingredients.note).first()) : ''
        const full = [amount, unit, name, note].filter(Boolean).join(' ').trim()
        if (full) recipe.ingredients!.push({ ingredient: full, converted: safeConvert(full) })
    }

    const insContainer = selectors.instructions?.container
        ? $(selectors.instructions.container).first()
        : $.root()
    const insItems = selectors.instructions?.item
        ? insContainer.find(selectors.instructions.item).toArray()
        : insContainer.find('ol li, p').toArray()
    let step = 1
    for (const item of insItems) {
        const $item = $(item)
        let text = selectors.instructions?.text
            ? elementText($, $item.find(selectors.instructions.text).first())
            : elementText($, $item)
        text = text.replace(/<[^>]*>/g, '').trim()
        if (text) recipe.instructions!.push({ stepNumber: step++, instruction: text })
    }

    if (selectors.notes?.container) {
        const notesContainer = $(selectors.notes.container).first()
        const notesItems = selectors.notes.item
            ? notesContainer.find(selectors.notes.item).toArray()
            : [notesContainer]
        const notesText = notesItems.map(n => elementText($, n)).filter(Boolean).join('\n\n')
        if (notesText.trim()) recipe.sourceNotes = notesText.trim()
    }

    const result: ScrapedRecipe = {
        name: recipe.name || '',
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        sourceNotes: recipe.sourceNotes,
        extractionTier: 'stored-rule'
    }
    return validateExtraction(result) ? result : null
}

interface StoredRuleMatch {
    recipe: ScrapedRecipe
    ruleId: string
}

const tryStoredRules = async (domain: string, html: string): Promise<StoredRuleMatch | null> => {
    await dbConnect()
    const doc = await SiteScrapeRule.findOne({ domain }).lean()
    if (!doc || !Array.isArray(doc.rules) || doc.rules.length === 0) return null

    const ordered = [...doc.rules].sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
    for (const rule of ordered) {
        if (rule.format !== 'css' || !rule.selectors) continue
        let result: ScrapedRecipe | null = null
        try {
            result = applyCssRule(html, rule.selectors as RuleSelectors)
        } catch (err) {
            // Malformed selector — count as failure and move on to the next rule
            result = null
        }
        const success = result !== null
        await SiteScrapeRule.updateOne(
            { domain, 'rules.id': rule.id },
            {
                $inc: success ? { 'rules.$.successCount': 1 } : { 'rules.$.failCount': 1 },
                $set: { 'rules.$.lastUsedAt': new Date() }
            }
        ).catch(() => { })
        if (success) return { recipe: result!, ruleId: rule.id }
    }
    return null
}

// ---------------------------------------------------------------------------
// Tier 3: Heuristic extraction from pre-parse candidates
// ---------------------------------------------------------------------------

export const heuristicFromCandidates = (html: string, pre: PreParseResult): ScrapedRecipe | null => {
    const $ = cheerio.load(html)

    const extractSection = (category: ScrapeCategory): string[] => {
        const values: string[] = []
        for (const candidate of pre.candidates[category] || []) {
            const resolved = safeResolve($, candidate.cssPath)
            if (!resolved || resolved.length === 0) continue
            const el = resolved.first()
            if (el.length === 0) continue
            // Remove nested candidates of the same category to avoid double text
            const section = el.clone()
            for (const inner of pre.candidates[category] || []) {
                if (inner.cssPath === candidate.cssPath) continue
                try {
                    section.find(inner.cssPath).remove()
                } catch {
                    // unparsable nested path — leave the sub-tree in place
                }
            }
            // Prefer list items; fall back to paragraphs
            let items: any[] = section.find('li').toArray()
            if (items.length === 0) items = section.find('p').toArray()
            if (items.length === 0) items = [section as any]
            for (const item of items) {
                const text = stripListMarkers(elementText($, item).replace(/<[^>]*>/g, '').trim())
                if (text) values.push(text)
            }
            if (values.length > 0) break // use the best-scoring section only
        }
        return values
    }

    const ingredientTexts = extractSection('ingredients')
    const instructionTexts = extractSection('instructions')
    const noteTexts = extractSection('notes')

    if (ingredientTexts.length === 0 || instructionTexts.length === 0) return null

    const name = elementText($, $('h1').first()) || ''

    const recipe: ScrapedRecipe = {
        name,
        ingredients: ingredientTexts.map(t => ({ ingredient: t, converted: safeConvert(t) })),
        instructions: instructionTexts
            .map((t, i) => ({ stepNumber: i + 1, instruction: t }))
            .filter(s => !METALINE_RE.test(s.instruction) && !/^author[:\s]/i.test(s.instruction)),
        sourceNotes: noteTexts.length ? noteTexts.join('\\n\\n') : undefined,
        extractionTier: 'heuristic'
    }
    return validateExtraction(recipe) ? recipe : null
}

// ---------------------------------------------------------------------------
// Tier 4: AI-generated rule (Phase 3)
// ---------------------------------------------------------------------------

interface AiRuleMatch {
    recipe: ScrapedRecipe
    ruleId: string | null   // null when data is returned but no reproducible rule persisted
}

const tryAiGeneratedRule = async (url: string, html: string, pre: PreParseResult): Promise<AiRuleMatch | null> => {
    try {
        const { rule, recipe } = await generateScrapeRule(url, html, pre)
        if (!rule && !recipe) return null

        // Prefer data extracted by actually APPLYING the generated rule to the
        // page — that is the only way to guarantee the rule is reusable next
        // time. Fall back to the AI's own extraction only when the selectors
        // don't produce a valid result (return data, but don't persist a
        // rule that can't reproduce it).
        let validated: ScrapedRecipe | null = null
        let ruleId: string | null = null
        if (rule) {
            let applied: ScrapedRecipe | null = null
            try {
                applied = applyCssRule(html, rule as RuleSelectors)
            } catch {
                applied = null
            }
            if (applied) {
                validated = { ...applied, extractionTier: 'ai-generated' }
            }
        }
        if (!validated && recipe && validateExtraction(recipe)) {
            console.warn('[recipeScrape] AI recipe data valid but selectors failed validation — returning data without persisting rule')
            return { recipe: { ...recipe, extractionTier: 'ai-generated' }, ruleId: null }
        }
        if (!validated) return null

        // Persist: append alongside existing rules so multi-layout sites keep
        // their old definitions as fallbacks.
        await dbConnect()
        const existing = await SiteScrapeRule.findOne({ domain: pre.domain })
        const ruleDoc = {
            id: `ai-${Date.now()}`,
            format: 'css' as const,
            selectors: rule,
            confidence: 0.5,
            successCount: 0,
            failCount: 0,
            exampleHtmlHash: pre.htmlHash,
            generatedBy: 'ai',
            createdAt: new Date(),
            lastUsedAt: new Date()
        }
        if (existing) {
            const duplicate = existing.rules.some((r: any) =>
                JSON.stringify(r.selectors) === JSON.stringify(rule)
            )
            if (!duplicate) {
                existing.rules.push(ruleDoc)
                await existing.save()
            }
        } else {
            await SiteScrapeRule.create({ domain: pre.domain, rules: [ruleDoc] })
        }
        return { recipe: validated, ruleId: ruleDoc.id }
    } catch (err) {
        console.error('[recipeScrape] AI rule generation failed:', err)
        return null
    }
}

// ---------------------------------------------------------------------------
// SiteHtmlIndex persistence
// ---------------------------------------------------------------------------

export const loadOrRunPreParse = async (url: string, html: string): Promise<PreParseResult> => {
    const sig = computePageSignature(url, html)
    await dbConnect()
    const cached = await SiteHtmlIndex.findOne({
        pageSignature: sig.pageSignature,
        htmlHash: sig.htmlHash,
        synonymsVersion: SYNONYMS_VERSION
    }).lean()

    if (cached && cached.fragments && Object.keys(cached.fragments || {}).length > 0) {
        await SiteHtmlIndex.updateOne({ _id: cached._id }, { $set: { lastUsedAt: new Date() } }).catch(() => { })
        return {
            pageSignature: cached.pageSignature,
            domain: cached.domain,
            htmlHash: cached.htmlHash,
            synonymsVersion: cached.synonymsVersion,
            candidates: cached.candidates as any,
            fragments: cached.fragments as any,
            preParseMs: 0
        }
    }

    const pre = preParseHtml(url, html)
    // Replace any stale entry for this page (layout drift or synonym bump)
    await SiteHtmlIndex.deleteMany({ pageSignature: pre.pageSignature }).catch(() => { })
    await SiteHtmlIndex.create({
        domain: pre.domain,
        pageSignature: pre.pageSignature,
        htmlHash: pre.htmlHash,
        synonymsVersion: pre.synonymsVersion,
        candidates: pre.candidates,
        fragments: pre.fragments,
        preParseMs: pre.preParseMs
    }).catch(err => console.error('[recipeScrape] Failed to persist SiteHtmlIndex:', err))
    return pre
}

// ---------------------------------------------------------------------------
// Scrape logging (never blocks or fails a scrape)
// ---------------------------------------------------------------------------

export interface ScrapeOutcomeContext {
    url: string
    domain: string
    pageSignature?: string
    htmlHash?: string
    userAgent: 'browser' | 'curl'
    extractionTier?: ScrapedRecipe['extractionTier']
    ruleId?: string | null
    heuristicUsed?: boolean
    aiUsed?: boolean
    success: boolean
    errorMessage?: string
    ingredientCount?: number
    instructionCount?: number
    hasSourceNotes?: boolean
    tookMs: number
}

const logScrapeOutcome = (outcome: ScrapeOutcomeContext): void => {
    ScrapeLog.create({
        domain: outcome.domain,
        url: outcome.url,
        pageSignature: outcome.pageSignature,
        htmlHash: outcome.htmlHash,
        extractionTier: outcome.extractionTier,
        ruleId: outcome.ruleId || undefined,
        heuristicUsed: outcome.heuristicUsed === true,
        aiUsed: outcome.aiUsed === true,
        sourceFallback: outcome.userAgent,
        ingredientCount: outcome.ingredientCount || 0,
        instructionCount: outcome.instructionCount || 0,
        hasSourceNotes: outcome.hasSourceNotes === true,
        tookMs: outcome.tookMs,
        success: outcome.success,
        errorMessage: outcome.errorMessage
    }).catch((err: any) =>
        console.error('[recipeScrape] ScrapeLog write failed:', err?.message || err)
    )
}

const summarizeForLog = (r: ScrapedRecipe) => ({
    extractionTier: r.extractionTier,
    ingredientCount: r.ingredients.length,
    instructionCount: r.instructions.length,
    hasSourceNotes: !!r.sourceNotes,
    ruleId: undefined as string | undefined,
    heuristicUsed: r.extractionTier === 'heuristic',
    aiUsed: r.extractionTier === 'ai-generated'
})

// ---------------------------------------------------------------------------
// Cascade orchestrator
// ---------------------------------------------------------------------------

export interface ScrapeOptions {
    /** Test/debug hook: skip the JSON-LD tier to force lower tiers. */
    skipJsonLd?: boolean
}

export const scrapeRecipe = async (url: string, options: ScrapeOptions = {}): Promise<ScrapedRecipe> => {
    const started = Date.now()

    const finishSuccess = (recipe: ScrapedRecipe, extra: { pageSignature?: string; htmlHash?: string; ruleId?: string | null; userAgent: 'browser' | 'curl' }): ScrapedRecipe => {
        logScrapeOutcome({
            url,
            domain: new URL(url).hostname.replace(/^www\./, ''),
            pageSignature: extra.pageSignature,
            htmlHash: extra.htmlHash,
            userAgent: extra.userAgent,
            ...summarizeForLog(recipe),
            ruleId: extra.ruleId || undefined,
            success: true,
            tookMs: Date.now() - started
        })
        return recipe
    }

    let userAgent: 'browser' | 'curl' = 'browser'
    let sig: ReturnType<typeof computePageSignature> | null = null
    try {
        const fetched = await fetchHtmlWithMeta(url)
        userAgent = fetched.userAgent
        const html = fetched.html
        sig = computePageSignature(url, html)

        // Tier 1: JSON-LD — needs no pre-parse
        if (!options.skipJsonLd) {
            const jsonLd = extractJsonLd(html)
            if (jsonLd) return finishSuccess(jsonLd, { pageSignature: sig.pageSignature, htmlHash: sig.htmlHash, userAgent })
        }

        const pre = await loadOrRunPreParse(url, html)

        // Tier 2: stored AI-generated rules
        const stored = await tryStoredRules(pre.domain, html)
        if (stored) return finishSuccess(stored.recipe, { pageSignature: pre.pageSignature, htmlHash: pre.htmlHash, ruleId: stored.ruleId, userAgent })

        // Tier 3: heuristics from pre-parse candidates
        const heuristic = heuristicFromCandidates(html, pre)
        if (heuristic) return finishSuccess(heuristic, { pageSignature: pre.pageSignature, htmlHash: pre.htmlHash, userAgent })

        // Tier 4: AI rule generation from stored fragments
        const ai = await tryAiGeneratedRule(url, html, pre)
        if (ai) return finishSuccess(ai.recipe, { pageSignature: pre.pageSignature, htmlHash: pre.htmlHash, ruleId: ai.ruleId, userAgent })

        throw Object.assign(new Error('Could not extract a recipe from this site'), {
            extractionAttempted: ['jsonld', 'stored-rule', 'heuristic', 'ai-generated']
        })
    } catch (err: any) {
        logScrapeOutcome({
            url,
            domain: new URL(url).hostname.replace(/^www\./, ''),
            pageSignature: sig?.pageSignature,
            htmlHash: sig?.htmlHash,
            userAgent,
            success: false,
            errorMessage: err?.message || String(err),
            tookMs: Date.now() - started
        })
        throw err
    }
}
