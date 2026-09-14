import { verifyToken } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishList from '../../../models/DishList'
import { TASTEATLAS_PRESETS } from '../../../lib/dishLists/tasteAtlas'

// The two starter lists requested up-front. Further presets can be added by
// the user from the UI without touching this endpoint.
const SEED_KEYS = ['best-dishes', 'best-side-dishes']

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    try {
        await dbConnect()
        const created = []
        for (const key of SEED_KEYS) {
            const preset = TASTEATLAS_PRESETS.find(p => p.key === key)
            if (!preset) continue
            const existing = await DishList.findOne({ sourceUrl: preset.url }).lean()
            if (existing) continue
            const list = await DishList.create({
                name: preset.name,
                description: preset.description,
                sourceType: 'tasteatlas',
                sourceUrl: preset.url,
                dietaryFilters: preset.dietaryFilters,
                isSystem: true,
                createdBy: req.body?.createdBy
            })
            created.push(list)
        }
        const data = await DishList.find({}).sort({ created_at: 1 }).lean()
        return res.status(200).json({ success: true, data, created: created.length })
    } catch (error) {
        console.error('API Error in /api/dishLists/seed:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
