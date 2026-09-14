import * as cheerio from 'cheerio'

export interface RecipeSourceCandidate {
    title: string
    url: string
    snippet: string
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// Domains that reliably expose a full recipe; surfaced first so the user sees
// importable options before blogs/aggregators.
const PREFERRED_DOMAINS = [
    'recipetineats.com',
    'taste.com.au',
    'bbcgoodfood.com',
    'seriouseats.com',
    'bonappetit.com',
    'simplyrecipes.com',
    'allrecipes.com',
    'food.com',
    'epicurious.com',
    'vegkit.com',
    'thespruceeats.com',
    'cooking.nytimes.com',
    'wikipedia.org'
]

// Base domains we know cannot be web-imported. Matched on the host (and any
// subdomain), so only the base is listed. Extend this list as needed.
export const NO_EXTRACT_DOMAINS = [
    'tasteatlas.com',
    'pinterest.com',
    'instagram.com'
]

// Country TLDs whose sites are overwhelmingly not in English. Results on these
// are dropped so the recipe we import is English. Extend as needed.
export const NON_ENGLISH_TLDS = [
    'de', 'fr', 'it', 'es', 'nl', 'ru', 'jp', 'cn', 'kr', 'br', 'mx', 'ar',
    'tr', 'pl', 'se', 'no', 'dk', 'fi', 'pt', 'gr', 'cz', 'hu', 'ro', 'th',
    'vn', 'id', 'il', 'ua'
]

// DuckDuckGo region/language hint — biases results to English (US).
const SEARCH_LOCALE = 'us-en'

/** Unwraps DuckDuckGo's /l/?uddg=<encoded> redirect into the real target url. */
export const extractResultUrl = (href: string | undefined): string => {
    if (!href) return ''
    let value = href.trim()
    if (value.startsWith('//')) value = `https:${value}`
    try {
        const url = new URL(value)
        const uddg = url.searchParams.get('uddg')
        if (uddg) return decodeURIComponent(uddg)
    } catch {
        const match = value.match(/[?&]uddg=([^&]+)/)
        if (match) return decodeURIComponent(match[1])
    }
    return value
}

const hostOf = (url: string): string => {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return ''
    }
}

const matchesDomain = (host: string, domain: string): boolean =>
    host === domain || host.endsWith(`.${domain}`)

const isPreferred = (url: string): boolean => {
    const host = hostOf(url)
    return PREFERRED_DOMAINS.some(d => matchesDomain(host, d))
}

/** True for hosts on the no-web-extract list (TasteAtlas etc.). */
export const isBlockedSource = (url: string): boolean => {
    const host = hostOf(url)
    return NO_EXTRACT_DOMAINS.some(d => matchesDomain(host, d))
}

/** True for hosts on a country TLD we treat as non-English. */
export const hasNonEnglishTld = (url: string): boolean => {
    const host = hostOf(url)
    return NON_ENGLISH_TLDS.some(tld => host.endsWith(`.${tld}`))
}

/** DuckDuckGo's own ad/tracking links resolve back to its own domain. */
const isAdOrInternal = (url: string): boolean => {
    const host = hostOf(url)
    return host === 'duckduckgo.com'
        || host.endsWith('.duckduckgo.com')
        || /\/y\.js\b|[?&]ad_provider=|[?&]ad_domain=/i.test(url)
}

const looksLikeRecipeUrl = (url: string): boolean =>
    /recipe|recept|recette|ricetta|kochrezept|rezept/i.test(url)

/** Preferred recipe sites first, then recipe-shaped URLs, then the rest. */
const rank = (url: string): number =>
    (isPreferred(url) ? 2 : 0) + (looksLikeRecipeUrl(url) ? 1 : 0)

/** Parses a DuckDuckGo HTML results page. Pure, so it can be unit-tested. */
export const parseDuckDuckGoHtml = (html: string): RecipeSourceCandidate[] => {
    if (!html || typeof html !== 'string') return []
    const $ = cheerio.load(html)
    const out: RecipeSourceCandidate[] = []
    const seen = new Set<string>()

    $('.result, .web-result').each((_, el) => {
        const $el = $(el)
        const anchor = $el.find('a.result__a').first()
        const url = extractResultUrl(anchor.attr('href'))
        if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return
        if (isAdOrInternal(url) || isBlockedSource(url) || hasNonEnglishTld(url)) return
        const title = anchor.text().replace(/\s+/g, ' ').trim()
        if (!title) return
        const snippet = $el.find('.result__snippet').first().text().replace(/\s+/g, ' ').trim()
        seen.add(url)
        out.push({ title, url, snippet })
    })

    // Preferred recipe domains first, then recipe-shaped URLs, else DDG order.
    return out.sort((a, b) => rank(b.url) - rank(a.url))
}

/** Guarantees the literal "recipe" keyword is present in the query. */
const ensureRecipeKeyword = (query: string): string =>
    /\brecipe\b/i.test(query) ? query : `${query} recipe`.trim()

/**
 * Searches the web for recipe sources via DuckDuckGo's HTML endpoint (no API
 * key). Results are biased to English and filtered to importable domains.
 * Returns an empty array on failure so callers can degrade gracefully.
 */
export const searchRecipeSources = async (query: string, limit = 12): Promise<RecipeSourceCandidate[]> => {
    const q = ensureRecipeKeyword((query || '').trim())
    if (!q) return []
    console.log(`[dishLists] DuckDuckGo search: "${q}"`)
    try {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=${SEARCH_LOCALE}`, {
            headers: {
                'User-Agent': BROWSER_UA,
                Accept: 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            signal: AbortSignal.timeout(20000)
        })
        if (!res.ok) return []
        const html = await res.text()
        return parseDuckDuckGoHtml(html).slice(0, limit)
    } catch (err: any) {
        console.error('[dishLists] Search failed:', err?.message || err)
        return []
    }
}
