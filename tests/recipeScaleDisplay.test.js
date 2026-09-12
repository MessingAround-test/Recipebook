const { rescaleDisplayAmount } = require('../lib/conversion');

describe('rescaleDisplayAmount — volume downscaling', () => {
    test('0.08 cup scaled quarter → 1 1/4 tbsp', () => {
        // 0.25 * 0.08 cup = 0.02 cup = 5.68 ml ?no — user example: scale factor makes it small
        // 0.08 cup at f=0.375 of a 0.2133-cup base ~ same result: 22.74 ml
        const q = 2.5 * 0.08; // 0.2 cup scaled by 0.4 -> 0.08 cup = 22.73 ml
        expect(rescaleDisplayAmount(q, 'cup', 0.4))
            .toEqual({ quantity: 1.25, unit: 'tablespoon' });
    });

    test('0.16 cup scaled quarter → 2 1/2 tbsp', () => {
        expect(rescaleDisplayAmount(0.64, 'cup', 0.25))
            .toEqual({ quantity: 2.5, unit: 'tablespoon' });
    });

    test('stays in cups when the amount is big enough', () => {
        expect(rescaleDisplayAmount(1, 'cup', 1)).toEqual({ quantity: 1, unit: 'cup' });
    });

    test('tiny amounts step down to tsp within tolerance', () => {
        // 0.01 cup = 2.84 ml = 0.48 tsp → snaps to 1/2 tsp (4.2% off)
        expect(rescaleDisplayAmount(0.02, 'cup', 0.5))
            .toEqual({ quantity: 0.5, unit: 'teaspoon' });
    });

    test('sub-quarter-tsp amounts fall back to ml', () => {
        // 0.005 cup = 1.42 ml = 0.24 tsp → too small/imprecise → ml
        expect(rescaleDisplayAmount(0.008, 'cup', 0.5))
            .toEqual({ quantity: 1, unit: 'milliliter' });
    });

    test('exact quarter cup wins over 4 tbsp (minimum quantity)', () => {
        expect(rescaleDisplayAmount(1, 'cup', 0.25))
            .toEqual({ quantity: 0.25, unit: 'cup' });
    });

    test('snapped within 5% tolerance (tsp)', () => {
        // 0.05 cup = 14.2 ml = 2.40 tsp → snaps to 2.5 (4.3% off)
        expect(rescaleDisplayAmount(0.1, 'cup', 0.5))
            .toEqual({ quantity: 2.5, unit: 'teaspoon' });
    });

    test('whole tbsp when cup is not clean', () => {
        // 0.375 cup: cup snap (0.5) is 33% off → 6 tbsp exact
        expect(rescaleDisplayAmount(0.75, 'cup', 0.5))
            .toEqual({ quantity: 6, unit: 'tablespoon' });
    });
});

describe('rescaleDisplayAmount — weight', () => {
    test('grams scale and stay grams', () => {
        expect(rescaleDisplayAmount(400, 'gram', 0.5))
            .toEqual({ quantity: 200, unit: 'gram' });
    });

    test('kilograms collapse to grams when scaled down', () => {
        expect(rescaleDisplayAmount(1, 'kilogram', 0.5))
            .toEqual({ quantity: 500, unit: 'gram' });
    });

    test('ounces collapse to grams when scaled down', () => {
        expect(rescaleDisplayAmount(2, 'ounce', 0.5))
            .toEqual({ quantity: Math.round(28.3495), unit: 'gram' });
    });
});

describe('rescaleDisplayAmount — each-style units', () => {
    test('each stays each with quarter snapping', () => {
        expect(rescaleDisplayAmount(3, 'each', 0.5))
            .toEqual({ quantity: 1.5, unit: 'each' });
    });

    test('clove-type units keep their unit', () => {
        expect(rescaleDisplayAmount(2, 'clove', 0.25))
            .toEqual({ quantity: 0.5, unit: 'clove' });
    });
});

describe('rescaleDisplayAmount — passthrough + guards', () => {
    test('unscaled (f=1) values pass through untouched', () => {
        expect(rescaleDisplayAmount(0.16, 'cup', 1))
            .toEqual({ quantity: 0.16, unit: 'cup' });
        expect(rescaleDisplayAmount(0.5, 'pound', 1))
            .toEqual({ quantity: 0.5, unit: 'pound' });
    });

    test('zero / invalid quantities return zero', () => {
        expect(rescaleDisplayAmount(0, 'cup', 0.5)).toEqual({ quantity: 0, unit: 'cup' });
        expect(rescaleDisplayAmount(NaN, 'cup', 0.5)).toEqual({ quantity: 0, unit: 'cup' });
    });
});
