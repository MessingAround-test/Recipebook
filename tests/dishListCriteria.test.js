const {
    buildSearchQuery,
    normalizeCriteria,
    tasteAtlasVariantKey,
    criteriaFromUser,
    criteriaInstruction
} = require('../lib/dishLists/criteria.ts')

describe('normalizeCriteria', () => {
    test('keeps only known criteria and dedupes', () => {
        expect(normalizeCriteria(['vegetarian', 'VEGAN', 'bogus', 'vegetarian', 'gluten_free']))
            .toEqual(['vegetarian', 'vegan', 'gluten_free'])
    })
    test('non-array yields empty', () => {
        expect(normalizeCriteria('vegetarian')).toEqual([])
        expect(normalizeCriteria(null)).toEqual([])
    })
})

describe('buildSearchQuery', () => {
    test('puts the dish first, then criteria, then recipe', () => {
        expect(buildSearchQuery('Pizza Napoletana', ['vegetarian']))
            .toBe('Pizza Napoletana vegetarian recipe')
    })
    test('includes extra free text', () => {
        expect(buildSearchQuery('Pad Thai', [], 'easy'))
            .toBe('Pad Thai easy recipe')
    })
    test('handles missing name', () => {
        expect(buildSearchQuery('', ['vegan'])).toBe('vegan recipe')
    })
})

describe('tasteAtlasVariantKey', () => {
    test('vegan wins over vegetarian', () => {
        expect(tasteAtlasVariantKey(['vegetarian', 'vegan'])).toBe('vegan-dishes')
    })
    test('vegetarian maps to its variant', () => {
        expect(tasteAtlasVariantKey(['vegetarian'])).toBe('vegetarian-dishes')
    })
    test('none maps to null', () => {
        expect(tasteAtlasVariantKey(['gluten_free'])).toBeNull()
    })
})

describe('criteriaFromUser', () => {
    test('combines preference and restrictions', () => {
        const out = criteriaFromUser({ dietary_preference: 'pescetarian', dietary_restrictions: ['dairy_free'] })
        expect(out).toEqual(['pescetarian', 'dairy_free'])
    })
    test('ignores none preference', () => {
        expect(criteriaFromUser({ dietary_preference: 'none' })).toEqual([])
    })
})

describe('criteriaInstruction', () => {
    test('empty criteria yields no instruction', () => {
        expect(criteriaInstruction([])).toBe('')
    })
    test('preference becomes a dietary rule', () => {
        expect(criteriaInstruction(['vegetarian'])).toContain('NO meat')
    })
    test('combines preference and restriction', () => {
        const text = criteriaInstruction(['vegan', 'gluten_free'])
        expect(text).toContain('NO animal products')
        expect(text).toContain('Gluten-free')
    })
})
