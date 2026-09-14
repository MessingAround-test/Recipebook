const { sanitizeRecipeLocation } = require('../lib/dishLists/recipeLink.ts')

describe('sanitizeRecipeLocation', () => {
    test('keeps place fields and clears the attempted flag when a place is set', () => {
        const loc = sanitizeRecipeLocation({ country: 'Italy', region: 'Lazio', city: 'Rome', regionSearchFailed: true })
        expect(loc.country).toBe('Italy')
        expect(loc.region).toBe('Lazio')
        expect(loc.city).toBe('Rome')
        expect(loc.regionSearchFailed).toBe(false)
    })
    test('carries the "searched but not found" marker through', () => {
        expect(sanitizeRecipeLocation({ regionSearchFailed: true })).toEqual({ regionSearchFailed: true })
    })
    test('ignores a bare false marker', () => {
        expect(sanitizeRecipeLocation({ regionSearchFailed: false })).toBeUndefined()
    })
    test('returns undefined for empty input', () => {
        expect(sanitizeRecipeLocation({})).toBeUndefined()
        expect(sanitizeRecipeLocation(null)).toBeUndefined()
    })
})
