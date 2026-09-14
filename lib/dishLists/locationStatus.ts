// Client-safe helpers for deciding whether a dish still needs location work.
// (Kept free of server-only imports so it can be used in components.)

export interface ItemLocation {
    country?: string
    region?: string
    city?: string
    lat?: number
    lng?: number
    /** Set when a region/city search already ran but found nothing. */
    regionSearchFailed?: boolean
}

export const hasRegionArea = (loc?: ItemLocation | null): boolean =>
    Boolean((loc?.region || '').trim() || (loc?.city || '').trim())

export const hasPoint = (loc?: ItemLocation | null): boolean =>
    Boolean(loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng))

/** True when there is enough place info to attempt geocoding/refinement. */
export const hasPlace = (loc?: ItemLocation | null): boolean =>
    Boolean((loc?.country || '').trim() || (loc?.region || '').trim() || (loc?.city || '').trim())

/**
 * Needs work when it has a place but either:
 *  - no coordinates yet, or
 *  - coordinates from the country only (no region/city) that haven't already
 *    been attempted → refine with detail. Once an attempt has been made and
 *    failed (`regionSearchFailed`), the country pin is left alone so the
 *    worklist stops looping over it.
 */
export const needsLocationWork = (loc?: ItemLocation | null): boolean =>
    hasPlace(loc) && (
        !hasPoint(loc) ||
        (!hasRegionArea(loc) && loc?.regionSearchFailed !== true)
    )
