const { COUNTRIES, canonicalCountry } = require('../lib/dishLists/countries.ts')

describe('canonicalCountry', () => {
    test('canonical names map to themselves', () => {
        expect(canonicalCountry('France')).toBe('France')
        expect(canonicalCountry('United States')).toBe('United States')
        expect(canonicalCountry('Democratic Republic of the Congo')).toBe('Democratic Republic of the Congo')
    })
    test('folds common aliases onto the canonical entry', () => {
        expect(canonicalCountry('USA')).toBe('United States')
        expect(canonicalCountry('United States of America')).toBe('United States')
        expect(canonicalCountry('UK')).toBe('United Kingdom')
        expect(canonicalCountry('England')).toBe('United Kingdom')
        expect(canonicalCountry('Turkey')).toBe('Türkiye')
        expect(canonicalCountry('Czech Republic')).toBe('Czechia')
        expect(canonicalCountry("Cote d'Ivoire")).toBe('Ivory Coast')
        expect(canonicalCountry('Korea')).toBe('South Korea')
        expect(canonicalCountry('DRC')).toBe('Democratic Republic of the Congo')
    })
    test('is case, accent and whitespace insensitive', () => {
        expect(canonicalCountry('  france ')).toBe('France')
        expect(canonicalCountry('TÜRKIYE')).toBe('Türkiye')
        expect(canonicalCountry('turkiye')).toBe('Türkiye')
    })
    test('keeps unknown entries unchanged (free text still works)', () => {
        expect(canonicalCountry('Scotland')).toBe('Scotland')
        expect(canonicalCountry('Atlantis')).toBe('Atlantis')
    })
    test('blank input returns blank', () => {
        expect(canonicalCountry('')).toBe('')
        expect(canonicalCountry('   ')).toBe('')
        expect(canonicalCountry(null)).toBe('')
        expect(canonicalCountry(undefined)).toBe('')
    })
    test('every COUNTRIES entry is canonical for itself', () => {
        for (const c of COUNTRIES) {
            expect(canonicalCountry(c)).toBe(c)
        }
    })
})
