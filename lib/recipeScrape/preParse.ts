import * as cheerio from 'cheerio'
import crypto from 'crypto'
import { SYNONYMS, SYNONYMS_VERSION, scoreAgainstSynonyms } from './synonyms'

export type ScrapeCategory = 'ingredients' | 'instructions' | 'notes'

export interface PreParseCandidate {
    cssPath: string
    score: number
    charCount: number
    snippetHash: string
}

export interface PreParseResult {
    pageSignature: string
    domain: string
    htmlHash: string
    synonymsVersion: number
    candidates: Record<ScrapeCategory, PreParseCandidate[]>
    fragments: Record<string, string>
    preParseMs: number
}

const MAX_SECTIONS_PER_CATEGORY = 3
const MAX_FRAGMENT_CHARS = 6000
const MAX_TOTAL_FRAGMENT_CHARS = 64000
const MIN_SECTION_SCORE = 0.6
const MIN_LIST_CHILDREN = 2

const NOISE_TAGS = 'script, style, noscript, svg, nav, footer, header, aside, form, iframe, img, picture, video, button, input, select, label'

/**
 * Full-page signature used for cache lookup: normalized URL path + html hash.
 */
export const computePageSignature = (url: string, html: string): { domain: string; pageSignature: string; htmlHash: string } => {
    const parsed = new URL(url)
    const domain = parsed.hostname.replace(/^www\./, '')
    const path = parsed.pathname.replace(/\/+$/, '') || '/'
    const htmlHash = crypto.createHash('sha1').update(html).digest('hex')
    return { domain, pageSignature: crypto.createHash('sha1').update(`${domain}${path}`).digest('hex'), htmlHash }
}

/**
 * Escapes characters that would be misread by CSS parsers in class/id
 * fragments (Tailwind classes like "sm:grid" would otherwise parse as
 * pseudo-classes).
 */
const escapeSelectorToken = (token: string): string =>
    token.replace(/([^\w-])/g, '\\$1')

const buildCssPath = ($: cheerio.CheerioAPI, el: any): string => {
    const parts: string[] = []
    let current = el
    let depth = 0
    while (current && current.type === 'tag' && depth < 6) {
        const tag = (current.tagName || '').toLowerCase()
        const $el = $(current)
        const id = $el.attr('id')
        if (id) {
            parts.unshift(`#${escapeSelectorToken(id)}`)
            break
        }
        const classes = ($el.attr('class') || '')
            .split(/\s+/)
            .filter(c => c && !/^[a-z]+-[0-9a-f]{4,}$/i.test(c))
            .slice(0, 3)
            .map(c => `.${escapeSelectorToken(c)}`)
            .join('')
        parts.unshift(classes ? `${tag}${classes}` : tag)
        current = current.parent
        depth++;
    }
    return parts.join(' > ')
}

/** Elements whose attributes mark them as non-recipe page furniture. */
const NOISE_SECTION_RE = /comment|reply|social|share|sidebar|related|newsletter|subscribe|breadcrumb|pagination|author-box|footer|nav-menu|mobile-menu|sign-?in|log-?in|advertisement|adsbygoogle/i

interface ScoredSection {
    el: any
    cssPath: string
    score: number
    headingScore: number
    attrScore: number
    category: ScrapeCategory
}

/**
 * Extracts visible text of an element with tags stripped and whitespace
 * collapsed.
 */
export const elementText = ($: cheerio.CheerioAPI, el: any): string =>
    $(el).text().replace(/\s+/g, ' ').trim()

/**
 * Scores a single element for a category by combining attribute matches
 * (id, class, itemprop, data attributes, aria-label) and nearby heading text.
 */
const scoreElementForCategory = (
    $: cheerio.CheerioAPI,
    el: any,
    category: ScrapeCategory
): { attrScore: number; headingScore: number } => {
    const synonyms = SYNONYMS[category]
    const $el = $(el)
    let attrScore = 0

    const attrText = [
        $el.attr('id'),
        $el.attr('class'),
        $el.attr('itemprop'),
        $el.attr('data-testid'),
        $el.attr('aria-label'),
        ...Object.keys(($el.attr() || {}))
            .filter(k => k.startsWith('data-'))
            .map(k => $el.attr(k)),
    ].filter(Boolean).join(' ')
    attrScore = scoreAgainstSynonyms(attrText, synonyms)

    let headingScore = 0
    const ownHeading = $el.children('h1, h2, h3, h4, h5, h6, legend, summary, [role="heading"]').first()
    const headingText = ownHeading.length
        ? elementText($, ownHeading)
        : elementText($, $el.children().first()).slice(0, 60)
    headingScore = scoreAgainstSynonyms(headingText, synonyms)

    return { attrScore, headingScore }
}

/**
 * Trims an element's HTML to MAX_FRAGMENT_CHARS, cutting mid-child overflow
 * while keeping the opening tag intact.
 */
const trimFragment = ($: cheerio.CheerioAPI, el: any): string => {
    const $el = $(el)
    const clone = $el.clone()
    clone.find(NOISE_TAGS).remove()
    const full = $.html(clone)
    if (full.length <= MAX_FRAGMENT_CHARS) return full

    const $trimmed = clone.clone()
    const children = $trimmed.children().toArray()
    let kept: any[] = []
    let running = 200 // opening tag + margins
    for (const child of children) {
        const childHtml = $.html($(child).clone())
        if (running + childHtml.length > MAX_FRAGMENT_CHARS - 200) break
        kept.push(child)
        running += childHtml.length
    }
    if (kept.length === 0) return full.slice(0, MAX_FRAGMENT_CHARS)
    $trimmed.children().remove()
    $trimmed.append(kept.map(c => $.html($(c).clone())).join(''))
    return $.html($trimmed)
}

/**
 * Pre-parse stage: strips noise, scores elements against the synonym
 * dictionary, and emits capped candidate sections per category with trimmed
 * HTML fragments ready for AI rule generation.
 */
export const preParseHtml = (url: string, html: string): PreParseResult => {
    const started = Date.now()
    const { domain, pageSignature, htmlHash } = computePageSignature(url, html)

    const $ = cheerio.load(html)

    // Remove ld+json scripts only (other scripts/styles already stripped by
    // cheerio's default? no — cheerio keeps them, so remove explicitly but
    // keep a reference for the JSON-LD tier which parses from raw html).
    $('script').each((_, el) => {
        const type = $(el).attr('type') || ''
        if (!type.includes('ld+json')) $(el).remove()
    })
    $(NOISE_TAGS).not('script').remove()
    $('[hidden], [aria-hidden="true"], [style*="display:none"], [style*="display: none"]').remove()
    // Comments
    $('*')
        .contents()
        .filter((_, n) => n.type === 'comment')
        .remove()

    const scored: ScoredSection[] = []

    const considerElement = (el: any, category: ScrapeCategory) => {
        const $el = $(el)

        // Skip obvious page furniture (comments, sharing, sidebars, ...)
        // — check this element AND its lineage, since a scoring child may be
        // nested inside a comments section.
        let ancestor: any = el
        for (let i = 0; i < 5 && ancestor && ancestor.type === 'tag'; i++) {
            const $anc = $(ancestor)
            const ancAttributes = [$anc.attr('id'), $anc.attr('class')].filter(Boolean).join(' ')
            if (NOISE_SECTION_RE.test(ancAttributes)) return
            ancestor = ancestor.parent
        }
        const ownAttributes = [
            $el.attr('id'), $el.attr('class'), ...Object.keys(($el.attr() || {})).map(k => k)
        ].filter(Boolean).join(' ')
        if (NOISE_SECTION_RE.test(ownAttributes)) return
        const { attrScore, headingScore } = scoreElementForCategory($, el, category)
        if (attrScore < MIN_SECTION_SCORE && headingScore < MIN_SECTION_SCORE) return

        const childCount = $el.children('li, p, div, ol, ul').length
        const listChildren = $el.find('li').length
        // Containers need some mass: either list children or several
        // paragraphs. Headings alone don't count.
        const hasMass = listChildren >= MIN_LIST_CHILDREN || childCount >= MIN_LIST_CHILDREN || $el.is('ul, ol')
        if (!hasMass) return

        // Prefer the innermost reasonable container: if a child also scores,
        // skip this outer wrapper (it would produce overlapping fragments).
        const cssPath = buildCssPath($, el)
        const score = Math.max(attrScore, headingScore * 0.95) +
            (listChildren >= 3 ? 0.1 : 0) +
            ($el.is('ul, ol') ? 0.15 : 0)

        scored.push({ el, cssPath, score, headingScore, attrScore, category })
    }

    const allElements = $('body *').toArray()
    for (const category of ['ingredients', 'instructions', 'notes'] as ScrapeCategory[]) {
        for (const el of allElements) {
            considerElement(el, category)
        }
    }

    // Dedup overlapping candidates within a category: if one element's path
    // is a prefix container of another, keep the inner one when both scored.
    const candidates: Record<ScrapeCategory, PreParseCandidate[]> = { ingredients: [], instructions: [], notes: [] }
    const fragments: Record<string, string> = {}

    for (const category of ['ingredients', 'instructions', 'notes'] as ScrapeCategory[]) {
        const sectionScored = scored
            .filter(s => s.category === category)
            .sort((a, b) => b.score - a.score)

        const chosen: ScoredSection[] = []
        for (const section of sectionScored) {
            const path = section.cssPath
            const overlaps = chosen.some(c =>
                path.includes(c.cssPath) || c.cssPath.includes(path)
            )
            if (!overlaps) chosen.push(section)
            if (chosen.length >= MAX_SECTIONS_PER_CATEGORY) break
        }

        let totalChars = 0
        for (const section of chosen) {
            const fragment = trimFragment($, section.el)
            const charCount = fragment.length
            if (totalChars + charCount > MAX_TOTAL_FRAGMENT_CHARS) break
            totalChars += charCount
            const snippetHash = crypto.createHash('sha1').update(fragment).digest('hex')
            fragments[section.cssPath] = fragment
            candidates[category].push({
                cssPath: section.cssPath,
                score: Number(section.score.toFixed(3)),
                charCount,
                snippetHash
            })
        }
    }

    return {
        pageSignature,
        domain,
        htmlHash,
        synonymsVersion: SYNONYMS_VERSION,
        candidates,
        fragments,
        preParseMs: Date.now() - started
    }
}
