import mongoose from 'mongoose'
import { verifyAdmin } from '../../../../lib/auth'
import { logAPI } from '../../../../lib/logger'
import dbConnect from '../../../../lib/dbConnect'
import DishList from '../../../../models/DishList'
import DishListItem from '../../../../models/DishListItem'
import { geocodePlace } from '../../../../lib/dishLists/geocode'
import { saveDishListImage } from '../../../../lib/dishListImageServer'

const clean = (value) => (typeof value === 'string' ? value.trim() : '')

const slugify = (value) =>
    clean(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')

/**
 * Adds (or re-saves) a single dish by hand — used by the country fill-in grid
 * and the Quick add form. Keyed on slug derived from country+name so
 * re-submitting the same entry updates it instead of creating a duplicate.
 */
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

    const name = clean(req.body?.name)
    const country = clean(req.body?.country)
    if (!name) return res.status(400).json({ success: false, message: 'A dish name is required' })
    if (!country) return res.status(400).json({ success: false, message: 'A country is required' })

    const slug = [slugify(country), slugify(name)].filter(Boolean).join('-')
    if (!slug) return res.status(400).json({ success: false, message: 'Could not build a slug for this dish' })

    try {
        await dbConnect()
        const list = await DishList.findById(listId).select('_id').lean()
        if (!list) return res.status(404).json({ success: false, message: 'List not found' })

        const existing = await DishListItem.findOne({ listId, slug }).select('_id').lean()
        const set = { name, 'location.country': country }
        const region = clean(req.body?.region)
        const city = clean(req.body?.city)
        const category = clean(req.body?.category)
        const description = clean(req.body?.description)
        const notes = clean(req.body?.notes)
        const sourceUrl = clean(req.body?.sourceUrl)
        const recipeSourceUrl = clean(req.body?.recipeSourceUrl)
        const imageUrl = clean(req.body?.imageUrl)
        if (region) set['location.region'] = region
        if (city) set['location.city'] = city
        if (category) set.category = category
        if (description) set.description = description
        if (notes) set.notes = notes
        if (sourceUrl) set.sourceUrl = sourceUrl
        if (recipeSourceUrl) set.recipeSourceUrl = recipeSourceUrl

        const update = { $set: set }
        // Reference URL kept for http(s) links only — a data URI replaces it
        // (bytes live in DishListImage, the doc shouldn't carry base64).
        if (imageUrl) {
            if (/^https?:\/\//i.test(imageUrl)) set.imageOriginalUrl = imageUrl
            else update.$unset = { imageOriginalUrl: '' }
        }
        if (!existing) {
            const total = await DishListItem.countDocuments({ listId })
            update.$setOnInsert = {
                listId,
                slug,
                rank: total + 1,
                importStatus: 'none'
            }
        }

        let item = await DishListItem.findOneAndUpdate(
            { listId, slug },
            update,
            { new: true, upsert: true }
        ).lean()

        // Optional image (http(s) URL or data URI) — downloaded/stored now so
        // the dish has a picture straight away. A failed image never blocks
        // the entry itself; the note below tells the caller.
        let imageNote = ''
        if (imageUrl) {
            try {
                const saved = await saveDishListImage(String(item._id), imageUrl)
                if (saved.ok) {
                    item = await DishListItem.findById(item._id).lean()
                } else {
                    imageNote = ' Image could not be loaded.'
                }
            } catch (e) {
                console.error('[dishLists] image save failed:', e?.message || e)
                imageNote = ' Image could not be loaded.'
            }
        }

        // Best-effort country pin so the dish shows on the map right away.
        // Failures are fine — the list's "Locations" button can retry later.
        if (!Number.isFinite(item?.location?.lat) || !Number.isFinite(item?.location?.lng)) {
            try {
                const point = await geocodePlace({ country, region, city })
                if (point) {
                    await DishListItem.updateOne(
                        { _id: item._id },
                        { $set: { 'location.lat': point.lat, 'location.lng': point.lng } }
                    )
                    item.location = { ...item.location, lat: point.lat, lng: point.lng }
                }
            } catch (e) {
                console.error('[dishLists] country geocode failed:', e?.message || e)
            }
        }

        return res.status(200).json({
            success: true,
            data: item,
            message: (existing ? `Updated ${name} (${country}).` : `Added ${name} (${country}).`) + imageNote
        })
    } catch (error) {
        console.error('API Error in /api/dishLists/[id]/items:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
