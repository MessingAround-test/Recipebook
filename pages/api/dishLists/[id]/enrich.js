import mongoose from 'mongoose'
import { verifyAdmin } from '../../../../lib/auth'
import { logAPI } from '../../../../lib/logger'
import dbConnect from '../../../../lib/dbConnect'
import DishList from '../../../../models/DishList'
import DishListItem from '../../../../models/DishListItem'
import { saveDishListImage } from '../../../../lib/dishListImageServer'
import { generateDishBlurb } from '../../../../lib/dishLists/blurb'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/** An item still needs enrichment if its image isn't stored or it lacks a blurb. */
const needsImage = (item) => Boolean(item.imageOriginalUrl) && !item.hasImage
const needsBlurb = (item, generateBlurbs) => generateBlurbs && !item.description

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

    const limit = Math.max(1, Math.min(25, Number(req.body?.limit) || 8))
    const generateBlurbs = req.body?.generateBlurbs !== false
    const downloadImages = req.body?.downloadImages !== false

    try {
        await dbConnect()
        const list = await DishList.findById(listId).lean()
        if (!list) return res.status(404).json({ success: false, message: 'List not found' })

        const all = await DishListItem.find({ listId }).sort({ rank: 1, name: 1 }).lean()
        const work = all.filter(item =>
            (!downloadImages || needsImage(item)) || needsBlurb(item, generateBlurbs)
        )
        const batch = work.slice(0, limit)

        let processed = 0
        for (const item of batch) {
            let imageOk = item.hasImage
            let blurb = item.description

            if (downloadImages && needsImage(item)) {
                try {
                    const saved = await saveDishListImage(String(item._id), item.imageOriginalUrl)
                    imageOk = saved.ok
                } catch (e) {
                    console.error('[dishLists] image download failed:', e?.message || e)
                }
            }

            if (needsBlurb({ ...item, description: blurb }, generateBlurbs)) {
                blurb = await generateDishBlurb({
                    name: item.name,
                    category: item.category,
                    country: item.location?.country,
                    criteria: list.dietaryFilters || []
                }) || undefined
            }

            const imageSettled = !downloadImages || !item.imageOriginalUrl || imageOk
            const blurbSettled = !generateBlurbs || Boolean(blurb)
            const update = {}
            if (blurb) update.description = blurb
            if (imageSettled && blurbSettled) update.enrichedAt = new Date()

            if (Object.keys(update).length > 0) {
                await DishListItem.updateOne({ _id: item._id }, { $set: update })
            }
            processed++
            await sleep(150)
        }

        // Recompute what's left so the client can decide whether to keep going.
        const after = await DishListItem.find({ listId }).lean()
        const remaining = after.filter(item =>
            (!downloadImages || needsImage(item)) || needsBlurb(item, generateBlurbs)
        ).length

        return res.status(200).json({ success: true, data: { processed, remaining } })
    } catch (error) {
        console.error('API Error in /api/dishLists/[id]/enrich:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
