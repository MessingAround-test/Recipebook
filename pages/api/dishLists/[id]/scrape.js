import mongoose from 'mongoose'
import { verifyAdmin } from '../../../../lib/auth'
import { logAPI } from '../../../../lib/logger'
import dbConnect from '../../../../lib/dbConnect'
import DishList from '../../../../models/DishList'
import DishListItem from '../../../../models/DishListItem'
import { parseTasteAtlasList, parseDishUrlList, TASTEATLAS_PRESETS } from '../../../../lib/dishLists/tasteAtlas'
import { normalizeCriteria } from '../../../../lib/dishLists/criteria'
import { saveDishListImage } from '../../../../lib/dishListImageServer'

const MAX_ITEMS = 300
const IMAGE_CONCURRENCY = 6

/**
 * Downloads + stores original TasteAtlas images in the DB. Best-effort: any
 * that fail stay without an image and can be retried from "Blurbs & images".
 */
async function downloadImages(listId, cap = 150) {
    const pending = await DishListItem.find({
        listId,
        hasImage: { $ne: true },
        imageOriginalUrl: { $nin: [null, ''] }
    }).select('_id imageOriginalUrl').limit(cap).lean()

    if (pending.length === 0) return { saved: 0, failed: 0 }

    let saved = 0
    let failed = 0
    let cursor = 0
    const worker = async () => {
        while (cursor < pending.length) {
            const item = pending[cursor++]
            try {
                const result = await saveDishListImage(String(item._id), item.imageOriginalUrl)
                if (result.ok) saved++
                else failed++
            } catch {
                failed++
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, pending.length) }, worker))
    return { saved, failed }
}

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyAdmin(req, res)
    if (!decoded) return

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    const listId = req.query.id
    if (!mongoose.Types.ObjectId.isValid(listId)) {
        return res.status(400).json({ success: false, message: 'Invalid list id' })
    }

    try {
        await dbConnect()
        const list = await DishList.findById(listId)
        if (!list) return res.status(404).json({ success: false, message: 'List not found' })

        const html = typeof req.body?.html === 'string' ? req.body.html : ''
        const urls = typeof req.body?.urls === 'string' ? req.body.urls : ''

        let parsed = []
        if (html.trim()) parsed = parseTasteAtlasList(html)
        else if (urls.trim()) parsed = parseDishUrlList(urls)

        if (parsed.length === 0) {
            return res.status(422).json({
                success: false,
                message: 'Nothing could be parsed. Paste the full TasteAtlas list page HTML, or a newline list of dish URLs/slugs.'
            })
        }
        if (parsed.length > MAX_ITEMS) parsed = parsed.slice(0, MAX_ITEMS)

        const ops = parsed.map(item => {
            const set = { name: item.name, location: item.location || {} }
            if (item.rank !== undefined) set.rank = item.rank
            if (item.category !== undefined) set.category = item.category
            if (item.rating !== undefined) set.rating = item.rating
            if (item.description) set.description = item.description
            if (item.imageOriginalUrl) set.imageOriginalUrl = item.imageOriginalUrl
            if (item.sourceUrl) set.sourceUrl = item.sourceUrl
            if (item.recipeSourceUrl) set.recipeSourceUrl = item.recipeSourceUrl
            return {
                updateOne: {
                    filter: { listId, slug: item.slug },
                    update: {
                        $set: set,
                        $setOnInsert: {
                            listId,
                            slug: item.slug,
                            cooked: false,
                            importStatus: 'none'
                        }
                    },
                    upsert: true
                }
            }
        })

        const result = await DishListItem.bulkWrite(ops, { ordered: false })

        // Update the list meta to reflect what was scraped.
        const listUpdate = {}
        if (typeof req.body?.sourceUrl === 'string' && req.body.sourceUrl.trim()) listUpdate.sourceUrl = req.body.sourceUrl.trim()
        if (req.body?.dietaryFilters !== undefined) listUpdate.dietaryFilters = normalizeCriteria(req.body.dietaryFilters)
        if (typeof req.body?.sourceType === 'string') listUpdate.sourceType = req.body.sourceType
        if (Object.keys(listUpdate).length > 0) {
            await DishList.updateOne({ _id: listId }, { $set: listUpdate })
        }

        const preset = typeof req.body?.preset === 'string'
            ? TASTEATLAS_PRESETS.find(p => p.key === req.body.preset)
            : undefined

        // Pull the (publicly reachable) CDN images into the DB now so the list
        // is complete straight after import. Failures are retried later.
        let images = { saved: 0, failed: 0 }
        const skipImages = req.body?.skipImages === true
        if (!skipImages) {
            try {
                images = await downloadImages(listId)
            } catch (e) {
                console.error('[dishLists] image import failed:', e?.message || e)
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                parsed: parsed.length,
                added: result.upsertedCount || 0,
                updated: result.modifiedCount || 0,
                descriptions: parsed.filter(p => p.description).length,
                images,
                preset: preset?.key
            },
            message: `Parsed ${parsed.length} dishes (${result.upsertedCount || 0} new, ${images.saved} image${images.saved === 1 ? '' : 's'} saved).`
        })
    } catch (error) {
        console.error('API Error in /api/dishLists/[id]/scrape:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
