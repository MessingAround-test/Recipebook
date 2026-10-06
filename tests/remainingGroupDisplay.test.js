const { remainingGroupDisplay } = require('../lib/shopMode');

// Carrot ≈ 60g each (matches the API's IngredientConversion rows)
const CARROT = { _id: 'g-carrot', name: 'carrot', isGroup: true, gramsPerEach: 60 };

const sub = (quantity, quantity_type, complete = false) => ({
    _id: `sub-${quantity}-${quantity_type}-${complete}`,
    name: 'carrot',
    quantity,
    quantity_type,
    quantity_unit: quantity_type,
    complete,
});

describe('remainingGroupDisplay', () => {
    test('subtracts ticked sub-items from the header total', () => {
        // User's example: 1/3 carrot already at home (ticked), 1 carrot to buy.
        // Full total is 81g or 1.3 carrots; remaining is 1 carrot.
        const group = {
            ...CARROT,
            items: [
                sub(1 / 3, 'x', true),
                sub(1, 'x', false),
            ],
        };
        const result = remainingGroupDisplay(group);
        expect(result.totalString).toBe('60g or 1.0 carrot');
        expect(result.quantity_type).toBe('gram');
    });

    test('returns null when nothing is ticked (full total unchanged)', () => {
        const group = {
            ...CARROT,
            totalString: '81g or 1.3 carrots',
            items: [
                sub(1 / 3, 'x', false),
                sub(1, 'x', false),
            ],
        };
        expect(remainingGroupDisplay(group)).toBeNull();
    });

    test('returns null when everything is ticked (card is struck through anyway)', () => {
        const group = {
            ...CARROT,
            items: [
                sub(1 / 3, 'x', true),
                sub(1, 'x', true),
            ],
        };
        expect(remainingGroupDisplay(group)).toBeNull();
    });

    test('counts mixed units exactly (gram sub-item remaining)', () => {
        // 200g ticked off a (200g + 1kg) milk group -> 1000g left
        const group = {
            _id: 'g-milk',
            name: 'milk',
            isGroup: true,
            gramsPerEach: 0,
            items: [
                { _id: 'a', name: 'milk', quantity: 200, quantity_type: 'gram', quantity_unit: 'gram', complete: true },
                { _id: 'b', name: 'milk', quantity: 1, quantity_type: 'kilogram', quantity_unit: 'kilogram', complete: false },
            ],
        };
        expect(remainingGroupDisplay(group).totalString).toBe('1000g');
    });

    test('counts gram + each remainders together and pluralizes', () => {
        // 1 carrot ticked, 60g remains -> 60g or 1.0 carrot (60g per carrot)
        const group = {
            ...CARROT,
            items: [
                sub(1, 'x', true),
                { _id: 'c', name: 'carrot', quantity: 60, quantity_type: 'gram', quantity_unit: 'gram', complete: false },
            ],
        };
        expect(remainingGroupDisplay(group).totalString).toBe('60g or 1.0 carrot');
    });

    test('held-off (cantFind) items still count as needing purchase', () => {
        const group = {
            ...CARROT,
            items: [
                sub(1 / 3, 'x', true),
                { ...sub(1, 'x', false), cantFind: true },
            ],
        };
        expect(remainingGroupDisplay(group).totalString).toBe('60g or 1.0 carrot');
    });

    test('each-only group without a grams factor falls back to counts', () => {
        const group = {
            _id: 'g-widget',
            name: 'widget',
            isGroup: true,
            gramsPerEach: 0,
            items: [
                sub(3, 'each', true),
                sub(2, 'each', false),
            ],
        };
        const result = remainingGroupDisplay(group);
        expect(result.totalString).toBe('2.0 widgets');
        expect(result.quantity_type).toBe('each');
    });

    test('handles fractional 1/3 strings? no — numeric quantities only', () => {
        const group = {
            ...CARROT,
            items: [sub(0.5, 'x', true), sub(1.5, 'x', false)],
        };
        const result = remainingGroupDisplay(group);
        expect(result.totalString).toBe('90g or 1.5 carrots');
    });

    test('ignores non-group entries', () => {
        expect(remainingGroupDisplay({ ...CARROT, isGroup: false, items: [sub(1, 'x', true)] })).toBeNull();
        expect(remainingGroupDisplay(null)).toBeNull();
        expect(remainingGroupDisplay({ ...CARROT })).toBeNull();
    });
});
