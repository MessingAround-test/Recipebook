const { calculateRecipeWeight, formatWeight, formatScaledQuantity, normalizeToGrams } = require('../lib/conversion');

describe('calculateRecipeWeight', () => {
    test('sums weight-unit ingredients', () => {
        const ings = [
            { name: 'flour', quantity: 500, quantity_type: 'gram' },
            { name: 'rice', quantity: 1, quantity_type: 'kilogram' },
            { name: 'salt', quantity: 28.35, quantity_type: 'ounce' }
        ];
        const res = calculateRecipeWeight(ings, {});
        expect(res.totalGrams).toBeCloseTo(500 + 1000 + 28.35 * 28.3495);
        expect(res.resolvedCount).toBe(3);
        expect(res.totalCount).toBe(3);
    });

    test('uses grams_per_each for each units', () => {
        const ings = [
            { name: 'carrot', quantity: 2, quantity_type: 'each' },
            { name: 'onion', name2: undefined, quantity: 1, quantity_type: 'each' }
        ];
        const res = calculateRecipeWeight(ings, { carrot: 60, onion: 150 });
        expect(res.totalGrams).toBe(270);
        expect(res.resolvedCount).toBe(2);
    });

    test('skips ingredients that cannot be converted', () => {
        const ings = [
            { name: 'carrot', quantity: 2, quantity_type: 'each' },
            { name: 'mystery', quantity: 2, quantity_type: 'each' }
        ];
        const res = calculateRecipeWeight(ings, { carrot: 60, mystery: 0 });
        expect(res.totalGrams).toBe(120);
        expect(res.resolvedCount).toBe(1);
        expect(res.totalCount).toBe(2);
    });

    test('accepts both API and model shapes', () => {
        const modelShape = [{ Name: 'butter', Amount: 200, AmountType: 'gram' }];
        const res = calculateRecipeWeight(modelShape, {});
        expect(res.totalGrams).toBe(200);
    });

    test('handles missing input gracefully', () => {
        expect(calculateRecipeWeight(null, {})).toEqual({ totalGrams: 0, resolvedCount: 0, totalCount: 0 });
    });
});

describe('formatWeight', () => {
    test('shows grams under 1kg', () => {
        expect(formatWeight(500)).toBe('~500 g');
    });
    test('shows kilograms over 1000g', () => {
        expect(formatWeight(1500)).toBe('~1.5 kg');
    });
    test('handles invalid values', () => {
        expect(formatWeight(NaN)).toBe('—');
    });
});

describe('formatScaledQuantity', () => {
    test('snaps small values to quarter steps', () => {
        expect(formatScaledQuantity(0.33)).toBe(0.25);
        expect(formatScaledQuantity(1.5)).toBe(1.5);
    });
    test('rounds large values to integers', () => {
        expect(formatScaledQuantity(12.4)).toBe(12);
    });
    test('never rounds a positive value to zero', () => {
        expect(formatScaledQuantity(0.01)).toBe(0.25);
    });
    test('zero stays zero', () => {
        expect(formatScaledQuantity(0)).toBe(0);
    });
});

describe('normalizeToGrams via weight scaling', () => {
    test('scale factor maps weight targets to servings consistently', () => {
        // recipe: 400g base, 2 servings -> targeting 800g = x2 = 4 servings
        const base = calculateRecipeWeight([{ name: 'a', quantity: 400, quantity_type: 'gram' }], {}).totalGrams;
        const factor = 800 / base;
        expect(Math.round(2 * factor)).toBe(4);
    });
});
