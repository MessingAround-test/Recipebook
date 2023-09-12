const conversion = require('../scripts/conversion.ts');

test('string with a single number should result in the number itself', () => {
    expect(conversion.convertMetricReading('1')).toBe(1);
});