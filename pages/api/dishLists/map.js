import mongoose from 'mongoose'
import { verifyToken } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishList from '../../../models/DishList'
import DishListItem from '../../../models/DishListItem'
import Recipe from '../../../models/Recipe'
import User from '../../../models/User'
import { recipeImageUrl } from '../../../lib/recipeImageServer'
import {
    guessDishRegions,
    guessRecipeOrigins,
    geocodeWithGuess,
    geocodeRecipeOrigin,
    refineDishLocation,
    locationPatch,
    GUESS_BATCH_SIZE
} from '../../../lib/dishLists/geocode'
import { needsLocationWork, hasPoint, hasRegionArea, hasPlace } from '../../../lib/dishLists/locationStatus'

// Geocoding is intentionally slow (Nominatim ~1 req/s), so give the function
// room to finish a batch on serverless hosts.
export const config = { maxDuration: 60 }

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/** Maps a stored item to the shape the geocode helpers expect. */
const toPlaceInput = (item) => ({
    name: item.name,
    category: item.category,
    description: item.description,
    country: item.location?.country,
    region: item.location?.region,
    city: item.location?.city
})

/** Maps a stored recipe to the shape the origin helpers expect. */
const toRecipePlaceInput = (recipe) => ({
    name: recipe.name,
    genre: recipe.genre,
    ingredients: (recipe.ingredients || []).map(i => i.Name).join(', '),
    description: recipe.sourceNotes,
    country: recipe.location?.country,
    region: recipe.location?.region,
    city: recipe.location?.city
})

/** Recipes still need work when there are no coordinates or no region/city,
 *  unless an attempt has already been made and found nothing. Recipes with no
 *  location at all are included so they can be AI-generated. */
const recipeNeedsWork = (location) =>
    location?.regionSearchFailed !== true && (!hasPoint(location) || !hasRegionArea(location))

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    try {
        await dbConnect()

        if (req.method === 'GET') {
            const userData = await User.findById(decoded.id).lean()
            const recipeQuery = decoded.role === 'admin' ? {} : { creator_email: userData?.email }

            const [lists, items, total, recipes, recipeTotal] = await Promise.all([
                DishList.find({}).select('name').lean(),
                DishListItem.find({}).lean(),
                DishListItem.countDocuments({}),
                Recipe.find(recipeQuery).select('name genre location timesCooked hasImage').lean(),
                Recipe.countDocuments(recipeQuery)
            ])
            const listNames = new Map(lists.map(l => [String(l._id), l.name]))

            const points = items
                .filter(item => hasPoint(item.location))
                .map(item => ({
                    _id: item._id,
                    source: 'dish',
                    name: item.name,
                    category: item.category,
                    country: item.location?.country,
                    region: item.location?.region,
                    city: item.location?.city,
                    lat: item.location.lat,
                    lng: item.location.lng,
                    cooked: item.cooked === true,
                    listId: item.listId,
                    listName: listNames.get(String(item.listId)) || '',
                    recipeId: item.recipeId,
                    recipeIds: (Array.isArray(item.recipeIds) && item.recipeIds.length ? item.recipeIds : (item.recipeId ? [item.recipeId] : [])).map(String),
                    hasImage: item.hasImage === true,
                    sourceUrl: item.sourceUrl
                }))

            // Recipes use their own `location` block (populated by the bulk
            // "Generate Locations" op or auto-fill on view).
            const recipePoints = recipes
                .filter(r => hasPoint(r.location))
                .map(r => ({
                    _id: String(r._id),
                    source: 'recipe',
                    name: r.name,
                    category: r.genre,
                    country: r.location?.country,
                    region: r.location?.region,
                    city: r.location?.city,
                    lat: r.location.lat,
                    lng: r.location.lng,
                    cooked: (r.timesCooked || 0) > 0,
                    listId: '',
                    listName: '',
                    recipeId: String(r._id),
                    recipeIds: [String(r._id)],
                    hasImage: r.hasImage === true,
                    imageUrl: r.hasImage ? recipeImageUrl(r._id, 'thumb') : undefined
                }))

            const withPlace = items.filter(item => hasPlace(item.location)).length
            // IDs still needing coordinates or region/city refinement — the
            // client uses these as a deterministic worklist for "Locations".
            const pending = items.filter(item => needsLocationWork(item.location)).map(item => item._id)
            const recipePending = recipes.filter(r => recipeNeedsWork(r.location)).map(r => r._id)

            return res.status(200).json({
                success: true,
                data: {
                    points,
                    recipePoints,
                    total,
                    located: points.length,
                    geocodable: withPlace,
                    pending,
                    recipeTotal,
                    recipeLocated: recipePoints.length,
                    recipePending
                }
            })
        }

        if (req.method === 'POST') {
            // Location generation is admin-only; users view the map read-only.
            if (decoded.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Forbidden: Admin access only' })
            }
            const limit = Math.max(1, Math.min(50, Number(req.body?.limit) || GUESS_BATCH_SIZE))
            const source = req.body?.source === 'recipe' ? 'recipe' : 'dish'
            const itemIds = Array.isArray(req.body?.itemIds)
                ? req.body.itemIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
                : null

            if (source === 'recipe') {
                const ownership = decoded.role === 'admin'
                    ? {}
                    : { creator_email: (await User.findById(decoded.id).lean())?.email }
                const all = await Recipe.find(itemIds ? { _id: { $in: itemIds }, ...ownership } : ownership)
                    .select('name genre ingredients.Name sourceNotes location').lean()
                const pending = all.filter(r => recipeNeedsWork(r.location))
                const batch = itemIds ? pending : pending.slice(0, limit)

                // One AI call per batch of ~10 recipes.
                const guessTargets = batch.filter(r => !(r.location?.country && hasRegionArea(r.location)))
                const guesses = await guessRecipeOrigins(guessTargets.map(toRecipePlaceInput))
                const guessById = new Map()
                guessTargets.forEach((r, i) => guessById.set(String(r._id), guesses[i] || null))

                let processed = 0
                for (let index = 0; index < batch.length; index++) {
                    const recipe = batch[index]
                    const input = toRecipePlaceInput(recipe)
                    const guess = guessById.get(String(recipe._id)) || null
                    const resolved = await geocodeRecipeOrigin(input, guess)
                    if (resolved) {
                        await Recipe.updateOne({ _id: recipe._id }, { $set: { ...locationPatch(resolved, { includeCountry: true }), 'location.regionSearchFailed': false } })
                        processed++
                    } else {
                        await Recipe.updateOne({ _id: recipe._id }, { $set: { 'location.regionSearchFailed': true } })
                    }
                    // Nominatim asks for ~1 request/second.
                    if (index < batch.length - 1) await sleep(1100)
                }

                const after = await Recipe.find(ownership).select('location').lean()
                const remaining = after.filter(r => recipeNeedsWork(r.location)).length
                return res.status(200).json({
                    success: true,
                    data: { processed, remaining }
                })
            }

            let batch
            if (itemIds) {
                const docs = await DishListItem.find({ _id: { $in: itemIds } }).lean()
                batch = docs.filter(item => needsLocationWork(item.location))
            } else {
                const all = await DishListItem.find({}).lean()
                const pending = all.filter(item => needsLocationWork(item.location))
                batch = pending.slice(0, limit)
            }

            // Number still needing work across the whole map.
            const countRemaining = async () => {
                const docs = await DishListItem.find({}).select('location').lean()
                return docs.filter(item => needsLocationWork(item.location)).length
            }

            // One AI call per batch of ~10 dishes (mixed countries handled per item).
            const guessTargets = batch.filter(item => !hasRegionArea(item.location))
            const guesses = await guessDishRegions(guessTargets.map(toPlaceInput))
            const guessById = new Map()
            guessTargets.forEach((item, i) => guessById.set(String(item._id), guesses[i] || null))

            let processed = 0
            for (let index = 0; index < batch.length; index++) {
                const item = batch[index]
                const input = toPlaceInput(item)
                const guess = guessById.get(String(item._id)) || null
                // Already pinned at country level → refine only, never re-centre.
                const resolved = hasPoint(item.location) && !hasRegionArea(item.location)
                    ? await refineDishLocation(input, guess)
                    : await geocodeWithGuess(input, guess)
                if (resolved && (resolved.region || resolved.city)) {
                    await DishListItem.updateOne({ _id: item._id }, { $set: { ...locationPatch(resolved), 'location.regionSearchFailed': false } })
                    processed++
                } else if (resolved) {
                    // Got coordinates but no area — flag it so we stop retrying it.
                    await DishListItem.updateOne({ _id: item._id }, { $set: { ...locationPatch(resolved), 'location.regionSearchFailed': true } })
                    processed++
                } else {
                    await DishListItem.updateOne({ _id: item._id }, { $set: { 'location.regionSearchFailed': true } })
                }
                // Nominatim asks for ~1 request/second. The client's next batch
                // starts with its own network call, which spaces requests out.
                if (index < batch.length - 1) await sleep(1100)
            }

            return res.status(200).json({
                success: true,
                data: { processed, remaining: await countRemaining() }
            })
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    } catch (error) {
        console.error('API Error in /api/dishLists/map:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
