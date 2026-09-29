import { verifyToken } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishList from '../../../models/DishList'
import DishListItem from '../../../models/DishListItem'
import User from '../../../models/User'
import { normalizeCriteria } from '../../../lib/dishLists/criteria'
import { ensureSystemLists } from '../../../lib/dishLists/systemLists'
import { cookedItemIdsForUser } from '../../../lib/dishLists/cookedState'

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    try {
        await dbConnect()

        if (req.method === 'GET') {
            // The default "100 Best Dishes in the World" list is always present.
            await ensureSystemLists().catch(() => { })
            const lists = await DishList.find({}).sort({ created_at: 1 }).lean()
            const items = await DishListItem.find({}).select('listId recipeId recipeIds importStatus').lean()

            // Cooked is per-user; total/imported are shared.
            const user = await User.findById(decoded.id).select('email').lean()
            const cookedSet = await cookedItemIdsForUser(items, decoded.id, user?.email)

            const counts = new Map(lists.map(l => [String(l._id), { total: 0, cooked: 0, imported: 0 }]))
            for (const item of items) {
                const c = counts.get(String(item.listId))
                if (!c) continue
                c.total += 1
                if (item.importStatus === 'linked') c.imported += 1
                if (cookedSet.has(String(item._id))) c.cooked += 1
            }

            const data = lists.map(l => {
                const c = counts.get(String(l._id)) || { total: 0, cooked: 0, imported: 0 }
                return { ...l, counts: { total: c.total, cooked: c.cooked, imported: c.imported } }
            })
            return res.status(200).json({ success: true, data })
        }

        if (req.method === 'POST') {
            if (decoded.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Forbidden: Admin access only' })
            }
            const name = (req.body?.name || '').trim()
            if (!name) return res.status(400).json({ success: false, message: 'A list name is required' })

            const list = await DishList.create({
                name,
                description: typeof req.body?.description === 'string' ? req.body.description.trim() : undefined,
                sourceType: ['tasteatlas', 'manual', 'custom'].includes(req.body?.sourceType) ? req.body.sourceType : 'manual',
                sourceUrl: typeof req.body?.sourceUrl === 'string' ? req.body.sourceUrl.trim() : undefined,
                dietaryFilters: normalizeCriteria(req.body?.dietaryFilters),
                createdBy: req.body?.createdBy,
                isSystem: false
            })
            return res.status(200).json({ success: true, data: list })
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    } catch (error) {
        console.error('API Error in /api/dishLists:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
