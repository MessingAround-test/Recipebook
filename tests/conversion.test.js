const { convertMetricReading, convertToStandardUnit, parseAmountValue, quantity_unit_conversions } = require('../lib/conversion');

test('string with a single number should result in the number itself', () => {
    expect(convertMetricReading('1').quantity).toBe(1);
});

describe('convertToStandardUnit', () => {
    test('passes known units through untouched', () => {
        expect(convertToStandardUnit('grams', '320')).toEqual({ unit: 'gram', amount: '320' });
        expect(convertToStandardUnit('cups', '1 1/2')).toEqual({ unit: 'cup', amount: '1 1/2' });
    });

    test('remaps unknown units with a standard equivalent', () => {
        expect(convertToStandardUnit('slices', '2')).toEqual({ unit: 'piece', amount: '2', note: 'slices' });
        expect(convertToStandardUnit('tins', 1)).toEqual({ unit: 'can', amount: 1, note: 'tins' });
        expect(convertToStandardUnit('splash', '1')).toEqual({ unit: 'dash', amount: '1', note: 'splash' });
    });

    test('scales quantities for multiplier mappings', () => {
        expect(convertToStandardUnit('dozen', '1')).toEqual({ unit: 'each', amount: 12, note: 'dozen' });
        expect(convertToStandardUnit('glass', '2')).toEqual({ unit: 'milliliter', amount: 500, note: 'glass' });
    });

    test('falls back to each when a scaled amount cannot be parsed', () => {
        expect(convertToStandardUnit('dozen', 'some')).toEqual({ unit: 'each', amount: 'some', note: 'dozen' });
    });

    test('falls back to each with a note for completely unknown units', () => {
        expect(convertToStandardUnit('mysteryunit', '3')).toEqual({ unit: 'each', amount: '3', note: 'mysteryunit' });
    });

    test('defaults missing units to each', () => {
        expect(convertToStandardUnit(undefined, 1)).toEqual({ unit: 'each', amount: 1 });
    });

    test('every mapping target is a standard unit key', () => {
        const { SMART_UNIT_MAPPINGS } = require('../lib/conversion');
        for (const key of Object.keys(SMART_UNIT_MAPPINGS)) {
            expect(quantity_unit_conversions[SMART_UNIT_MAPPINGS[key].unit]).toBeDefined();
        }
    });
});

describe('parseAmountValue', () => {
    test('parses numbers, decimals and fractions', () => {
        expect(parseAmountValue(2)).toBe(2);
        expect(parseAmountValue('320')).toBe(320);
        expect(parseAmountValue('1/2')).toBe(0.5);
        expect(parseAmountValue('1 1/2')).toBe(1.5);
    });

    test('returns null for unparseable input', () => {
        expect(parseAmountValue('pinch')).toBeNull();
        expect(parseAmountValue('')).toBeNull();
        expect(parseAmountValue(undefined)).toBeNull();
    });
});