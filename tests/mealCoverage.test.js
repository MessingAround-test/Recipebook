import {
    hasMealCoverage,
    getRequiredServings,
    getDayAnchorServings,
    getSlotPlannedPeople,
    computeBlockServings,
    applyCoverageByIndex,
    shiftDate
} from '../lib/mealCoverage';

describe('hasMealCoverage', () => {
    test('false for missing / empty coverage', () => {
        expect(hasMealCoverage({ defaultServings: 2 })).toBe(false);
        expect(hasMealCoverage({ mealCoverage: {} })).toBe(false);
        expect(hasMealCoverage({ mealCoverage: { '2026-10-20': {} } })).toBe(false);
        expect(hasMealCoverage(null)).toBe(false);
    });

    test('true when any day carries meal values', () => {
        expect(hasMealCoverage({ mealCoverage: { '2026-10-20': { Dinner: 2 } } })).toBe(true);
    });
});

describe('getRequiredServings', () => {
    const plan = { defaultServings: 2, mealCoverage: { '2026-10-20': { Breakfast: 1, Dinner: 2 } } };

    test('falls back to defaultServings for missing day / meal', () => {
        expect(getRequiredServings(plan, '2026-10-21', 'Dinner')).toBe(2);
        expect(getRequiredServings(plan, '2026-10-20', 'Lunch')).toBe(2);
        expect(getRequiredServings(plan, 'Undecided', 'Dinner')).toBe(2);
    });

    test('falls back to defaultServings when no coverage at all', () => {
        expect(getRequiredServings({ defaultServings: 3, mealCoverage: {} }, '2026-10-20', 'Dinner')).toBe(3);
        expect(getRequiredServings({}, '2026-10-20', 'Dinner')).toBe(2);
    });

    test('returns the coverage value when set', () => {
        expect(getRequiredServings(plan, '2026-10-20', 'Breakfast')).toBe(1);
        expect(getRequiredServings(plan, '2026-10-20', 'Dinner')).toBe(2);
    });

    test('clamps garbage to at least 1', () => {
        const weird = { defaultServings: 2, mealCoverage: { '2026-10-20': { Lunch: 0, Snack: -3 } } };
        expect(getRequiredServings(weird, '2026-10-20', 'Lunch')).toBe(1);
        expect(getRequiredServings(weird, '2026-10-20', 'Snack')).toBe(1);
    });
});

describe('getDayAnchorServings', () => {
    test('split day: min across meals is the person there all day', () => {
        // You home all day, wife only at dinner
        const plan = {
            defaultServings: 2,
            mealCoverage: { '2026-10-20': { Breakfast: 1, Lunch: 1, Dinner: 2, Snack: 1 } }
        };
        expect(getDayAnchorServings(plan, '2026-10-20')).toBe(1);
    });

    test('full 2-person day counts 2', () => {
        const plan = {
            defaultServings: 2,
            mealCoverage: { '2026-10-20': { Breakfast: 2, Lunch: 2, Dinner: 2, Snack: 2 } }
        };
        expect(getDayAnchorServings(plan, '2026-10-20')).toBe(2);
    });

    test('meals set to 0 are excluded from the min', () => {
        const plan = {
            defaultServings: 2,
            mealCoverage: { '2026-10-20': { Breakfast: 0, Lunch: 0, Dinner: 2, Snack: 0 } }
        };
        expect(getDayAnchorServings(plan, '2026-10-20')).toBe(2);
    });

    test('falls back when day missing or all meals zero', () => {
        const plan = { defaultServings: 2, mealCoverage: { '2026-10-20': { Breakfast: 0, Lunch: 0, Dinner: 0, Snack: 0 } } };
        expect(getDayAnchorServings(plan, '2026-10-21')).toBe(2);
        expect(getDayAnchorServings(plan, '2026-10-20')).toBe(2);
        expect(getDayAnchorServings({}, '2026-10-20')).toBe(2);
    });

    test('partial coverage: unset meals count at default in the min', () => {
        // Only dinner raised to 1; breakfast/lunch/snack still default to 2
        const plan = { defaultServings: 2, mealCoverage: { '2026-10-20': { Dinner: 1 } } };
        expect(getDayAnchorServings(plan, '2026-10-20')).toBe(1);

        // A single meal ABOVE default cannot raise the anchor past the
        // unset meals, which still need the default headcount.
        const high = { defaultServings: 2, mealCoverage: { '2026-10-20': { Dinner: 3 } } };
        expect(getDayAnchorServings(high, '2026-10-20')).toBe(2);
    });
});

describe('getSlotPlannedPeople', () => {
    const plan = {
        plannedRecipes: [
            { day: '2026-10-20', mealType: 'Dinner', servings: 2 },
            { day: '2026-10-20', mealType: 'Dinner', servings: 3, isLeftover: true },
            { day: '2026-10-20', mealType: 'Lunch', servings: 1 },
            { day: '2026-10-21', mealType: 'Dinner', servings: 4 }
        ]
    };

    test('max block in the slot, not the sum (each dish feeds the same people)', () => {
        expect(getSlotPlannedPeople(plan, '2026-10-20', 'Dinner')).toBe(3);
        expect(getSlotPlannedPeople(plan, '2026-10-20', 'Lunch')).toBe(1);
    });

    test('empty slot / empty plan is 0', () => {
        expect(getSlotPlannedPeople(plan, '2026-10-20', 'Breakfast')).toBe(0);
        expect(getSlotPlannedPeople({ plannedRecipes: [] }, '2026-10-20', 'Dinner')).toBe(0);
        expect(getSlotPlannedPeople({}, '2026-10-20', 'Dinner')).toBe(0);
    });
});

describe('computeBlockServings', () => {
    test('yield above required: cook feeds required, rest becomes leftovers', () => {
        expect(computeBlockServings(4, 2)).toEqual({ primary: 2, leftover: 2 });
    });

    test('yield equal to required: no leftovers', () => {
        expect(computeBlockServings(2, 2)).toEqual({ primary: 2, leftover: 0 });
    });

    test('yield below required: keeps yield (slot flagged for scale-up)', () => {
        expect(computeBlockServings(1, 3)).toEqual({ primary: 1, leftover: 0 });
    });

    test('never produces a zero-serving block', () => {
        expect(computeBlockServings(0, 0).primary).toBe(1);
        expect(computeBlockServings(4, 0).primary).toBe(1);
    });
});

describe('applyCoverageByIndex', () => {
    const sourceCoverage = {
        '2026-10-05': { Breakfast: 1, Dinner: 2 },
        '2026-10-06': { Breakfast: 2, Lunch: 2, Dinner: 2 },
        '2026-10-07': { Dinner: 1 }
    };

    test('maps source day i onto target day i; unlisted meals get the standard default', () => {
        const targetDays = ['2026-10-12', '2026-10-13', '2026-10-14'];
        const result = applyCoverageByIndex(sourceCoverage, '2026-10-05', 7, targetDays, 2);
        expect(result['2026-10-12']).toEqual({ Breakfast: 1, Lunch: 2, Dinner: 2, Snack: 2 });
        expect(result['2026-10-13']).toEqual({ Breakfast: 2, Lunch: 2, Dinner: 2, Snack: 2 });
        expect(result['2026-10-14']).toEqual({ Breakfast: 2, Lunch: 2, Dinner: 1, Snack: 2 });
    });

    test('target days beyond the source are reset to the standard default', () => {
        const targetDays = ['2026-10-12', '2026-10-13', '2026-10-14'];
        const result = applyCoverageByIndex({ '2026-10-05': { Dinner: 2 } }, '2026-10-05', 1, targetDays, 3);
        expect(result['2026-10-12']).toEqual({ Breakfast: 3, Lunch: 3, Dinner: 2, Snack: 3 });
        expect(result['2026-10-13']).toEqual({ Breakfast: 3, Lunch: 3, Dinner: 3, Snack: 3 });
        expect(result['2026-10-14']).toEqual({ Breakfast: 3, Lunch: 3, Dinner: 3, Snack: 3 });
    });

    test('source days without coverage fall back to the standard default', () => {
        const targetDays = ['2026-10-12', '2026-10-13'];
        const result = applyCoverageByIndex(
            { '2026-10-05': { Dinner: 2 }, '2026-10-07': { Lunch: 1 } },
            '2026-10-05', 7, targetDays, 2
        );
        expect(result['2026-10-12']).toEqual({ Breakfast: 2, Lunch: 2, Dinner: 2, Snack: 2 });
        // source day index 1 (10-06) had no coverage → full standard default
        expect(result['2026-10-13']).toEqual({ Breakfast: 2, Lunch: 2, Dinner: 2, Snack: 2 });
    });

    test('is a full replacement — every target day is materialized', () => {
        const targetDays = ['2026-10-12', '2026-10-13'];
        const result = applyCoverageByIndex({}, '2026-10-05', 7, targetDays, 2);
        expect(Object.keys(result)).toEqual(targetDays);
        expect(result['2026-10-12']).toEqual({ Breakfast: 2, Lunch: 2, Dinner: 2, Snack: 2 });
    });

    test('missing inputs return an empty result', () => {
        expect(applyCoverageByIndex(null, '2026-10-05', 7, ['2026-10-12'], 2)).toEqual({});
        expect(applyCoverageByIndex({}, null, 7, ['2026-10-12'], 2)).toEqual({});
    });
});

describe('shiftDate', () => {
    test('shifts across month boundaries', () => {
        expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01');
        expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
    });

    test('zero keeps the date', () => {
        expect(shiftDate('2026-10-20', 0)).toBe('2026-10-20');
    });
});
