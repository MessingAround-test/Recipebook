const { getMealSlot, selectSuggestedMeals, selectIdeaSlot, ideaIsAfterAllPlanned, normalizeMealType, SLOT_LABELS, SLOT_EMOJI } = require('../lib/mealSuggestion');

const at = (h, m) => new Date(2026, 0, 5, h, m);

const recipe = (overrides = {}) => ({
    _id: 'r1',
    name: 'Test Recipe',
    hidden: false,
    mealTypes: ['Main'],
    ...overrides
});

describe('getMealSlot', () => {
    test('picks the slot for each time window', () => {
        expect(getMealSlot(at(5, 0))).toBe('Breakfast');
        expect(getMealSlot(at(8, 45))).toBe('Breakfast');
        expect(getMealSlot(at(10, 29))).toBe('Breakfast');
        expect(getMealSlot(at(10, 30))).toBe('Lunch');
        expect(getMealSlot(at(12, 15))).toBe('Lunch');
        expect(getMealSlot(at(13, 59))).toBe('Lunch');
        expect(getMealSlot(at(14, 0))).toBe('Snack');
        expect(getMealSlot(at(15, 0))).toBe('Snack');
        expect(getMealSlot(at(16, 29))).toBe('Snack');
        expect(getMealSlot(at(16, 30))).toBe('Main');
        expect(getMealSlot(at(19, 0))).toBe('Main');
        expect(getMealSlot(at(21, 59))).toBe('Main');
    });

    test('rolls late night over to the next morning breakfast', () => {
        expect(getMealSlot(at(22, 0))).toBe('Breakfast');
        expect(getMealSlot(at(23, 30))).toBe('Breakfast');
        expect(getMealSlot(at(0, 15))).toBe('Breakfast');
        expect(getMealSlot(at(4, 59))).toBe('Breakfast');
    });

    test('exposes a label and emoji per slot', () => {
        for (const slot of ['Breakfast', 'Lunch', 'Snack', 'Main']) {
            expect(typeof SLOT_LABELS[slot]).toBe('string');
            expect(SLOT_EMOJI[slot]).toBeTruthy();
        }
        expect(SLOT_LABELS.Main).toBe('Dinner');
    });
});

describe('selectSuggestedMeals', () => {
    test('matches mealTypes per slot', () => {
        const recipes = [
            recipe({ _id: 'b', mealTypes: ['Breakfast'] }),
            recipe({ _id: 'l', mealTypes: ['Lunch'] }),
            recipe({ _id: 's', mealTypes: ['Snack'] }),
            recipe({ _id: 'm', mealTypes: ['Main', 'Entree'] })
        ];
        expect(selectSuggestedMeals(recipes, 'Breakfast').map(r => r._id)).toEqual(['b']);
        expect(selectSuggestedMeals(recipes, 'Lunch').map(r => r._id)).toEqual(['l']);
        expect(selectSuggestedMeals(recipes, 'Snack').map(r => r._id)).toEqual(['s']);
        expect(selectSuggestedMeals(recipes, 'Main').map(r => r._id)).toEqual(['m']);
    });

    test('main slot accepts legacy Dinner and matches case-insensitively', () => {
        const recipes = [
            recipe({ _id: 'd', mealTypes: ['Dinner'] }),
            recipe({ _id: 'e', mealTypes: ['ENTREE'] }),
            recipe({ _id: 'x', mealTypes: ['Dessert'] })
        ];
        expect(selectSuggestedMeals(recipes, 'Main').map(r => r._id)).toEqual(['d', 'e']);
    });

    test('snack slot falls back to genre', () => {
        const recipes = [
            recipe({ _id: 'g', mealTypes: [], genre: 'Quick snack' }),
            recipe({ _id: 'x', mealTypes: ['Main'] })
        ];
        expect(selectSuggestedMeals(recipes, 'Snack').map(r => r._id)).toEqual(['g']);
    });

    test('drops hidden recipes', () => {
        const recipes = [
            recipe({ _id: 'a', mealTypes: ['Lunch'], hidden: true }),
            recipe({ _id: 'b', mealTypes: ['Lunch'] })
        ];
        expect(selectSuggestedMeals(recipes, 'Lunch').map(r => r._id)).toEqual(['b']);
    });

    test('relaxes to all visible recipes when nothing matches the slot', () => {
        const recipes = [
            recipe({ _id: 'a', mealTypes: ['Dessert'] }),
            recipe({ _id: 'b', mealTypes: ['Breakfast'], hidden: true })
        ];
        expect(selectSuggestedMeals(recipes, 'Lunch').map(r => r._id)).toEqual(['a']);
    });

    test('returns an empty list when there are no recipes', () => {
        expect(selectSuggestedMeals([], 'Main')).toEqual([]);
        expect(selectSuggestedMeals(null, 'Main')).toEqual([]);
    });

    test('sorts by rating, then timesCooked, then name', () => {
        const recipes = [
            recipe({ _id: 'low', name: 'Alpha', mealTypes: ['Main'], rating: 3 }),
            recipe({ _id: 'top', name: 'Zulu', mealTypes: ['Main'], rating: 5 }),
            recipe({ _id: 'mid1', name: 'Beta', mealTypes: ['Main'], rating: 4, timesCooked: 1 }),
            recipe({ _id: 'mid2', name: 'Apple', mealTypes: ['Main'], rating: 4, timesCooked: 9 })
        ];
        expect(selectSuggestedMeals(recipes, 'Main').map(r => r._id)).toEqual(['top', 'mid2', 'mid1', 'low']);
    });
});

describe('normalizeMealType', () => {
    test('maps planner meal types onto slots', () => {
        expect(normalizeMealType('Breakfast')).toBe('Breakfast');
        expect(normalizeMealType('lunch')).toBe('Lunch');
        expect(normalizeMealType('Snack')).toBe('Snack');
        expect(normalizeMealType('Dinner')).toBe('Main');
        expect(normalizeMealType(' dinner ')).toBe('Main');
        expect(normalizeMealType('Entree')).toBe('Main');
    });

    test('returns null for unknown or empty types', () => {
        expect(normalizeMealType('Dessert')).toBeNull();
        expect(normalizeMealType('')).toBeNull();
        expect(normalizeMealType(null)).toBeNull();
        expect(normalizeMealType(undefined)).toBeNull();
    });
});

describe('selectIdeaSlot', () => {
    test('keeps the current slot when nothing is planned there', () => {
        expect(selectIdeaSlot(at(12, 15), [])).toBe('Lunch');
        expect(selectIdeaSlot(at(12, 15), ['Breakfast', 'Snack', 'Dinner'])).toBe('Lunch');
    });

    test('skips planned slots going forward (lunch planned → snack)', () => {
        expect(selectIdeaSlot(at(12, 15), ['Breakfast', 'Lunch'])).toBe('Snack');
    });

    test('keeps advancing through the day (lunch + snack planned → dinner)', () => {
        expect(selectIdeaSlot(at(12, 15), ['Breakfast', 'Lunch', 'Snack'])).toBe('Main');
    });

    test('falls back to Snack when every slot is planned', () => {
        expect(selectIdeaSlot(at(12, 15), ['Breakfast', 'Lunch', 'Snack', 'Dinner'])).toBe('Snack');
    });

    test('treats planner Dinner as the Main slot', () => {
        expect(selectIdeaSlot(at(19, 0), ['Dinner'])).toBe('Breakfast');
        expect(selectIdeaSlot(at(12, 15), ['Breakfast', 'Dinner'])).toBe('Lunch');
    });

    test('wraps around past midnight when only earlier slots are free', () => {
        expect(selectIdeaSlot(at(19, 0), ['Lunch', 'Snack', 'Dinner'])).toBe('Breakfast');
    });
});

describe('ideaIsAfterAllPlanned', () => {
    test('false when the idea sits before or among the planned meals', () => {
        expect(ideaIsAfterAllPlanned('Lunch', ['Breakfast', 'Dinner'])).toBe(false);
        expect(ideaIsAfterAllPlanned('Snack', ['Breakfast', 'Lunch', 'Dinner'])).toBe(false);
        expect(ideaIsAfterAllPlanned('Breakfast', ['Lunch', 'Dinner'])).toBe(false);
    });

    test('true only when every planned meal comes earlier in the day', () => {
        expect(ideaIsAfterAllPlanned('Main', ['Breakfast', 'Lunch'])).toBe(true);
        expect(ideaIsAfterAllPlanned('Snack', ['Breakfast', 'Lunch'])).toBe(true);
        expect(ideaIsAfterAllPlanned('Lunch', ['Breakfast'])).toBe(true);
    });

    test('a tie with a planned slot counts as among, not after', () => {
        expect(ideaIsAfterAllPlanned('Snack', ['Breakfast', 'Snack'])).toBe(false);
    });

    test('no planned meals → never after', () => {
        expect(ideaIsAfterAllPlanned('Main', [])).toBe(false);
        expect(ideaIsAfterAllPlanned('Main', [null, 'Mystery'])).toBe(false);
    });
});
