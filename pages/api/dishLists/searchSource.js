import mongoose from 'mongoose'
import { verifyToken } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishList from '../../../models/DishList'
import { buildSearchQuery, normalizeCriteria } from '../../../lib/dishLists/criteria'
import { searchRecipeSources } from '../../../lib/dishLists/search'

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    try {
        const name = String(req.body?.name || '').trim()
        if (!name) return res.status(400).json({ success: false, message: 'A dish name is required' })

        let criteria = normalizeCriteria(req.body?.criteria)
        // The list's own dietary filters (e.g. a vegetarian list) always apply,
        // combined with whatever the user toggled for this search.
        if (mongoose.Types.ObjectId.isValid(req.body?.listId)) {
            await dbConnect()
            const list = await DishList.findById(req.body.listId).select('dietaryFilters').lean()
            criteria = Array.from(new Set([...normalizeCriteria(list?.dietaryFilters), ...criteria]))
        }

        const query = buildSearchQuery(name, criteria, req.body?.extra)
        let results = await searchRecipeSources(query, { criteria })
        let relaxed = false

        // Nothing came back for the chosen diets. Rather than a dead end, retry
        // without any dietary filters so the user still gets sources — the UI
        // offers to remix a non-conforming pick back to their requirements.
        if (results.length === 0 && criteria.length > 0) {
            const fallbackQuery = buildSearchQuery(name, [], req.body?.extra)
            results = await searchRecipeSources(fallbackQuery)
            relaxed = results.length > 0
        }

        return res.status(200).json({ success: true, data: { query, criteria, results, relaxed } })
    } catch (error) {
        console.error('API Error in /api/dishLists/searchSource:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
