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

// `(0, 0)` is the sentinel a missing coordinate can be coerced to (Number('')
// === 0, etc). It is a real spot in the Gulf of Guinea, so treat an exact
// double-zero as "no point" — single-axis zeros (equator / prime meridian) stay
// valid.
export const hasPoint = (loc?: ItemLocation | null): boolean =>
    Boolean(
        loc &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng) &&
        !(loc.lat === 0 && loc.lng === 0)
    )

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
export const needsLocationWork = (loc?: ItemLocation | null): boolean => {
    if (!hasPlace(loc)) return false
    if (!hasRegionArea(loc)) return loc?.regionSearchFailed !== true
    return !hasPoint(loc)
}

/** Map a country name to its continent. */
export const continentOf = (country: string): string => {
    const c = country.toLowerCase().trim()
    // Europe
    if (['france', 'germany', 'italy', 'spain', 'portugal', 'united kingdom', 'uk', 'england', 'netherlands', 'belgium', 'switzerland', 'austria', 'poland', 'czech republic', 'czechia', 'denmark', 'sweden', 'norway', 'finland', 'ireland', 'greece', 'turkey', 'turkiye', 'georgia', 'armenia', 'azerbaijan', 'romania', 'hungary', 'croatia', 'serbia', 'bulgaria', 'slovakia', 'slovenia', 'lithuania', 'latvia', 'estonia', 'ukraine', 'belarus', 'moldova', 'albania', 'north macedonia', 'montenegro', 'bosnia and herzegovina', 'kosovo', 'luxembourg', 'malta', 'cyprus', 'iceland', 'liechtenstein', 'monaco', 'san marino', 'vatican city', 'andorra'].includes(c)) return 'Europe'
    // Asia
    if (['china', 'japan', 'south korea', 'korea', 'india', 'thailand', 'vietnam', 'indonesia', 'malaysia', 'singapore', 'philippines', 'taiwan', 'hong kong', 'macau', 'cambodia', 'laos', 'myanmar', 'bangladesh', 'sri lanka', 'nepal', 'pakistan', 'afghanistan', 'iran', 'iraq', 'saudi arabia', 'united arab emirates', 'uae', 'qatar', 'kuwait', 'bahrain', 'oman', 'yemen', 'jordan', 'lebanon', 'israel', 'palestine', 'syria', 'uzbekistan', 'kazakhstan', 'turkmenistan', 'kyrgyzstan', 'tajikistan', 'mongolia', 'brunei', 'east timor', 'timor-leste'].includes(c)) return 'Asia'
    // North America
    if (['united states', 'united states of america', 'usa', 'canada', 'mexico', 'guatemala', 'belize', 'honduras', 'el salvador', 'nicaragua', 'costa rica', 'panama', 'cuba', 'jamaica', 'haiti', 'dominican republic', 'puerto rico', 'trinidad and tobago', 'barbados', 'bahamas', 'antigua and barbuda', 'dominica', 'grenada', 'saint kitts and nevis', 'saint lucia', 'saint vincent and the grenadines'].includes(c)) return 'North America'
    // South America
    if (['brazil', 'argentina', 'chile', 'colombia', 'peru', 'venezuela', 'ecuador', 'bolivia', 'paraguay', 'uruguay', 'guyana', 'suriname'].includes(c)) return 'South America'
    // Africa
    if (['south africa', 'nigeria', 'kenya', 'ethiopia', 'ghana', 'tanzania', 'egypt', 'morocco', 'tunisia', 'algeria', 'libya', 'sudan', 'senegal', 'mali', 'burkina faso', 'niger', 'chad', 'cameroon', 'ivory coast', 'cote d\'ivoire', 'guinea', 'benin', 'togo', 'sierra leone', 'liberia', 'mauritania', 'gabon', 'congo', 'democratic republic of the congo', 'uganda', 'rwanda', 'burundi', 'somalia', 'djibouti', 'eritrea', 'madagascar', 'mozambique', 'malawi', 'zambia', 'zimbabwe', 'botswana', 'namibia', 'angola', 'lesotho', 'eswatini', 'swaziland', 'seychelles', 'mauritius', 'comoros', 'cape verde', 'sao tome and principe', 'equatorial guinea', 'central african republic', 'republic of the congo', 'gambia', 'guinea-bissau'].includes(c)) return 'Africa'
    // Oceania
    if (['australia', 'new zealand', 'fiji', 'papua new guinea', 'samoa', 'tonga', 'vanuatu', 'solomon islands', 'micronesia', 'marshall islands', 'palau', 'kiribati', 'nauru', 'tuvalu'].includes(c)) return 'Oceania'
    // Fallback: use rough longitude-based estimation
    return 'Other'
}
