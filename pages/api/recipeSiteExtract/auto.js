import { verifyToken } from '../../../lib/auth.ts'
import { logAPI } from '../../../lib/logger.ts'
import { scrapeRecipe } from '../../../lib/recipeScrape'

/**
 * Generic recipe site scraper. Replaces the per-site substring routing on
 * the client: all non-social URLs come here and are handled by the cascade
 * (JSON-LD -> stored AI rules -> heuristics -> AI rule generation).
 */
export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, data: [], message: 'Not supported request' })
    }

    const url = req.query.url
    if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ success: false, data: null, message: 'A valid http(s) url query parameter is required' })
    }

    try {
        const recipe = await scrapeRecipe(url)
        // Extraction tier surfaces how the recipe was pulled (jsonld/stored-
        // rule/heuristic/ai-generated) — visible in the network tab and now
        // mirrored into the ScrapeLog collection for admin review.
        return res.status(200).json({
            success: true,
            data: { ...recipe, extractionTier: recipe.extractionTier },
            message: ''
        })
    } catch (error) {
        console.error('[recipeSiteExtract/auto] Failed:', error?.message)
        return res.status(422).json({
            success: false,
            data: null,
            message: 'Could not extract a recipe from this site. Try the AI Notes or Photo import instead.'
        })
    }
}
