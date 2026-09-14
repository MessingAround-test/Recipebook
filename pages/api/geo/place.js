import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { geocodePlace } from '../../../lib/dishLists/geocode'

/**
 * Stateless place lookup. Given a country/region/city it returns the best
 * matching point, without touching any record. Used by editors to preview (and
 * verify) a location before saving so pins don't end up in the wrong spot.
 */
export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res)
    if (!decoded) return

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    const clean = (value) => (typeof value === 'string' ? value.trim() : '')
    const place = {
        country: clean(req.body?.country) || undefined,
        region: clean(req.body?.region) || undefined,
        city: clean(req.body?.city) || undefined
    }

    if (!place.country && !place.region && !place.city) {
        return res.status(400).json({ success: false, message: 'A country, region or city is required' })
    }

    try {
        const point = await geocodePlace(place)
        if (!point) {
            return res.status(200).json({ success: true, data: { matched: false } })
        }
        return res.status(200).json({
            success: true,
            data: {
                matched: true,
                lat: point.lat,
                lng: point.lng,
                displayName: point.displayName
            }
        })
    } catch (error) {
        console.error('geocode place error:', error)
        return res.status(500).json({ success: false, message: error.message })
    }
}
