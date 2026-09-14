import mongoose from 'mongoose'
import { verifyToken } from '../../../../lib/auth'
import { logAPI } from '../../../../lib/logger'
import dbConnect from '../../../../lib/dbConnect'
import DishList from '../../../../models/DishList'
import DishListItem from '../../../../models/DishListItem'
import Recipe from '../../../../models/Recipe'
import User from '../../../../models/User'

/** Single dish-list item with its list + (optional) linked recipe summary. */
export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    const id = req.query.id
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid item id' })
    }

    try {
        await dbConnect()
        const item = await DishListItem.findById(id).lean()
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' })

        const list = await DishList.findById(item.listId).select('name dietaryFilters sourceUrl').lean()

        const recipeIds = (Array.isArray(item.recipeIds) && item.recipeIds.length
            ? item.recipeIds
            : (item.recipeId ? [item.recipeId] : []))
            .map(String)

        let recipes = []
        if (recipeIds.length > 0) {
            // Normal users only see their own recipe implementations; admins
            // see every recipe linked to the dish.
            const recipeQuery = { _id: { $in: recipeIds } }
            if (decoded.role !== 'admin') {
                const user = await User.findById(decoded.id).select('email').lean()
                recipeQuery.creator_email = user?.email || '__no_such_user__'
            }
            const docs = await Recipe.find(recipeQuery).select('name hasImage timesCooked').lean()
            recipes = docs.map(doc => ({
                _id: doc._id,
                name: doc.name,
                timesCooked: doc.timesCooked || 0,
                image: doc.hasImage ? `/api/Recipe/${doc._id}/image?q=thumb` : undefined
            }))
        }

        return res.status(200).json({
            success: true,
            data: {
                item: {
                    ...item,
                    image: item.hasImage ? `/api/dishLists/items/${item._id}/image?q=full` : undefined
                },
                list: list ? { _id: list._id, name: list.name, dietaryFilters: list.dietaryFilters || [], sourceUrl: list.sourceUrl } : null,
                recipes
            }
        })
    } catch (error) {
        console.error('API Error in /api/dishLists/items/[id]:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
