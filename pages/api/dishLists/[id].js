import mongoose from 'mongoose'
import { verifyToken, requireFeature } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishList from '../../../models/DishList'
import DishListItem from '../../../models/DishListItem'
import DishListItemCooked from '../../../models/DishListItemCooked'
import DishListImage from '../../../models/DishListImage'
import Recipe from '../../../models/Recipe'
import User from '../../../models/User'
import { dishListImageUrl } from '../../../lib/dishListImageServer'
import { normalizeCriteria } from '../../../lib/dishLists/criteria'
import { cookedItemIdsForUser } from '../../../lib/dishLists/cookedState'

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return
    if (!(await requireFeature(req, res, decoded, 'worldList'))) return

    const listId = req.query.id
    if (!mongoose.Types.ObjectId.isValid(listId)) {
        return res.status(400).json({ success: false, message: 'Invalid list id' })
    }

    try {
        await dbConnect()

        if (req.method === 'GET') {
            const list = await DishList.findById(listId).lean()
            if (!list) return res.status(404).json({ success: false, message: 'List not found' })

            let items = await DishListItem.find({ listId }).sort({ rank: 1, name: 1 }).lean()
            const user = await User.findById(decoded.id).select('email').lean()
            const cookedSet = await cookedItemIdsForUser(items, decoded.id, user?.email)
            items = items.map(item => ({
                ...item,
                cooked: cookedSet.has(String(item._id)),
                cookedAt: undefined,
                image: item.hasImage ? dishListImageUrl(item._id, 'thumb') : undefined
            }))

            return res.status(200).json({ success: true, data: { list, items } })
        }

        if (req.method === 'PUT') {
            if (decoded.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Forbidden: Admin access only' })
            }
            const update = {}
            if (typeof req.body?.name === 'string' && req.body.name.trim()) update.name = req.body.name.trim()
            if (req.body?.description !== undefined) update.description = String(req.body.description || '').trim()
            if (req.body?.sourceUrl !== undefined) update.sourceUrl = String(req.body.sourceUrl || '').trim()
            if (req.body?.dietaryFilters !== undefined) update.dietaryFilters = normalizeCriteria(req.body.dietaryFilters)
            // Admins can mark a list as a system (official) list.
            if (typeof req.body?.isSystem === 'boolean') update.isSystem = req.body.isSystem
            if (Object.keys(update).length === 0) {
                return res.status(400).json({ success: false, message: 'No data provided to update' })
            }
            const list = await DishList.findByIdAndUpdate(listId, { $set: update }, { new: true }).lean()
            return res.status(200).json({ success: true, data: list })
        }

        if (req.method === 'DELETE') {
            if (decoded.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Forbidden: Admin access only' })
            }
            const items = await DishListItem.find({ listId }).select('_id recipeId').lean()

            // Recipes imported for this list are deliberately kept in /recipes.
            // We only strip the now-dangling back-reference so their "On list"
            // badge doesn't point at a deleted list.
            const recipeIds = Array.from(new Set(
                items.filter(i => i.recipeId).map(i => String(i.recipeId))
            ))
            if (recipeIds.length > 0) {
                await Recipe.updateMany(
                    { _id: { $in: recipeIds } },
                    { $pull: { dishListRefs: { listId: new mongoose.Types.ObjectId(listId) } } }
                ).catch(() => { })
            }

            if (items.length > 0) {
                await DishListImage.deleteMany({ itemId: { $in: items.map(i => i._id) } }).catch(() => { })
                await DishListItemCooked.deleteMany({ itemId: { $in: items.map(i => i._id) } }).catch(() => { })
            }
            await DishListItem.deleteMany({ listId })
            await DishList.findByIdAndDelete(listId)
            return res.status(200).json({ success: true, data: { retainedRecipes: recipeIds.length } })
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    } catch (error) {
        console.error('API Error in /api/dishLists/[id]:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
