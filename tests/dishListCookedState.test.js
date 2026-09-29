const { linkedRecipeIds, recipeDerivedCookedIds } = require('../lib/dishLists/cookedState.js')

describe('linkedRecipeIds', () => {
    test('prefers the recipeIds list', () => {
        expect(linkedRecipeIds({ recipeIds: ['a', 'b'], recipeId: 'c' })).toEqual(['a', 'b'])
    })

    test('falls back to the scalar recipeId', () => {
        expect(linkedRecipeIds({ recipeId: 'c' })).toEqual(['c'])
    })

    test('returns nothing when no recipe is linked', () => {
        expect(linkedRecipeIds({})).toEqual([])
        expect(linkedRecipeIds(null)).toEqual([])
        expect(linkedRecipeIds({ recipeIds: [] })).toEqual([])
    })
})

describe('recipeDerivedCookedIds', () => {
    const items = [
        { _id: 'i1', recipeId: 'r1' },
        { _id: 'i2', recipeIds: ['r2', 'r3'] },
        { _id: 'i3', recipeId: 'r4' },
        { _id: 'i4' }
    ]

    test('maps cooked recipes back to their items', () => {
        const cooked = recipeDerivedCookedIds(items, ['r1'])
        expect(cooked.has('i1')).toBe(true)
        expect(cooked.has('i2')).toBe(false)
        expect(cooked.size).toBe(1)
    })

    test('matches any of a multi-recipe item', () => {
        const cooked = recipeDerivedCookedIds(items, ['r3'])
        expect(cooked.has('i2')).toBe(true)
    })

    test('ignores items with no linked recipe', () => {
        const cooked = recipeDerivedCookedIds(items, ['r1', 'r4'])
        expect(cooked.has('i4')).toBe(false)
        expect(cooked.size).toBe(2)
    })

    test('returns empty for no cooked recipes', () => {
        expect(recipeDerivedCookedIds(items, []).size).toBe(0)
    })
})
