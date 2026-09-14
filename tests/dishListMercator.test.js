const { projectToPercent, buildTiles, buildViewportTiles, tileZoomForScale } = require('../lib/dishLists/mercator.ts')

describe('projectToPercent', () => {
    test('centre of the world is half/half', () => {
        const p = projectToPercent(0, 0)
        expect(p.x).toBeCloseTo(50)
        expect(p.y).toBeCloseTo(50)
    })
    test('greenwich/equator edges', () => {
        expect(projectToPercent(0, -180).x).toBeCloseTo(0)
        expect(projectToPercent(0, 180).x).toBeCloseTo(100)
    })
    test('clamps extreme latitudes inside the square', () => {
        const north = projectToPercent(90, 0)
        const south = projectToPercent(-90, 0)
        expect(north.y).toBeGreaterThanOrEqual(0)
        expect(south.y).toBeLessThanOrEqual(100)
    })
    test('northern latitudes sit above the equator', () => {
        expect(projectToPercent(60, 0).y).toBeLessThan(50)
    })
})

describe('buildTiles', () => {
    test('zoom 1 has 4 tiles covering the world', () => {
        const tiles = buildTiles(1)
        expect(tiles).toHaveLength(4)
        expect(tiles[0].size).toBeCloseTo(50)
        expect(tiles[0].url).toContain('basemaps.cartocdn.com/light_all/1/')
    })
    test('zoom 2 has 16 tiles', () => {
        expect(buildTiles(2)).toHaveLength(16)
    })
    test('negative zoom clamps to a single tile', () => {
        expect(buildTiles(-5)).toHaveLength(1)
    })
})

describe('buildViewportTiles', () => {
    test('a full-world view renders the whole grid', () => {
        const tiles = buildViewportTiles(2, 0, 0, 512, 512)
        expect(tiles).toHaveLength(16)
        expect(tiles[0].url).toContain('basemaps.cartocdn.com/light_all/2/')
    })
    test('zoomed in renders only the visible subset', () => {
        // span 1024 (2x) but viewport 512 → about a quarter of the tiles
        const tiles = buildViewportTiles(2, 0, 0, 1024, 512)
        expect(tiles.length).toBe(9)
    })
    test('empty before measurement', () => {
        expect(buildViewportTiles(2, 0, 0, 0, 0)).toEqual([])
    })
})

describe('tileZoomForScale', () => {
    test('country-level detail up to 800%', () => {
        expect(tileZoomForScale(1)).toBe(2)
        expect(tileZoomForScale(4)).toBe(4)
        expect(tileZoomForScale(8)).toBe(4)
    })
    test('deeper region tiles only past 800%', () => {
        expect(tileZoomForScale(9)).toBe(5)
        expect(tileZoomForScale(16)).toBe(6)
        expect(tileZoomForScale(32)).toBe(7)
    })
    test('clamped within sane bounds', () => {
        expect(tileZoomForScale(0.01)).toBeGreaterThanOrEqual(2)
        expect(tileZoomForScale(100000)).toBeLessThanOrEqual(10)
    })
})
