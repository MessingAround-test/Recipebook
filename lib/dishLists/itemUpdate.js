// Pure update builder for a dish-list item PATCH. Kept in lib (no DB imports)
// so the stale-coordinate rules can be unit tested.

import mongoose from 'mongoose'

const LOCATION_KEYS = ['country', 'region', 'city', 'regionId', 'lat', 'lng']

// Fields a normal (non-admin) user may change on a dish-list item. Everything
// else — name/category/notes/blurb/rank/location — is admin-only.
const USER_EDITABLE_KEYS = ['cooked', 'recipeId']

/**
 * Builds the Mongo $set/$unset/$addToSet for an item update.
 *
 * @param body the request body
 * @param existingLocation the item's current `location` sub-document, used to
 *   detect place edits and drop now-stale coordinates.
 * @param options.isAdmin when false, only user-editable fields are honoured.
 */
export function buildItemUpdate(body = {}, existingLocation = {}, { isAdmin = true } = {}) {
    if (!isAdmin) {
        const filtered = {}
        for (const key of USER_EDITABLE_KEYS) {
            if (body[key] !== undefined) filtered[key] = body[key]
        }
        body = filtered
    }

    const set = {}
    const unset = {}
    const addToSet = {}

    if (body.cooked !== undefined) {
        set.cooked = body.cooked === true
        if (body.cooked === true) set.cookedAt = new Date()
        else unset.cookedAt = ''
    }
    if (body.notes !== undefined) set.notes = String(body.notes || '').trim()
    if (body.description !== undefined) set.description = String(body.description || '').trim()
    if (body.rank !== undefined) set.rank = Number(body.rank) || undefined

    if (body.location !== undefined && body.location && typeof body.location === 'object') {
        const src = body.location
        const hasLat = src.lat !== undefined && src.lat !== '' && src.lat !== null
        const hasLng = src.lng !== undefined && src.lng !== '' && src.lng !== null
        for (const key of LOCATION_KEYS) {
            if (src[key] === undefined) continue
            const value = src[key]
            if (value === '' || value === null) {
                unset[`location.${key}`] = ''
            } else if (key === 'lat' || key === 'lng') {
                // Only persist real numeric coordinates. Coercing null/''/false
                // with Number() yields 0, which the map would plot off Africa.
                const n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value) : NaN)
                if (Number.isFinite(n)) set[`location.${key}`] = n
                else unset[`location.${key}`] = ''
            } else {
                set[`location.${key}`] = String(value)
            }
        }

        const prev = existingLocation || {}
        const norm = (v) => (v === undefined || v === null ? '' : String(v))
        const placeChanged =
            (src.country !== undefined && norm(src.country) !== norm(prev.country)) ||
            (src.region !== undefined && norm(src.region) !== norm(prev.region)) ||
            (src.city !== undefined && norm(src.city) !== norm(prev.city))

        // Editing the place invalidates previously geocoded coordinates. Drop
        // them unless fresh ones were sent (e.g. the editor's "Check exists"
        // button) so a pin can never stay on the old, wrong spot.
        if (placeChanged) {
            if (!hasLat) unset['location.lat'] = ''
            if (!hasLng) unset['location.lng'] = ''
        }

        // A manual region/city edit (with an actual value) clears the
        // "couldn't find one" marker. Blank saves leave it as-is.
        const regionVal = typeof src.region === 'string' ? src.region.trim() : ''
        const cityVal = typeof src.city === 'string' ? src.city.trim() : ''
        if (typeof src.regionSearchFailed === 'boolean') {
            set['location.regionSearchFailed'] = src.regionSearchFailed
        } else if (placeChanged || regionVal || cityVal) {
            set['location.regionSearchFailed'] = false
        }
    }

    if (body.recipeId !== undefined) {
        if (body.recipeId && mongoose.Types.ObjectId.isValid(body.recipeId)) {
            // Link a recipe; a dish may accumulate several over time.
            set.recipeId = body.recipeId
            set.importStatus = 'linked'
            addToSet.recipeIds = body.recipeId
        } else {
            unset.recipeId = ''
            set.recipeIds = []
            set.importStatus = 'none'
        }
    }

    return { set, unset, addToSet }
}
