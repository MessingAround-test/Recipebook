const { normalizeExtractedIngredients, normalizePrepWords } = require('../lib/recipeNormalize');

describe('normalizeExtractedIngredients', () => {
    test('strips units off amounts and names', () => {
        const result = normalizeExtractedIngredients([
            { Name: 'gGrilled Eggplant', Amount: '320g', AmountType: 'g' }
        ]);
        expect(result[0].Name).toBe('Grilled Eggplant');
        expect(result[0].Amount).toBe('320');
        expect(result[0].AmountType).toBe('gram');
    });

    test('preserves mixed fractions', () => {
        const result = normalizeExtractedIngredients([
            { Name: 'Flour', Amount: '1 1/2', AmountType: 'cups' }
        ]);
        expect(result[0].Amount).toBe('1 1/2');
        expect(result[0].AmountType).toBe('cup');
    });

    test('keeps unknown units as-is', () => {
        const result = normalizeExtractedIngredients([
            { Name: 'Saffron', Amount: 'pinch', AmountType: 'mysteryunit' }
        ]);
        expect(result[0].AmountType).toBe('mysteryunit');
    });

    test('returns non-arrays unchanged', () => {
        expect(normalizeExtractedIngredients(null)).toBeNull();
        expect(normalizeExtractedIngredients('nope')).toBe('nope');
    });
});

describe('normalizePrepWords', () => {
    test('moves a leading prep word to the Note', () => {
        const result = normalizePrepWords([{ Name: 'mashed avocado', Amount: 1, AmountType: 'each' }]);
        expect(result[0].Name).toBe('avocado');
        expect(result[0].Note).toBe('mashed');
    });

    test('moves modifier + prep phrases to the Note', () => {
        const result = normalizePrepWords([{ Name: 'finely diced tomato', Amount: 2, AmountType: 'each' }]);
        expect(result[0].Name).toBe('tomato');
        expect(result[0].Note).toBe('finely diced');
    });

    test('merges prep into an existing Note without duplication', () => {
        const result = normalizePrepWords([{ Name: 'chopped onion', Amount: 1, AmountType: 'each', Note: 'chopped, for the salsa' }]);
        expect(result[0].Name).toBe('onion');
        expect(result[0].Note).toBe('chopped, for the salsa');
    });

    test('leaves plain base ingredients untouched', () => {
        const result = normalizePrepWords([{ Name: 'avocado', Amount: 1, AmountType: 'each' }]);
        expect(result[0].Name).toBe('avocado');
        expect(result[0].Note).toBeUndefined();
    });

    test('does not strip when the whole name is a prep word', () => {
        const result = normalizePrepWords([{ Name: 'Roasted', Amount: 1, AmountType: 'each' }]);
        expect(result[0].Name).toBe('Roasted');
    });
});
