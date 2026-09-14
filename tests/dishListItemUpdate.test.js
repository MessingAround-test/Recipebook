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

describe('buildItemUpdate role restrictions', () => {
    const existing = { country: 'Türkiye', region: 'Adana', city: 'Adana', lat: 37, lng: 35.3 }

    test('non-admins cannot edit location, notes, description or rank', () => {
        const { set, unset, addToSet } = buildItemUpdate(
            {
                notes: 'hacked',
                description: 'hacked',
                rank: 1,
                location: { country: 'Italy', region: 'Lazio', city: 'Rome', lat: 41.9, lng: 12.5 }
            },
            existing,
            { isAdmin: false }
        )
        expect(set).toEqual({})
        expect(unset).toEqual({})
        expect(addToSet).toEqual({})
    })

    test('non-admins can still mark a dish cooked', () => {
        const { set } = buildItemUpdate({ cooked: true, notes: 'ignored' }, existing, { isAdmin: false })
        expect(set.cooked).toBe(true)
        expect(set.notes).toBeUndefined()
    })

    test('non-admins can still link a recipe', () => {
        const recipeId = '507f1f77bcf86cd799439011'
        const { set, addToSet } = buildItemUpdate({ recipeId }, existing, { isAdmin: false })
        expect(set.recipeId).toBe(recipeId)
        expect(set.importStatus).toBe('linked')
        expect(addToSet.recipeIds).toBe(recipeId)
    })

    test('admins default to full edit access', () => {
        const { set } = buildItemUpdate(
            { location: { country: 'Italy', region: 'Lazio', city: 'Rome', lat: 41.9, lng: 12.5 } },
            existing
        )
        expect(set['location.country']).toBe('Italy')
        expect(set['location.lat']).toBe(41.9)
    })
})
