const { normalizeExtractedIngredients, normalizePrepWords, normalizeExtractedInstructions } = require('../lib/recipeNormalize');

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

    test('remaps unknown piece-like units and keeps the original in the note', () => {
        const result = normalizeExtractedIngredients([
            { Name: 'Tomato', Amount: '2', AmountType: 'slices' }
        ]);
        expect(result[0].AmountType).toBe('piece');
        expect(result[0].Amount).toBe('2');
        expect(result[0].Note).toBe('slices');
    });

    test('scales dozen to 12 each', () => {
        const result = normalizeExtractedIngredients([
            { Name: 'Eggs', Amount: '1', AmountType: 'dozen' }
        ]);
        expect(result[0].AmountType).toBe('each');
        expect(result[0].Amount).toBe(12);
        expect(result[0].Note).toBe('dozen');
    });

    test('scales mixed fractions when converting units', () => {
        const result = normalizeExtractedIngredients([
            { Name: 'Eggs', Amount: '1 1/2', AmountType: 'dozen' }
        ]);
        expect(result[0].AmountType).toBe('each');
        expect(result[0].Amount).toBe(18);
    });

    test('falls back to each with note for unmapped units', () => {
        const result = normalizeExtractedIngredients([
            { Name: 'Saffron', Amount: 'pinch', AmountType: 'mysteryunit' }
        ]);
        expect(result[0].AmountType).toBe('each');
        expect(result[0].Note).toBe('mysteryunit');
    });

    test('merges the remapped unit into an existing note', () => {
        const result = normalizeExtractedIngredients([
            { Name: 'Onion', Amount: '3', AmountType: 'slices', Note: 'for the stock' }
        ]);
        expect(result[0].AmountType).toBe('piece');
        expect(result[0].Note).toBe('slices, for the stock');
    });

    test('accepts British spellings via synonyms', () => {
        const result = normalizeExtractedIngredients([
            { Name: 'Milk', Amount: '2', AmountType: 'litres' }
        ]);
        expect(result[0].AmountType).toBe('liter');
        expect(result[0].Note).toBeUndefined();
    });

    test('returns non-arrays unchanged', () => {
        expect(normalizeExtractedIngredients(null)).toBeNull();
        expect(normalizeExtractedIngredients('nope')).toBe('nope');
    });
});

describe('normalizeExtractedInstructions', () => {
    test('normalizes alternate object keys', () => {
        const result = normalizeExtractedInstructions([
            { text: 'Fry 500g chicken', note: '5 mins' },
            { Text: 'Serve' }
        ]);
        expect(result).toEqual([
            { Text: 'Fry 500g chicken', Note: '5 mins' },
            { Text: 'Serve' }
        ]);
    });

    test('splits a numbered block string into steps', () => {
        const result = normalizeExtractedInstructions('1. Preheat oven\n2. Mix 200g flour with 2 eggs');
        expect(result).toEqual([
            { Text: 'Preheat oven' },
            { Text: 'Mix 200g flour with 2 eggs' }
        ]);
    });

    test('splits "Step N:" markers inside a single string entry', () => {
        const result = normalizeExtractedInstructions(['Step 1: Boil 300g pasta. Step 2: Drain.']);
        expect(result).toEqual([
            { Text: 'Boil 300g pasta.' },
            { Text: 'Drain.' }
        ]);
    });

    test('keeps plain unnumbered steps intact', () => {
        const result = normalizeExtractedInstructions(['Cook for 5 minutes, then serve.']);
        expect(result).toEqual([{ Text: 'Cook for 5 minutes, then serve.' }]);
    });

    test('returns an empty array for missing or empty input', () => {
        expect(normalizeExtractedInstructions(undefined)).toEqual([]);
        expect(normalizeExtractedInstructions('')).toEqual([]);
        expect(normalizeExtractedInstructions([])).toEqual([]);
        expect(normalizeExtractedInstructions([null, '', { foo: 'bar' }])).toEqual([]);
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

describe('normalizeExtractedIngredients (unicode fractions)', () => {
    const { normalizeUnicodeFractions } = require('../lib/conversion');

    test('normalizeUnicodeFractions expands glyphs to ASCII fractions', () => {
        expect(normalizeUnicodeFractions('\u00bd tbsp')).toBe('1/2 tbsp');
        expect(normalizeUnicodeFractions('1\u00bd cups')).toBe('1 1/2 cups');
        expect(normalizeUnicodeFractions('\u00bc')).toBe('1/4');
        expect(normalizeUnicodeFractions(3)).toBe(3);
    });

    test('converts unicode fraction amounts to parseable fractions', () => {
        const result = normalizeExtractedIngredients([
            { Name: 'Neutral oil', Amount: '\u00bd', AmountType: 'tablespoon' },
            { Name: 'Soy milk', Amount: '\u00bd cup', AmountType: 'cup' }
        ]);
        expect(result[0].Amount).toBe('1/2');
        expect(result[0].AmountType).toBe('tablespoon');
        expect(result[1].Amount).toBe('1/2');
        expect(result[1].AmountType).toBe('cup');
    });
});
