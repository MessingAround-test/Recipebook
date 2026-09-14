import mongoose from 'mongoose'
import { verifyToken } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishListItem from '../../../models/DishListItem'

const LOCATION_KEYS = ['country', 'region', 'city', 'regionId', 'lat', 'lng']

function buildSingleUpdate(body) {
    const set = {}
    const unset = {}
    const addToSet = {}

    if (body.cooked !== undefined) {
        set.cooked = body.cooked === true
        if (body.cooked === true) set.cookedAt = new Date()
        else unset.cookedAt = ''
    }
    if (body.notes !== undefined) set.notes = String(body.notes || '').trim()
    if (body.description !== undefined) set.description = String(body.description || '').trim()
    if (body.rank !== undefined) set.rank = Number(body.rank) || undefined

    if (body.location !== undefined && body.location && typeof body.location === 'object') {
        for (const key of LOCATION_KEYS) {
            if (body.location[key] === undefined) continue
            const value = body.location[key]
            if (value === '' || value === null) {
                unset[`location.${key}`] = ''
            } else if (key === 'lat' || key === 'lng') {
                // Only persist real numeric coordinates. Coercing null/''/false
                // with Number() yields 0, which the map would plot off Africa.
                const n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value) : NaN)
                if (Number.isFinite(n)) set[`location.${key}`] = n
                else unset[`location.${key}`] = ''
            } else {
                set[`location.${key}`] = String(value)
            }
        }
        // A manual region/city edit (with an actual value) clears the
        // "couldn't find one" marker. Saving blanks leaves it as-is.
        const regionVal = typeof body.location.region === 'string' ? body.location.region.trim() : ''
        const cityVal = typeof body.location.city === 'string' ? body.location.city.trim() : ''
        if (regionVal || cityVal) {
            set['location.regionSearchFailed'] = false
        }
    }

    if (body.recipeId !== undefined) {
        if (body.recipeId && mongoose.Types.ObjectId.isValid(body.recipeId)) {
            // Link a recipe; a dish may accumulate several over time.
            set.recipeId = body.recipeId
            set.importStatus = 'linked'
            addToSet.recipeIds = body.recipeId
        } else {
            unset.recipeId = ''
            set.recipeIds = []
            set.importStatus = 'none'
        }
    }

    return { set, unset, addToSet }
}

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    if (req.method !== 'PATCH') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    try {
        await dbConnect()

        // Bulk cooked toggle across many items.
        if (Array.isArray(req.body?.itemIds)) {
            const ids = req.body.itemIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
            if (ids.length === 0) return res.status(400).json({ success: false, message: 'No valid item ids' })
            const cooked = req.body?.cooked === true
            const update = { $set: { cooked } }
            if (cooked) update.$set.cookedAt = new Date()
            else update.$unset = { cookedAt: '' }
            await DishListItem.updateMany({ _id: { $in: ids } }, update)
            return res.status(200).json({ success: true, data: { updated: ids.length } })
        }

        const itemId = req.body?.itemId
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ success: false, message: 'A valid itemId is required' })
        }

        const { set, unset, addToSet } = buildSingleUpdate(req.body || {})
        const update = {}
        if (Object.keys(set).length > 0) update.$set = set
        if (Object.keys(unset).length > 0) update.$unset = unset
        if (Object.keys(addToSet).length > 0) update.$addToSet = addToSet
        if (Object.keys(update).length === 0) {
            return res.status(400).json({ success: false, message: 'No data provided to update' })
        }

        const item = await DishListItem.findByIdAndUpdate(itemId, update, { new: true }).lean()
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' })
        return res.status(200).json({ success: true, data: item })
    } catch (error) {
        console.error('API Error in /api/dishLists/items:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
