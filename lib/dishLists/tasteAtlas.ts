import * as cheerio from 'cheerio'

export interface ParsedDish {
    slug: string
    rank?: number
    name: string
    category?: string
    rating?: number
    location: {
        country?: string
        region?: string
        city?: string
        regionId?: string
    }
    description?: string
    imageOriginalUrl?: string
    sourceUrl: string
    recipeSourceUrl?: string
}

const ORIGIN = 'https://www.tasteatlas.com'

/**
 * The TasteAtlas pages declare `<base href="/">`, so relative links resolve
 * against the site root. We always resolve to the root (not `/best/{slug}`).
 */
export const resolveTasteAtlasUrl = (href: string | undefined): string | undefined => {
    if (!href) return undefined
    const raw = href.trim()
    if (!raw) return undefined
    if (/^https?:\/\//i.test(raw)) return raw
    return `${ORIGIN}/${raw.replace(/^\/+/, '')}`
}

export const slugFromUrl = (value: string | undefined): string => {
    if (!value) return ''
    const withoutQuery = value.split(/[?#]/)[0]
    const clean = withoutQuery.replace(/\/+$/, '')
    const parts = clean.split('/')
    return (parts[parts.length - 1] || '').toLowerCase()
}

const cleanText = (value: string | undefined): string =>
    (value || '').replace(/\s+/g, ' ').trim()

/**
 * Splits the location line ("Naples, Italy" / "Oaxaca, Mexico" / "Italy") into
 * structure. The last comma-separated part is the country; anything before it
 * is treated as the region/city.
 */
export const parseLocationText = (text: string): ParsedDish['location'] => {
    const cleaned = cleanText(text)
    if (!cleaned) return {}
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length === 0) return {}
    if (parts.length === 1) return { country: parts[0] }
    const country = parts[parts.length - 1]
    const place = parts.slice(0, parts.length - 1).join(', ')
    return { country, region: place, city: place }
}

const parseRating = (value: string | undefined): number | undefined => {
    const match = cleanText(value).match(/\d+(?:\.\d+)?/)
    if (!match) return undefined
    const n = Number(match[0])
    return Number.isFinite(n) ? n : undefined
}

const looksLikeRecipeLink = (href: string, text: string): boolean =>
    /\/recipe$/i.test(href) || /authentic recipe/i.test(text)

// ---------------------------------------------------------------------------
// Shared field helpers
// ---------------------------------------------------------------------------

const LONG_TEXT_MIN = 40

const RESERVED_SLUGS = new Set([
    'best', 'recipes', 'recipe', 'foods', 'dishes', 'food', 'drinks', 'beverages',
    'map', 'labels', 'label', 'quiz', 'about', 'privacy', 'terms', 'sitemap',
    'contact', 'search', 'login', 'register', 'merch', 'gourmet', 'places',
    'producers', 'awards', 'near'
])

/** True when an href looks like a single-segment dish slug (not nav/recipe). */
const isDishHref = (href: string | undefined): boolean => {
    if (!href) return false
    let h = href.trim()
    if (!h || h.startsWith('#') || /^(mailto:|javascript:)/i.test(h)) return false
    if (/^https?:\/\//i.test(h)) {
        try {
            const u = new URL(h)
            const host = u.hostname.replace(/^www\./, '')
            if (host !== 'tasteatlas.com') return false
            h = u.pathname
        } catch {
            return false
        }
    }
    const path = h.split(/[?#]/)[0].replace(/^\/+/, '').replace(/\/+$/, '')
    if (!path || path.includes('/')) return false
    if (!/^[a-z0-9][a-z0-9-]*$/.test(path)) return false
    return !RESERVED_SLUGS.has(path)
}

const firstText = ($: cheerio.CheerioAPI, $c: cheerio.Cheerio<any>, selectors: string[]): string => {
    for (const sel of selectors) {
        const t = cleanText($c.find(sel).first().text())
        if (t) return t
    }
    return ''
}

const extractImage = ($: cheerio.CheerioAPI, $c: cheerio.Cheerio<any>): string | undefined => {
    const imgs = $c.find('img').toArray()
    for (const img of imgs) {
        const src = ($(img).attr('src') || $(img).attr('data-src') || '').trim()
        if (!src) continue
        if (src.startsWith('data:')) continue
        return /^https?:\/\//i.test(src) ? src : resolveTasteAtlasUrl(src)
    }
    return undefined
}

const extractDescription = ($: cheerio.CheerioAPI, $c: cheerio.Cheerio<any>, exclude: string[]): string | undefined => {
    const selectors = [
        '.description', '.item-description', '.dish-description',
        '[class*="description"]', '.summary', '[class*="summary"]',
        '.intro', '[class*="intro"]'
    ]
    for (const sel of selectors) {
        const t = cleanText($c.find(sel).first().text())
        if (t.length >= LONG_TEXT_MIN && !exclude.includes(t)) return t
    }
    // Fallback for templates without a description class: the longest paragraph.
    const paras: string[] = []
    $c.find('p').each((_, el) => {
        const t = cleanText($(el).text())
        if (t.length >= LONG_TEXT_MIN && !exclude.includes(t)) paras.push(t)
    })
    paras.sort((a, b) => b.length - a.length)
    return paras[0]
}

const extractLocation = ($: cheerio.CheerioAPI, $c: cheerio.Cheerio<any>, fallbackText: string): ParsedDish['location'] => {
    const selectors = [
        '.location', '.item-location', '.region',
        '[class*="location"]', '[class*="region"]', '[class*="country"]',
        '.text'
    ]
    for (const sel of selectors) {
        const $el = $c.find(sel).first()
        if (!$el.length) continue
        // Region + country are often two separate links/spans.
        const parts = $el.find('span, a').toArray()
            .map(el => cleanText($(el).text()))
            .filter(Boolean)
        const text = parts.length >= 2 ? parts.join(', ') : cleanText($el.text())
        if (text) return parseLocationText(text)
    }
    return parseLocationText(fallbackText)
}

const extractRegionId = ($c: cheerio.Cheerio<any>): string | undefined => {
    const html = $c.html() || ''
    const m = html.match(/regionid=(\d+)/i)
    return m ? m[1] : undefined
}

const findBySelectors = ($: cheerio.CheerioAPI, $c: cheerio.Cheerio<any>, selectors: string[]): cheerio.Cheerio<any> | null => {
    for (const sel of selectors) {
        const $found = $c.find(sel).first()
        if ($found.length) return $found
    }
    return null
}

// ---------------------------------------------------------------------------
// Awards-page parser (.box-holder)
// ---------------------------------------------------------------------------

const parseAwardsHolders = ($: cheerio.CheerioAPI, holders: any[]): ParsedDish[] => {
    const bySlug = new Map<string, ParsedDish>()

    for (const holder of holders) {
        const $h = $(holder)
        const contentLink = $h.find('a.content-holder').first()
        const imgLink = $h.find('a.img-holder').first()
        const href = contentLink.attr('href') || imgLink.attr('href') || ''
        const slug = slugFromUrl(href)
        if (!slug) continue

        const name = cleanText(contentLink.find('.title').first().text())
            || cleanText(imgLink.find('.title').first().text())
            || cleanText($h.find('.title').first().text())
            || firstText($, $h, ['h3', 'h2', 'h4'])
        if (!name) continue

        const category = cleanText(contentLink.find('.subtitle').first().text()) || undefined
        const rating = parseRating(contentLink.find('.rating').first().text())
        const locationText = cleanText(contentLink.find('.text').first().text())
        const location = extractLocation($, $h, locationText)
        const regionId = extractRegionId($h)
        if (regionId) location.regionId = regionId

        const imageOriginalUrl = extractImage($, $h)
        const rankText = cleanText($h.find('.order').first().text())
        const rank = rankText && /^\d+$/.test(rankText) ? Number(rankText) : undefined

        let recipeSourceUrl: string | undefined
        $h.find('a').each((_, a) => {
            if (recipeSourceUrl) return
            const aHref = $(a).attr('href') || ''
            if (looksLikeRecipeLink(aHref, $(a).text())) recipeSourceUrl = resolveTasteAtlasUrl(aHref)
        })

        const description = extractDescription($, $h, [name, category || '', locationText, String(rating ?? '')])

        const candidate: ParsedDish = {
            slug,
            rank,
            name,
            category,
            rating,
            location,
            description,
            imageOriginalUrl,
            sourceUrl: `${ORIGIN}/${slug}`,
            recipeSourceUrl
        }

        const existing = bySlug.get(slug)
        if (!existing || (candidate.rank != null && (existing.rank == null || candidate.rank < existing.rank))) {
            bySlug.set(slug, candidate)
        }
    }

    return Array.from(bySlug.values())
}

// ---------------------------------------------------------------------------
// Generic parser (standard "Top 100" pages + any template with dish links)
// ---------------------------------------------------------------------------

/** Climbs ancestors to find an item container holding an image and real text. */
const findContainer = ($: cheerio.CheerioAPI, $link: cheerio.Cheerio<any>): cheerio.Cheerio<any> | null => {
    let node = $link
    for (let i = 0; i < 6; i++) {
        const $parent = node.parent()
        if (!$parent.length) break
        const hasImage = $parent.find('img').length > 0
        const hasText = cleanText($parent.text()).length >= LONG_TEXT_MIN
        if (hasImage && hasText) return $parent
        node = $parent
    }
    // Loosen: nearest ancestor with either an image or a heading.
    node = $link
    for (let i = 0; i < 6; i++) {
        const $parent = node.parent()
        if (!$parent.length) break
        if ($parent.find('img').length > 0 || $parent.find('h1,h2,h3,h4').length > 0) return $parent
        node = $parent
    }
    return null
}

const parseGeneric = ($: cheerio.CheerioAPI): ParsedDish[] => {
    const bySlug = new Map<string, ParsedDish>()
    const anchors = $('a[href]').toArray()

    for (const a of anchors) {
        const $a = $(a)
        const href = $a.attr('href') || ''
        if (!isDishHref(href)) continue

        // Only treat anchors that actually identify the dish as item links:
        // image links, heading links, or title-styled links. This keeps
        // country/ingredient anchors from creating phantom items.
        const hasImg = $a.find('img').length > 0
        const inHeading = $a.closest('h1, h2, h3, h4').length > 0
        const classy = /img|title|item-link|dish|thumbnail/i.test($a.attr('class') || '')
        if (!hasImg && !inHeading && !classy) continue

        const slug = slugFromUrl(href)
        if (!slug) continue

        const $container = findContainer($, $a)
        if (!$container) continue

        const name = firstText($, $container, ['h1', 'h2', 'h3', 'h4', '.title', '.item-title', '[class*="title"]'])
            || cleanText($a.text())
        if (!name || name.length < 2) continue

        const category = firstText($, $container, ['.subtitle', '.item-subtitle', '[class*="subtitle"]', '[class*="category"]']) || undefined
        const rating = parseRating(firstText($, $container, ['.rating', '[class*="rating"]']))
        const location = extractLocation($, $container, '')
        const regionId = extractRegionId($container)
        if (regionId) location.regionId = regionId

        const imageOriginalUrl = extractImage($, $container)

        const rankText = cleanText($container.find('.order, .rank, [class*="rank"]').first().text())
        const rankMatch = rankText.match(/^\D*(\d{1,3})/)
        const rank = rankMatch ? Number(rankMatch[1]) : undefined

        let recipeSourceUrl: string | undefined
        $container.find('a').each((_, el) => {
            if (recipeSourceUrl) return
            const aHref = $(el).attr('href') || ''
            if (looksLikeRecipeLink(aHref, $(el).text())) recipeSourceUrl = resolveTasteAtlasUrl(aHref)
        })

        const description = extractDescription($, $container, [name, category || '', String(rating ?? '')])

        const existing = bySlug.get(slug)
        if (existing) {
            // Backfill richer data if a later (larger) container has it.
            if (!existing.description && description) existing.description = description
            if (!existing.imageOriginalUrl && imageOriginalUrl) existing.imageOriginalUrl = imageOriginalUrl
            if (!existing.location?.country && location.country) existing.location = location
            continue
        }

        bySlug.set(slug, {
            slug,
            rank,
            name,
            category,
            rating,
            location,
            description,
            imageOriginalUrl,
            sourceUrl: `${ORIGIN}/${slug}`,
            recipeSourceUrl
        })
    }

    return Array.from(bySlug.values())
}

/**
 * Parses a pasted TasteAtlas page into dish entries. Prefers the awards
 * template (.box-holder); otherwise falls back to a generic dish-link scan so
 * standard "Top 100" pages (with descriptions + regions) also work.
 */
export const parseTasteAtlasList = (html: string): ParsedDish[] => {
    if (!html || typeof html !== 'string') return []
    const $ = cheerio.load(html)

    const holders = $('.box-holder').toArray()
    if (holders.length > 0) {
        const parsed = parseAwardsHolders($, holders)
        if (parsed.length > 0) return parsed
    }
    return parseGeneric($)
}

/**
 * Builds minimal items from a pasted newline list of dish URLs/slugs. Names
 * are derived from the slug and can be edited (or enriched) afterwards.
 */
export const parseDishUrlList = (input: string): ParsedDish[] => {
    const seen = new Set<string>()
    const out: ParsedDish[] = []
    for (const line of (input || '').split(/[\r\n,]+/)) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const slug = slugFromUrl(trimmed)
        if (!slug || seen.has(slug)) continue
        seen.add(slug)
        const name = slug
            .split('-')
            .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
            .join(' ')
        out.push({ slug, name, location: {}, sourceUrl: `${ORIGIN}/${slug}` })
    }
    return out
}

// Presets live in a client-safe module so browser bundles don't pull cheerio.
export { TASTEATLAS_PRESETS, getPreset } from './presets'
export type { TasteAtlasPreset } from './presets'
