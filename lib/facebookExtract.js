// Helpers for pulling a post's caption and preview image out of Facebook's
// non-logged-in HTML (og: meta tags) and the token-free oEmbed endpoint.

const FACEBOOK_OEMBED_ENDPOINTS = ['oembed_video', 'oembed_post']

const safeFromCodePoint = (code) => {
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
    try {
        return String.fromCodePoint(code)
    } catch {
        return ''
    }
}

const decodeEntities = (input) => {
    if (!input) return ''
    return input
        .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => safeFromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (m, dec) => safeFromCodePoint(parseInt(dec, 10)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Meta tags render as property-then-content or content-then-property depending
// on the page, and og:image must not be confused with og:image:alt.
const extractMetaContent = (html, property) => {
    if (!html || !property) return ''
    const escaped = escapeRegExp(property)
    const patterns = [
        new RegExp(`<meta[^>]*property=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escaped}["']`, 'i')
    ]
    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) return decodeEntities(match[1])
    }
    return ''
}

// The oEmbed html embed holds the FULL caption inside the blockquote's <p>
// ("<p>caption</p>Posted by <a>author</a> on <date>") where og:description is
// truncated for long posts.
const extractOembedCaption = (embedHtml) => {
    if (!embedHtml) return ''
    const blockquoteMatch = embedHtml.match(/<blockquote[^>]*>[\s\S]*?<a[^>]*><\/a>\s*<p>([\s\S]*?)<\/p>/i)
    const captionMatch = blockquoteMatch || embedHtml.match(/<p>([\s\S]*?)<\/p>/i)
    const captionHtml = captionMatch ? captionMatch[1] : ''
    if (!captionHtml) return ''
    const text = decodeEntities(
        captionHtml
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
    ).trim()
    return text
}

const isFacebookUrl = (url) => {
    if (!url) return false
    try {
        const parsed = new URL(url)
        const host = parsed.hostname.toLowerCase()
        return (
            host === 'fb.watch' ||
            host === 'facebook.com' ||
            host === 'www.facebook.com' ||
            host === 'm.facebook.com' ||
            host === 'web.facebook.com'
        )
    } catch {
        return false
    }
}

export {
    FACEBOOK_OEMBED_ENDPOINTS,
    decodeEntities,
    extractMetaContent,
    extractOembedCaption,
    isFacebookUrl
}
