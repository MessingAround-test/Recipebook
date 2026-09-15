const { mapScrapedToRemixRecipe } = require('../lib/dishLists/recipeFromScrape.ts')

const SCRAPED = {
    name: 'Pizza Napoletana',
    sourceNotes: 'Rest the dough overnight.',
    ingredients: [
        { ingredient: '00 flour', converted: { name: '00 flour', quantity: 500, quantity_unit: 'g' } },
        { ingredient: 'water', converted: { name: 'Water', quantity: '325', quantity_unit: 'ml' } },
        { ingredient: 'unparseable', converted: null },
        { ingredient: 'missing converted' }
    ],
    instructions: [
        { stepNumber: 1, instruction: 'Mix the flour and water.' },
        { instruction: '  ' },
        { instruction: 'Bake hot.' }
    ]
}

describe('mapScrapedToRemixRecipe', () => {
    test('maps converted ingredients and drops the rest', () => {
        const recipe = mapScrapedToRemixRecipe(SCRAPED, 'Pizza')
        expect(recipe.ingredients).toHaveLength(2)
        expect(recipe.ingredients[0]).toEqual({
            Name: '00 flour',
            Amount: 500,
            AmountType: 'g',
            Note: 'Imported from web'
        })
        expect(recipe.ingredients[1].Name).toBe('Water')
    })

    test('maps non-empty instructions only', () => {
        const recipe = mapScrapedToRemixRecipe(SCRAPED, 'Pizza')
        expect(recipe.instructions).toEqual([
            { Text: 'Mix the flour and water.' },
            { Text: 'Bake hot.' }
        ])
    })

    test('uses the scraped name and carries source notes', () => {
        const recipe = mapScrapedToRemixRecipe(SCRAPED, 'Fallback')
        expect(recipe.name).toBe('Pizza Napoletana')
        expect(recipe.sourceNotes).toBe('Rest the dough overnight.')
    })

    test('falls back to the supplied name when the scrape has none', () => {
        const recipe = mapScrapedToRemixRecipe({ ...SCRAPED, name: '' }, 'Fallback Dish')
        expect(recipe.name).toBe('Fallback Dish')
    })

    test('defaults the unit to each', () => {
        const recipe = mapScrapedToRemixRecipe({
            name: 'X',
            ingredients: [{ converted: { name: 'Egg', quantity: 2 } }],
            instructions: [{ instruction: 'Beat the egg well.' }]
        })
        expect(recipe.ingredients[0].AmountType).toBe('each')
    })

    test('returns null when the parse is unusable', () => {
        expect(mapScrapedToRemixRecipe(null)).toBeNull()
        expect(mapScrapedToRemixRecipe({ ingredients: [], instructions: [] })).toBeNull()
        expect(mapScrapedToRemixRecipe({
            ingredients: [{ converted: { name: 'Flour' } }],
            instructions: []
        })).toBeNull()
        expect(mapScrapedToRemixRecipe({
            ingredients: [],
            instructions: [{ instruction: 'Do the thing.' }]
        })).toBeNull()
    })
})
