const { needsLocationWork, hasRegionArea, hasPoint, hasPlace } = require('../lib/dishLists/locationStatus.ts')

describe('needsLocationWork', () => {
    test('country only, no coordinates → needs work', () => {
        expect(needsLocationWork({ country: 'Italy' })).toBe(true)
    })
    test('country only but already pinned → still needs refinement', () => {
        expect(needsLocationWork({ country: 'Italy', lat: 41.9, lng: 12.5 })).toBe(true)
    })
    test('country only, pinned, and already attempted → stop retrying', () => {
        expect(needsLocationWork({ country: 'Italy', lat: 41.9, lng: 12.5, regionSearchFailed: true })).toBe(false)
    })
    test('country only, no coordinates, already attempted → stop retrying', () => {
        expect(needsLocationWork({ country: 'Italy', regionSearchFailed: true })).toBe(false)
    })
    test('region/city + coordinates → done', () => {
        expect(needsLocationWork({ country: 'Italy', region: 'Campania', city: 'Naples', lat: 40.8, lng: 14.2 })).toBe(false)
    })
    test('region without coordinates → needs work', () => {
        expect(needsLocationWork({ country: 'Italy', region: 'Campania' })).toBe(true)
    })
    test('no place info → ignored', () => {
        expect(needsLocationWork({})).toBe(false)
        expect(needsLocationWork(null)).toBe(false)
    })
})

describe('helpers', () => {
    test('hasRegionArea', () => {
        expect(hasRegionArea({ region: 'Campania' })).toBe(true)
        expect(hasRegionArea({ city: 'Naples' })).toBe(true)
        expect(hasRegionArea({ country: 'Italy' })).toBe(false)
    })
    test('hasPoint', () => {
        expect(hasPoint({ lat: 0, lng: 0 })).toBe(false)
        expect(hasPoint({ lat: 0, lng: 15 })).toBe(true)
        expect(hasPoint({ lat: 41.9, lng: 12.5 })).toBe(true)
        expect(hasPoint({ lat: 1 })).toBe(false)
        expect(hasPoint(null)).toBe(false)
    })
    test('hasPlace', () => {
        expect(hasPlace({ country: 'Italy' })).toBe(true)
        expect(hasPlace({})).toBe(false)
    })
})
