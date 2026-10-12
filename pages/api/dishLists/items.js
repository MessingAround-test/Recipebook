import mongoose from 'mongoose'
import { verifyToken, requireFeature } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishListItem from '../../../models/DishListItem'
import DishListItemCooked from '../../../models/DishListItemCooked'
import User from '../../../models/User'
import { buildItemUpdate } from '../../../lib/dishLists/itemUpdate'
import { cookedItemIdsForUser } from '../../../lib/dishLists/cookedState'
import { saveDishListImage, deleteDishListImage, dishListImageUrl } from '../../../lib/dishListImageServer'

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return
    if (!(await requireFeature(req, res, decoded, 'worldList'))) return

    if (req.method !== 'PATCH') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    try {
        await dbConnect()

        // Cooked marks are per-user. Resolve the current user's email only when
        // needed (recipe-derived ticks).
        const userId = mongoose.Types.ObjectId.isValid(decoded.id)
            ? new mongoose.Types.ObjectId(decoded.id)
            : null
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized: invalid user' })

        // Bulk cooked toggle across many items.
        if (Array.isArray(req.body?.itemIds)) {
            const ids = req.body.itemIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
            if (ids.length === 0) return res.status(400).json({ success: false, message: 'No valid item ids' })
            const cooked = req.body?.cooked === true
            if (cooked) {
                await DishListItemCooked.bulkWrite(
                    ids.map((itemId) => ({
                        updateOne: {
                            filter: { itemId: new mongoose.Types.ObjectId(itemId), userId },
                            update: { $set: { cookedAt: new Date() } },
                            upsert: true
                        }
                    })),
                    { ordered: false }
                )
            } else {
                await DishListItemCooked.deleteMany({
                    userId,
                    itemId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) }
                })
            }
            return res.status(200).json({ success: true, data: { updated: ids.length, cooked } })
        }

        const itemId = req.body?.itemId
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ success: false, message: 'A valid itemId is required' })
        }

        const existing = await DishListItem.findById(itemId).select('location').lean()
        if (!existing) return res.status(404).json({ success: false, message: 'Item not found' })

        // Image set/remove (admin-only). Runs before the text updates so a
        // bad image URL aborts the whole save instead of partially applying.
        const wantsImage = typeof req.body?.imageUrl === 'string' && req.body.imageUrl.trim() !== ''
        const wantsRemoveImage = req.body?.removeImage === true
        if (decoded.role === 'admin' && (wantsImage || wantsRemoveImage)) {
            if (wantsImage) {
                const imageUrl = req.body.imageUrl.trim()
                const saved = await saveDishListImage(itemId, imageUrl)
                if (!saved.ok) {
                    return res.status(400).json({ success: false, message: 'Could not load that image. Check the URL or pick a different file.' })
                }
                // Reference URL kept for http(s) links only; bytes live in DishListImage.
                if (/^https?:\/\//i.test(imageUrl)) {
                    await DishListItem.updateOne({ _id: itemId }, { $set: { imageOriginalUrl: imageUrl } })
                } else {
                    await DishListItem.updateOne({ _id: itemId }, { $unset: { imageOriginalUrl: '' } })
                }
            } else {
                await deleteDishListImage(itemId)
                await DishListItem.updateOne({ _id: itemId }, { $unset: { imageOriginalUrl: '' } })
            }
        }

        // Tick-off is handled here (per user); buildItemUpdate covers the rest.
        if (req.body?.cooked !== undefined) {
            const cooked = req.body.cooked === true
            if (cooked) {
                await DishListItemCooked.updateOne(
                    { itemId, userId },
                    { $set: { cookedAt: new Date() } },
                    { upsert: true }
                )
            } else {
                await DishListItemCooked.deleteOne({ itemId, userId })
            }
        }

        const { set, unset, addToSet } = buildItemUpdate(
            req.body || {},
            existing.location || {},
            { isAdmin: decoded.role === 'admin' }
        )
        const update = {}
        if (Object.keys(set).length > 0) update.$set = set
        if (Object.keys(unset).length > 0) update.$unset = unset
        if (Object.keys(addToSet).length > 0) update.$addToSet = addToSet

        let item
        if (Object.keys(update).length > 0) {
            item = await DishListItem.findByIdAndUpdate(itemId, update, { new: true }).lean()
        } else {
            item = await DishListItem.findById(itemId).lean()
        }
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' })

        const user = await User.findById(userId).select('email').lean()
        const cookedSet = await cookedItemIdsForUser([item], userId, user?.email)
        return res.status(200).json({
            success: true,
            data: {
                ...item,
                // Rebuilt so an image change busts the immutable cache on the
                // client; null clears a removed image (undefined would be
                // dropped from JSON and leave a stale URL on the client).
                image: item.hasImage ? dishListImageUrl(item._id, 'thumb', item.imageVersion) : null,
                cooked: cookedSet.has(String(item._id))
            }
        })
    } catch (error) {
        console.error('API Error in /api/dishLists/items:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
