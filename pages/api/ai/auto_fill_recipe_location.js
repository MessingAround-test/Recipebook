import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import Recipe from '../../../models/Recipe'
import User from '../../../models/User'
import { resolveRecipeLocation, locationPatch } from '../../../lib/dishLists/geocode'

/**
 * AI-fills a recipe's missing country/region/city (then geocodes it to map
 * coordinates). Called automatically the first time a recipe without a
 * location is opened, and never overwrites an existing location.
 */
export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    try {
        await dbConnect()
        const recipeId = req.query.recipeId
        if (!recipeId) {
            return res.status(400).json({ success: false, message: 'Missing recipeId' })
        }

        const recipe = await Recipe.findOne({ _id: recipeId })
        if (!recipe) {
            return res.status(404).json({ success: false, message: 'Recipe not found' })
        }

        const userData = await User.findById(decoded.id)
        if (decoded.role !== 'admin' && recipe.creator_email !== userData?.email) {
            return res.status(403).json({ success: false, message: 'Forbidden' })
        }

        const existing = recipe.location || {}
        if (existing.country || existing.region || existing.city) {
            return res.status(200).json({
                success: true,
                skipped: true,
                data: {
                    country: existing.country,
                    region: existing.region,
                    city: existing.city,
                    lat: existing.lat,
                    lng: existing.lng
                }
            })
        }

        const resolved = await resolveRecipeLocation({
            name: recipe.name,
            genre: recipe.genre,
            ingredients: (recipe.ingredients || []).map(i => i.Name).join(', '),
            description: recipe.sourceNotes
        })
        if (!resolved) {
            return res.status(200).json({ success: true, data: null })
        }

        await Recipe.updateOne({ _id: recipe._id }, { $set: locationPatch(resolved, { includeCountry: true }) })
        return res.status(200).json({
            success: true,
            data: {
                country: resolved.country,
                region: resolved.region,
                city: resolved.city,
                lat: resolved.lat,
                lng: resolved.lng
            }
        })
    } catch (error) {
        console.error('auto_fill_recipe_location error:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}
