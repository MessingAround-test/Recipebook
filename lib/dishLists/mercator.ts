// Web Mercator helpers for the world map. No mapping library needed: pins are
// positioned with percentage coordinates over an OSM tile grid, and each tile
// is placed by percentage too.

const MAX_LAT = 85.05112878

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value))

// CARTO Positron ("light_all"): a minimal basemap that shows country borders
// and names without the overwhelming state/administrative boundaries that
// OSM's default style draws at low zoom.
//
// CARTO's raster tiles now require an API key appended as ?key=. Request a
// free key at https://carto.com/basemaps/apikey and set
// NEXT_PUBLIC_CARTO_API_KEY. Without it the tiles still load but carry an
// "API key required" watermark. Attribution required either way.
const CARTO_SUBDOMAINS = ['a', 'b', 'c', 'd']
const CARTO_STYLE = 'light_all'
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY || ''

export const tileUrl = (z: number, x: number, y: number): string => {
    const sub = CARTO_SUBDOMAINS[Math.abs(x + y) % CARTO_SUBDOMAINS.length]
    const base = `https://${sub}.basemaps.cartocdn.com/${CARTO_STYLE}/${z}/${x}/${y}.png`
    return CARTO_KEY ? `${base}?key=${encodeURIComponent(CARTO_KEY)}` : base
}

/**
 * Projects lat/lng onto the normalised Mercator square (0-100 on each axis),
 * which maps directly to CSS percentage positions.
 */
export const projectToPercent = (lat: number, lng: number): { x: number; y: number } => {
    const safeLat = clamp(lat, -MAX_LAT, MAX_LAT)
    const x = ((lng + 180) / 360) * 100
    const sin = Math.sin((safeLat * Math.PI) / 180)
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 100
    return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) }
}

export interface MapTile {
    url: string
    /** Percentage position/size so tiles can be laid out without pixel math. */
    left: number
    top: number
    size: number
    key: string
}

/** Builds the full tile grid (percent-laid-out) for a given zoom level. */
export const buildTiles = (zoom: number): MapTile[] => {
    const z = Math.max(0, Math.min(19, Math.round(zoom)))
    const n = 2 ** z
    const size = 100 / n
    const tiles: MapTile[] = []
    for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
            tiles.push({
                key: `${z}/${x}/${y}`,
                url: tileUrl(z, x, y),
                left: x * size,
                top: y * size,
                size
            })
        }
    }
    return tiles
}

export interface ViewTile {
    url: string
    /** Absolute pixel rect within the viewport. */
    left: number
    top: number
    size: number
    key: string
}

/**
 * Returns only the tiles visible in the viewport for a given zoom/view. This
 * keeps the DOM tiny at high zoom (where a full grid would be tens of
 * thousands of tiles) and lets the map fetch progressively more detail.
 *
 * `span` is the on-screen size of the whole (square) world in px, `viewport`
 * the container size in px, and translate the current pan in px.
 */
export const buildViewportTiles = (
    zoom: number,
    translateX: number,
    translateY: number,
    span: number,
    viewport: number,
    margin = 0
): ViewTile[] => {
    if (!viewport || !span) return []
    const z = Math.max(0, Math.min(19, Math.round(zoom)))
    const n = 2 ** z
    const nativeTile = 256
    const worldNative = nativeTile * n
    const toTile = (native: number) => Math.floor(native / nativeTile)

    const nativeX = (display: number) => ((display - translateX) / span) * worldNative
    const nativeY = (display: number) => ((display - translateY) / span) * worldNative

    const x0 = clamp(toTile(nativeX(-margin)), 0, n - 1)
    const x1 = clamp(toTile(nativeX(viewport + margin)), 0, n - 1)
    const y0 = clamp(toTile(nativeY(-margin)), 0, n - 1)
    const y1 = clamp(toTile(nativeY(viewport + margin)), 0, n - 1)

    const tileDisplay = span / n
    const tiles: ViewTile[] = []
    for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
            tiles.push({
                key: `${z}/${x}/${y}`,
                url: tileUrl(z, x, y),
                left: x * tileDisplay + translateX,
                top: y * tileDisplay + translateY,
                size: tileDisplay
            })
        }
    }
    return tiles
}

/**
 * Picks an OSM zoom level for the current scale. Up to 800% we stay at the
 * country level (names + borders); only beyond 800% do we fetch the deeper
 * region/city tiles.
 */
export const tileZoomForScale = (scale: number): number => {
    const s = Math.max(scale, 0.01)
    const base = 2 + Math.floor(Math.log2(s))
    const capped = s <= 8 ? Math.min(base, 4) : base
    return clamp(capped, 2, 10)
}
