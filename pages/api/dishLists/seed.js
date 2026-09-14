import { verifyAdmin } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishList from '../../../models/DishList'
import { ensureSystemLists } from '../../../lib/dishLists/systemLists'

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyAdmin(req, res)
    if (!decoded) return

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    try {
        await dbConnect()
        const created = await ensureSystemLists(req.body?.createdBy)
        const data = await DishList.find({}).sort({ created_at: 1 }).lean()
        return res.status(200).json({ success: true, data, created: created.length })
    } catch (error) {
        console.error('API Error in /api/dishLists/seed:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
