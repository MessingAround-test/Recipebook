import axios from 'axios'
import { verifyToken } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import {
    FACEBOOK_OEMBED_ENDPOINTS,
    extractMetaContent,
    extractOembedCaption,
    isFacebookUrl
} from '../../../lib/facebookExtract'

const AXIOS_TIMEOUT = 15000

// A browser-like UA gets 400'd by Facebook's bot detection; a plain one is
// served the full page (302 from the share link to the canonical post, with
// og: meta tags included).
const PAGE_USER_AGENT = 'curl/8.0.1'

// The oEmbed endpoint returns the full post caption (og:description is
// truncated for long posts). Resolves to '' when nothing can be fetched.
const fetchOembedCaption = async (urls) => {
    const tried = new Set()
    for (const baseUrl of urls) {
        if (!baseUrl || tried.has(baseUrl)) continue
        tried.add(baseUrl)
        for (const endpoint of FACEBOOK_OEMBED_ENDPOINTS) {
            try {
                const res = await axios.get(`https://graph.facebook.com/v26.0/${endpoint}`, {
                    params: { url: baseUrl },
                    timeout: AXIOS_TIMEOUT,
                    headers: { 'User-Agent': PAGE_USER_AGENT }
                })
                const caption = extractOembedCaption(res.data && res.data.html)
                if (caption) return caption
            } catch (error) {
                // Try the next endpoint / url variant
            }
        }
    }
    return ''
}

export default async function handler(req, res) {
    logAPI(req)
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, data: [], message: "Not supported request" })
    }

    const decoded = await verifyToken(req, res)
    if (!decoded) return

    const url = req.query.url
    if (!url || !isFacebookUrl(url)) {
        return res.status(400).json({ success: false, data: [], message: "Please provide a Facebook or fb.watch link" })
    }

    try {
        // 1. Page HTML — follows the share-link redirect and carries the og:
        //    meta tags (image/title) plus a truncated fallback description.
        let pageHtml = ''
        let finalUrl = url
        try {
            const pageRes = await axios.get(url, {
                timeout: AXIOS_TIMEOUT,
                headers: { 'User-Agent': PAGE_USER_AGENT }
            })
            pageHtml = typeof pageRes.data === 'string' ? pageRes.data : ''
            finalUrl = (pageRes.request && pageRes.request.res && pageRes.request.res.responseUrl) || url
        } catch (pageError) {
            console.log("Facebook page fetch failed, continuing with oEmbed only:", pageError && pageError.message)
        }

        // 2. Full caption via oEmbed — it only returns content for the
        //    canonical post URL (og:url); share links and /reel/ URLs yield an
        //    empty embed. Falls back to the truncated og:description.
        const ogUrl = extractMetaContent(pageHtml, 'og:url')
        const description = await fetchOembedCaption([ogUrl, finalUrl, url]) || extractMetaContent(pageHtml, 'og:description')

        // 3. Preview image + raw page title
        const image = extractMetaContent(pageHtml, 'og:image')
        const title = extractMetaContent(pageHtml, 'og:title')

        if (!description && !image && !title) {
            return res.status(404).json({ success: false, data: [], message: "Could not find the post content. Check the link is public and try again." })
        }

        return res.status(200).json({ success: true, data: { description, title, image }, message: "" })
    } catch (error) {
        console.error("Facebook extract error:", error)
        return res.status(500).json({ success: false, data: [], message: "Error extracting Facebook post: " + error.message })
    }
}
