// Per-account stock staples: templates must be valid usable-side recipes,
// missing-detection drives the recreate-if-missing seeding policy, and the
// server seeder creates only what's absent with the owner's identity.
const { STOCK_RECIPES, stockKeys, missingStockKeys } = require('../lib/stockRecipes');

jest.mock('../models/Recipe', () => ({
    __esModule: true,
    default: { find: jest.fn(), insertMany: jest.fn() }
}));

describe('stock staple templates', () => {
    test('are the agreed four, with unique keys', () => {
        expect(stockKeys().sort()).toEqual(['bread', 'brown-rice', 'pasta', 'white-rice']);
        expect(new Set(stockKeys()).size).toBe(STOCK_RECIPES.length);
    });

    test('every template is a valid usable-side recipe', () => {
        const cats = ['salad', 'vegetable', 'starch', 'bread', 'other'];
        STOCK_RECIPES.forEach(t => {
            expect(typeof t.stockKey).toBe('string');
            expect(t.name).toBeTruthy();
            expect(t.usableAsSide).toBe(true);
            expect(cats).toContain(t.sideCategory);
            expect(t.serveTemp).toBe('hot');
            expect(t.serveTempSource).toBe('user');
            expect(['short', 'medium', 'long']).toContain(t.time);
            expect(t.servings).toBeGreaterThan(0);
        });
    });

    test('steps carry text + minutes; ingredients carry name/type/amount', () => {
        STOCK_RECIPES.forEach(t => {
            expect(t.instructions.length).toBeGreaterThan(0);
            t.instructions.forEach(i => {
                expect(typeof i.Text).toBe('string');
                expect(i.Text.trim().length).toBeGreaterThan(0);
                expect(typeof i.time).toBe('number');
                expect(i.time).toBeGreaterThanOrEqual(0);
            });
            expect(t.ingredients.length).toBeGreaterThan(0);
            t.ingredients.forEach(g => {
                expect(typeof g.Name).toBe('string');
                expect(typeof g.AmountType).toBe('string');
                expect(Number.isFinite(g.Amount)).toBe(true);
            });
        });
    });
});

describe('missingStockKeys', () => {
    test('empty library -> every staple', () => {
        expect(missingStockKeys([]).sort()).toEqual(stockKeys().sort());
    });

    test('complete library -> nothing', () => {
        expect(missingStockKeys(stockKeys())).toEqual([]);
    });

    test('ignores unknown and absent keys', () => {
        expect(missingStockKeys(['white-rice', 'my-own-recipe', null, undefined]))
            .toEqual(['brown-rice', 'pasta', 'bread']);
        expect(missingStockKeys(undefined).length).toBe(STOCK_RECIPES.length);
    });
});

describe('ensureStockRecipes', () => {
    const Recipe = require('../models/Recipe').default;
    const { ensureStockRecipes } = require('../lib/stockRecipesServer');

    beforeEach(() => jest.clearAllMocks());

    test('creates only the missing staples, stamped with the owner', async () => {
        Recipe.find.mockReturnValue({ lean: async () => [{ stockKey: 'white-rice' }] });
        const created = await ensureStockRecipes({ email: 'ana@example.com', username: 'ana' });

        expect(created).toBe(3);
        expect(Recipe.find).toHaveBeenCalledWith(
            expect.objectContaining({ creator_email: 'ana@example.com' }),
            { stockKey: 1 }
        );
        expect(Recipe.insertMany).toHaveBeenCalledTimes(1);
        const docs = Recipe.insertMany.mock.calls[0][0];
        expect(docs.map(d => d.stockKey).sort()).toEqual(['bread', 'brown-rice', 'pasta']);
        docs.forEach(d => {
            expect(d.creator_email).toBe('ana@example.com');
            expect(d.creator_username).toBe('ana');
            expect(d.usableAsSide).toBe(true);
        });
    });

    test('a complete library writes nothing (edits are never overwritten)', async () => {
        Recipe.find.mockReturnValue({ lean: async () => stockKeys().map(k => ({ stockKey: k })) });
        const created = await ensureStockRecipes({ email: 'bob@example.com', username: 'bob' });
        expect(created).toBe(0);
        expect(Recipe.insertMany).not.toHaveBeenCalled();
    });

    test('a deleted staple comes back on the next seed', async () => {
        Recipe.find.mockReturnValue({ lean: async () => [] });
        const created = await ensureStockRecipes({ email: 'cat@example.com', username: 'cat' });
        expect(created).toBe(STOCK_RECIPES.length);
    });
});
