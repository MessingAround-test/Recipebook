import mongoose from 'mongoose'
import { verifyToken } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishListItem from '../../../models/DishListItem'
import { buildItemUpdate } from '../../../lib/dishLists/itemUpdate'

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

        const existing = await DishListItem.findById(itemId).select('location').lean()
        if (!existing) return res.status(404).json({ success: false, message: 'Item not found' })

        const { set, unset, addToSet } = buildItemUpdate(req.body || {}, existing.location || {})
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
