// Per-account staple recipes (rice, pasta, bread...): seeded into each
// account as NORMAL Recipe documents so every user owns editable copies —
// steps, timings and amounts are changed through the regular recipe editor.
// Templates here only define what gets created when a staple is missing;
// once seeded, the user's copy always wins.

export const STOCK_RECIPES = [
    {
        stockKey: 'white-rice',
        name: 'White rice',
        servings: 2,
        time: 'short',
        usableAsSide: true,
        sideCategory: 'starch',
        serveTemp: 'hot',
        serveTempSource: 'user',
        reheatMinutes: 0,
        ingredients: [
            { Name: 'white rice', AmountType: 'cup', Amount: 1 },
            { Name: 'water', AmountType: 'cup', Amount: 2 },
            { Name: 'salt', AmountType: 'tsp', Amount: 0.5 }
        ],
        instructions: [
            { Text: 'Rinse the rice until the water runs clear', time: 3, involvement: 'low' },
            { Text: 'Bring the water to a boil in a small pot', time: 5, involvement: 'low' },
            { Text: 'Add the rice, cover and simmer on low', time: 15, involvement: 'none' },
            { Text: 'Rest off the heat, then fluff with a fork', time: 5, involvement: 'low' }
        ]
    },
    {
        stockKey: 'brown-rice',
        name: 'Brown rice',
        servings: 2,
        time: 'medium',
        usableAsSide: true,
        sideCategory: 'starch',
        serveTemp: 'hot',
        serveTempSource: 'user',
        reheatMinutes: 0,
        ingredients: [
            { Name: 'brown rice', AmountType: 'cup', Amount: 1 },
            { Name: 'water', AmountType: 'cup', Amount: 2 },
            { Name: 'salt', AmountType: 'tsp', Amount: 0.5 }
        ],
        instructions: [
            { Text: 'Rinse the rice until the water runs clear', time: 3, involvement: 'low' },
            { Text: 'Bring the water to a boil in a small pot', time: 7, involvement: 'low' },
            { Text: 'Add the rice, cover and simmer on low', time: 25, involvement: 'none' },
            { Text: 'Rest off the heat, then fluff with a fork', time: 5, involvement: 'low' }
        ]
    },
    {
        stockKey: 'pasta',
        name: 'Pasta',
        servings: 2,
        time: 'short',
        usableAsSide: true,
        sideCategory: 'starch',
        serveTemp: 'hot',
        serveTempSource: 'user',
        reheatMinutes: 0,
        ingredients: [
            { Name: 'pasta', AmountType: 'g', Amount: 200 },
            { Name: 'water', AmountType: 'L', Amount: 2 },
            { Name: 'salt', AmountType: 'tsp', Amount: 1 }
        ],
        instructions: [
            { Text: 'Bring a large pot of salted water to a boil', time: 8, involvement: 'low' },
            { Text: 'Add the pasta and cook until al dente', time: 10, involvement: 'none' },
            { Text: 'Drain, reserving a splash of the cooking water', time: 2, involvement: 'active' }
        ]
    },
    {
        stockKey: 'bread',
        name: 'Bread / Wraps',
        servings: 2,
        time: 'short',
        usableAsSide: true,
        sideCategory: 'bread',
        serveTemp: 'hot',
        serveTempSource: 'user',
        reheatMinutes: 0,
        ingredients: [
            { Name: 'bread rolls', AmountType: 'pcs', Amount: 4 }
        ],
        instructions: [
            { Text: 'Separate the rolls or slice the loaf', time: 2, involvement: 'low' },
            { Text: 'Warm through in the oven or toaster', time: 5, involvement: 'none' }
        ]
    }
]

export const stockKeys = () => STOCK_RECIPES.map(t => t.stockKey)

/** Which staples an owner is missing. Input: their recipes' stockKey values.
 *  Unknown keys are ignored; a template counts as missing when no owned
 *  recipe carries its key (wiping a stockKey re-seeds that staple). */
export const missingStockKeys = (existingKeys) => {
    const have = new Set((existingKeys || []).filter(Boolean).map(k => String(k)))
    return STOCK_RECIPES.filter(t => !have.has(t.stockKey)).map(t => t.stockKey)
}
