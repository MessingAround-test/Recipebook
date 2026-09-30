const { getMealSlot, selectSuggestedMeals, SLOT_LABELS, SLOT_EMOJI } = require('../lib/mealSuggestion');

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
