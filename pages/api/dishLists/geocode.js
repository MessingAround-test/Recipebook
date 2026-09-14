import mongoose from 'mongoose'
import { verifyToken } from '../../../lib/auth'
import { logAPI } from '../../../lib/logger'
import dbConnect from '../../../lib/dbConnect'
import DishListItem from '../../../models/DishListItem'
import {
    guessDishRegions, geocodeWithGuess, refineDishLocation, locationPatch, GUESS_BATCH_SIZE
} from '../../../lib/dishLists/geocode'
import { needsLocationWork, hasPoint, hasRegionArea } from '../../../lib/dishLists/locationStatus'

// Geocoding is intentionally slow (Nominatim ~1 req/s), so give the function
// room to finish a batch on serverless hosts.
export const config = { maxDuration: 60 }

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/** Maps a stored item to the shape the geocode helpers expect. */
function toPlaceInput(item) {
    return {
        name: item.name,
        category: item.category,
        description: item.description,
        country: item.location?.country,
        region: item.location?.region,
        city: item.location?.city
    }
}

/**
 * Backfills / refines coordinates for list items. Items with only a country
 * (even if already pinned) are refined toward a region/city; the country is
 * never changed. Nominatim asks for ~1 request/second, so batches are small.
 *
 * Accepts an explicit `itemIds` worklist (used by the client so a run
 * terminates deterministically); otherwise computes the pending set itself.
 */
export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    const listId = req.body?.listId
    const itemIds = Array.isArray(req.body?.itemIds)
        ? req.body.itemIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
        : null

    if (!itemIds && !mongoose.Types.ObjectId.isValid(listId)) {
        return res.status(400).json({ success: false, message: 'A valid listId or itemIds are required' })
    }

    const limit = Math.max(1, Math.min(50, Number(req.body?.limit) || GUESS_BATCH_SIZE))

    try {
        await dbConnect()

        let batch
        if (itemIds) {
            const docs = await DishListItem.find({ _id: { $in: itemIds } }).lean()
            batch = docs.filter(i => needsLocationWork(i.location))
        } else {
            const all = await DishListItem.find({ listId }).lean()
            const pending = all.filter(i => needsLocationWork(i.location))
            batch = pending.slice(0, limit)
        }

        // Number still needing work (whole list when known, else just this chunk).
        const countRemaining = async () => {
            const scope = mongoose.Types.ObjectId.isValid(listId)
                ? { listId }
                : { _id: { $in: itemIds || [] } }
            const docs = await DishListItem.find(scope).select('location').lean()
            return docs.filter(i => needsLocationWork(i.location)).length
        }

        if (batch.length === 0) {
            return res.status(200).json({ success: true, data: { processed: 0, remaining: await countRemaining() } })
        }

        // One AI call for the batch's items that lack a region/city.
        const guessTargets = batch.filter(item => !hasRegionArea(item.location || {}))
        const guesses = await guessDishRegions(guessTargets.map(toPlaceInput))
        const guessById = new Map()
        guessTargets.forEach((item, i) => guessById.set(String(item._id), guesses[i] || null))

        let processed = 0
        for (let index = 0; index < batch.length; index++) {
            const item = batch[index]
            const input = toPlaceInput(item)
            const guess = guessById.get(String(item._id)) || null
            // Already pinned at country level → only refine, never re-centre.
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

        return res.status(200).json({ success: true, data: { processed, remaining: await countRemaining() } })
    } catch (error) {
        console.error('API Error in /api/dishLists/geocode:', error)
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message })
    }
}
