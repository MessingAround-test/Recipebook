const { buildItemUpdate } = require('../lib/dishLists/itemUpdate.js')

describe('buildItemUpdate location handling', () => {
    const existing = { country: 'Türkiye', region: 'Adana', city: 'Adana', lat: 37, lng: 35.3 }

    test('editing the country drops stale coordinates', () => {
        const { set, unset } = buildItemUpdate(
            { itemId: 'x', location: { country: 'Italy', region: 'Adana', city: 'Adana' } },
            existing
        )
        expect(set['location.country']).toBe('Italy')
        expect(unset['location.lat']).toBe('')
        expect(unset['location.lng']).toBe('')
    })

    test('editing the region/city drops stale coordinates', () => {
        const { unset } = buildItemUpdate(
            { location: { country: 'Türkiye', region: 'Istanbul', city: 'Istanbul' } },
            existing
        )
        expect(unset['location.lat']).toBe('')
        expect(unset['location.lng']).toBe('')
    })

    test('fresh coordinates from "Check exists" survive a place edit', () => {
        const { set, unset } = buildItemUpdate(
            { location: { country: 'Italy', region: 'Lazio', city: 'Rome', lat: 41.9, lng: 12.5 } },
            existing
        )
        expect(set['location.lat']).toBe(41.9)
        expect(set['location.lng']).toBe(12.5)
        expect(unset['location.lat']).toBeUndefined()
        expect(unset['location.lng']).toBeUndefined()
    })

    test('an unchanged place keeps the existing coordinates', () => {
        const { set, unset } = buildItemUpdate(
            { location: { country: 'Türkiye', region: 'Adana', city: 'Adana' } },
            existing
        )
        expect(unset['location.lat']).toBeUndefined()
        expect(unset['location.lng']).toBeUndefined()
        expect(set['location.lat']).toBeUndefined()
    })

    test('blank place fields unset the field', () => {
        const { unset } = buildItemUpdate({ location: { country: '' } }, existing)
        expect(unset['location.country']).toBe('')
    })

    test('non-numeric coordinates are unset, not coerced to 0', () => {
        const { set, unset } = buildItemUpdate(
            { location: { country: 'Italy', lat: false, lng: '' } },
            existing
        )
        expect(set['location.lat']).toBeUndefined()
        expect(unset['location.lat']).toBe('')
        expect(unset['location.lng']).toBe('')
    })

    test('explicit regionSearchFailed wins over the manual-edit reset', () => {
        const { set } = buildItemUpdate(
            { location: { country: '', region: '', city: '', regionSearchFailed: true } },
            existing
        )
        expect(set['location.regionSearchFailed']).toBe(true)
    })

    test('a place change with a blank region clears the failed marker', () => {
        const { set } = buildItemUpdate(
            { location: { country: 'Italy', region: '', city: '' } },
            existing
        )
        expect(set['location.regionSearchFailed']).toBe(false)
    })
})
