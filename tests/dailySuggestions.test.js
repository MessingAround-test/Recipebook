const { getDailySuggestion, getDailySuggestionFromCoverage } = require('../lib/dailySuggestions');

describe('getDailySuggestion', () => {
    const targets = { energy_kcal: 2400, protein_g: 112, fat_g: 80, carbohydrates_g: 280, sodium_mg: 2300 };

    test('returns exercise advice when fat is over 100%', () => {
        const totals = { fat_g: 112 };
        const rule = getDailySuggestion(totals, targets);
        expect(rule).not.toBeNull();
        expect(rule.message).toMatch(/exercise/i);
    });

    test('returns water advice when sodium is over 100%', () => {
        const totals = { sodium_mg: 2500 };
        const rule = getDailySuggestion(totals, targets);
        expect(rule).not.toBeNull();
        expect(rule.message).toMatch(/water/i);
    });

    test('returns null (balanced) when nothing is over 100%', () => {
        const totals = { fat_g: 40, sodium_mg: 1500, energy_kcal: 1800 };
        expect(getDailySuggestion(totals, targets)).toBeNull();
    });

    test('returns null when targets are missing', () => {
        expect(getDailySuggestion({ fat_g: 200 }, null)).toBeNull();
    });
});

describe('getDailySuggestionFromCoverage', () => {
    test('returns exercise advice when planned fat is over 100%', () => {
        const coverage = [
            { key: 'energy_kcal', pct: 90 },
            { key: 'fat_g', pct: 140 },
            { key: 'sodium_mg', pct: 80 }
        ];
        const rule = getDailySuggestionFromCoverage(coverage);
        expect(rule).not.toBeNull();
        expect(rule.message).toMatch(/exercise/i);
    });

    test('returns water advice when planned sodium is over 100%', () => {
        const coverage = [{ key: 'sodium_mg', pct: 120 }];
        const rule = getDailySuggestionFromCoverage(coverage);
        expect(rule).not.toBeNull();
        expect(rule.message).toMatch(/water/i);
    });

    test('returns null (balanced) when nothing planned is over 100%', () => {
        const coverage = [
            { key: 'energy_kcal', pct: 85 },
            { key: 'fat_g', pct: 70 },
            { key: 'sodium_mg', pct: 60 }
        ];
        expect(getDailySuggestionFromCoverage(coverage)).toBeNull();
    });

    test('returns null when coverage is missing', () => {
        expect(getDailySuggestionFromCoverage(null)).toBeNull();
        expect(getDailySuggestionFromCoverage(undefined)).toBeNull();
        expect(getDailySuggestionFromCoverage([])).toBeNull();
    });
});
