import { verifyToken } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishList from '../../../models/DishList'
import DishListItem from '../../../models/DishListItem'
import { normalizeCriteria } from '../../../lib/dishLists/criteria'
import { ensureSystemLists } from '../../../lib/dishLists/systemLists'

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
            const counts = await DishListItem.aggregate([
                {
                    $group: {
                        _id: '$listId',
                        total: { $sum: 1 },
                        cooked: { $sum: { $cond: ['$cooked', 1, 0] } },
                        imported: { $sum: { $cond: [{ $eq: ['$importStatus', 'linked'] }, 1, 0] } }
                    }
                }
            ])
            const byId = new Map(counts.map(c => [String(c._id), c]))
            const data = lists.map(l => {
                const c = byId.get(String(l._id)) || { total: 0, cooked: 0, imported: 0 }
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
