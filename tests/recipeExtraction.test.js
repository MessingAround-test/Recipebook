const { getEachUnitIngredientNames, warmIngredientConversions, normalizeAmount } = require('../lib/recipeExtraction');

describe('normalizeAmount', () => {
    test('parses plain numbers and ASCII fractions', () => {
        expect(normalizeAmount(2)).toBe(2);
        expect(normalizeAmount('320')).toBe(320);
        expect(normalizeAmount('1/2')).toBe(0.5);
        expect(normalizeAmount('1 1/2')).toBe(1.5);
    });

    test('converts unicode fraction glyphs from social media captions', () => {
        expect(normalizeAmount('½')).toBe(0.5);
        expect(normalizeAmount('¼')).toBe(0.25);
        expect(normalizeAmount('¾')).toBe(0.75);
        expect(normalizeAmount('1½')).toBe(1.5);
        expect(normalizeAmount('½ cup')).toBe(0.5);
    });

    test('ignores non-numeric text', () => {
        expect(normalizeAmount('')).toBe(0);
        expect(normalizeAmount('to taste')).toBe(0);
        expect(normalizeAmount(NaN)).toBe(0);
    });
});

describe('getEachUnitIngredientNames', () => {
    test('collects deduped names from each-unit rows only', () => {
        const ingredients = [
            { Name: 'Potato', Amount: 3, AmountType: 'each' },
            { Name: '  rice ', Amount: 1, AmountType: 'each' },
            { Name: 'POTATO', Amount: 2, AmountType: 'each' },
            { Name: 'Flour', Amount: 200, AmountType: 'gram' },
            { Name: 'Milk', Amount: 500, AmountType: 'milliliter' },
            { Name: '', Amount: 1, AmountType: 'each' }
        ];
        expect(getEachUnitIngredientNames(ingredients)).toEqual(['Potato', 'rice']);
    });

    test('is case-insensitive when deduping, keeping the first spelling', () => {
        const ingredients = [
            { Name: 'Egg', Amount: 6, AmountType: 'each' },
            { Name: 'egg', Amount: 12, AmountType: 'each' },
            { Name: 'EGG', Amount: 1, AmountType: 'each' }
        ];
        expect(getEachUnitIngredientNames(ingredients)).toEqual(['Egg']);
    });

    test('returns empty array for empty or missing input', () => {
        expect(getEachUnitIngredientNames([])).toEqual([]);
        expect(getEachUnitIngredientNames(null)).toEqual([]);
        expect(getEachUnitIngredientNames(undefined)).toEqual([]);
    });
});

describe('warmIngredientConversions', () => {
    beforeEach(() => {
        global.localStorage = { getItem: () => 'test-token' };
    });

    afterEach(() => {
        delete global.localStorage;
    });

    test('calls the lookup endpoint for each name and reports success', async () => {
        const calls = [];
        const fetchImpl = async (url, opts) => {
            calls.push({ url, opts });
            return { ok: true, json: async () => ({ success: true, res: { grams_per_each: 150 } }) };
        };

        const results = await warmIngredientConversions(['Potato', 'Rice'], fetchImpl);

        expect(results).toEqual([
            { name: 'Potato', ok: true },
            { name: 'Rice', ok: true }
        ]);
        expect(calls).toHaveLength(2);
        expect(calls[0].url).toBe('/api/Ingredients/SearchLogLookup?search_term=Potato');
        expect(calls[0].opts.headers.edgetoken).toBe('test-token');
        expect(calls[1].url).toBe('/api/Ingredients/SearchLogLookup?search_term=Rice');
    });

    test('never throws — network errors, bad statuses and failed payloads all report ok:false', async () => {
        const fetchImpl = async (url) => {
            if (url.includes('Boom')) throw new Error('network down');
            if (url.includes('BadStatus')) return { ok: false, json: async () => ({}) };
            if (url.includes('FailPayload')) return { ok: true, json: async () => ({ success: false, message: 'nope' }) };
            if (url.includes('BadJson')) return { ok: true, json: async () => { throw new Error('invalid json'); } };
            return { ok: true, json: async () => ({ success: true, res: {} }) };
        };

        const results = await warmIngredientConversions(['Boom', 'BadStatus', 'FailPayload', 'BadJson', 'Fine'], fetchImpl);

        expect(results).toEqual([
            { name: 'Boom', ok: false },
            { name: 'BadStatus', ok: false },
            { name: 'FailPayload', ok: false },
            { name: 'BadJson', ok: false },
            { name: 'Fine', ok: true }
        ]);
    });

    test('handles an empty name list without calling fetch', async () => {
        const fetchImpl = jest.fn();
        const results = await warmIngredientConversions([], fetchImpl);
        expect(results).toEqual([]);
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
