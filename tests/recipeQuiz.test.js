const {
    filterRecipes,
    sortMatches,
    getScaleNote,
    shuffleMatches,
    answerCount,
    DEFAULT_ANSWERS,
    CLASSIC_THRESHOLD
} = require('../lib/recipeQuiz');

const baseRecipe = (overrides = {}) => ({
    _id: 'r1',
    name: 'Test Recipe',
    time: 'short',
    priceCategory: 'cheap',
    mealTypes: ['Main'],
    timesCooked: 0,
    servings: 4,
    hidden: false,
    ...overrides
});

describe('filterRecipes', () => {
    test('returns everything except hidden when no answers set', () => {
        const recipes = [
            baseRecipe({ _id: 'a' }),
            baseRecipe({ _id: 'b', hidden: true }),
            baseRecipe({ _id: 'c', time: 'long', priceCategory: 'expensive', mealTypes: ['Dessert'] })
        ];
        const result = filterRecipes(recipes, DEFAULT_ANSWERS);
        expect(result.map(r => r._id)).toEqual(['a', 'c']);
    });

    test('filters by mealType', () => {
        const recipes = [
            baseRecipe({ _id: 'a', mealTypes: ['Breakfast'] }),
            baseRecipe({ _id: 'b', mealTypes: ['Main', 'Lunch'] })
        ];
        const result = filterRecipes(recipes, { ...DEFAULT_ANSWERS, mealType: 'Lunch' });
        expect(result.map(r => r._id)).toEqual(['b']);
    });

    test('treats missing mealTypes as wildcard', () => {
        const recipes = [
            baseRecipe({ _id: 'a', mealTypes: [] }),
            baseRecipe({ _id: 'b', mealTypes: ['Dessert'] })
        ];
        const result = filterRecipes(recipes, { ...DEFAULT_ANSWERS, mealType: 'Main' });
        expect(result.map(r => r._id)).toEqual(['a']);
    });

    test('filters by time', () => {
        const recipes = [
            baseRecipe({ _id: 'a', time: 'short' }),
            baseRecipe({ _id: 'b', time: 'long' })
        ];
        const result = filterRecipes(recipes, { ...DEFAULT_ANSWERS, time: 'short' });
        expect(result.map(r => r._id)).toEqual(['a']);
    });

    test('treats missing time as wildcard', () => {
        const recipes = [
            baseRecipe({ _id: 'a', time: null })
        ];
        const result = filterRecipes(recipes, { ...DEFAULT_ANSWERS, time: 'long' });
        expect(result.map(r => r._id)).toEqual(['a']);
    });

    test('novelty new only matches never-cooked recipes', () => {
        const recipes = [
            baseRecipe({ _id: 'a', timesCooked: 0 }),
            baseRecipe({ _id: 'b', timesCooked: 5 }),
            baseRecipe({ _id: 'c' })
        ];
        const result = filterRecipes(recipes, { ...DEFAULT_ANSWERS, novelty: 'new' });
        expect(result.map(r => r._id)).toEqual(['a', 'c']);
    });

    test('novelty classic only matches cooked 3+ times', () => {
        const recipes = [
            baseRecipe({ _id: 'a', timesCooked: 2 }),
            baseRecipe({ _id: 'b', timesCooked: 3 }),
            baseRecipe({ _id: 'c', timesCooked: 10 }),
            baseRecipe({ _id: 'd', timesCooked: null })
        ];
        const result = filterRecipes(recipes, { ...DEFAULT_ANSWERS, novelty: 'classic' });
        expect(result.map(r => r._id)).toEqual(['b', 'c']);
        expect(CLASSIC_THRESHOLD).toBe(3);
    });

    test('filters by priceCategory treating missing as wildcard', () => {
        const recipes = [
            baseRecipe({ _id: 'a', priceCategory: 'cheap' }),
            baseRecipe({ _id: 'b', priceCategory: 'expensive' }),
            baseRecipe({ _id: 'c', priceCategory: null })
        ];
        const result = filterRecipes(recipes, { ...DEFAULT_ANSWERS, price: 'cheap' });
        expect(result.map(r => r._id)).toEqual(['a', 'c']);
    });

    test('combines all filters', () => {
        const recipes = [
            baseRecipe({ _id: 'a', mealTypes: ['Main'], time: 'short', priceCategory: 'cheap', timesCooked: 5 }),
            baseRecipe({ _id: 'b', mealTypes: ['Main'], time: 'short', priceCategory: 'cheap', timesCooked: 0 }),
            baseRecipe({ _id: 'c', mealTypes: ['Lunch'], time: 'short', priceCategory: 'cheap', timesCooked: 5 })
        ];
        const answers = { mealType: 'Main', people: 2, time: 'short', novelty: 'classic', price: 'cheap' };
        const result = filterRecipes(recipes, answers);
        expect(result.map(r => r._id)).toEqual(['a']);
    });

    test('people count never filters anything', () => {
        const recipes = [
            baseRecipe({ _id: 'a', servings: 1 }),
            baseRecipe({ _id: 'b', servings: 12 })
        ];
        const result = filterRecipes(recipes, { ...DEFAULT_ANSWERS, people: 6 });
        expect(result).toHaveLength(2);
    });
});

describe('sortMatches', () => {
    test('sorts classics by most cooked first', () => {
        const matches = [
            baseRecipe({ _id: 'a', timesCooked: 3 }),
            baseRecipe({ _id: 'b', timesCooked: 9 }),
            baseRecipe({ _id: 'c', timesCooked: 5 })
        ];
        const result = sortMatches(matches, 'classic');
        expect(result.map(r => r._id)).toEqual(['b', 'c', 'a']);
    });

    test('sorts new by newest first', () => {
        const matches = [
            baseRecipe({ _id: 'a', created_at: '2026-01-01' }),
            baseRecipe({ _id: 'b', created_at: '2026-06-01' }),
            baseRecipe({ _id: 'c', created_at: null })
        ];
        const result = sortMatches(matches, 'new');
        expect(result.map(r => r._id)).toEqual(['b', 'a', 'c']);
    });

    test('does not mutate or reorder without novelty', () => {
        const matches = [baseRecipe({ _id: 'a' }), baseRecipe({ _id: 'b' })];
        const result = sortMatches(matches, null);
        expect(result.map(r => r._id)).toEqual(['a', 'b']);
        expect(result).not.toBe(matches);
    });
});

describe('getScaleNote', () => {
    test('returns null when nothing is known', () => {
        expect(getScaleNote(null, null)).toBeNull();
    });

    test('shows serves when only servings known', () => {
        expect(getScaleNote(null, 4)).toBe('Serves 4');
    });

    test('shows for-people when only people known', () => {
        expect(getScaleNote(2, null)).toBe('For 2');
    });

    test('shows serves when recipe already feeds everyone', () => {
        expect(getScaleNote(2, 4)).toBe('Serves 4');
        expect(getScaleNote(4, 4)).toBe('Serves 4');
    });

    test('shows scale factor when recipe is too small', () => {
        expect(getScaleNote(6, 4)).toBe('Scale \u00d71.5 to feed 6');
        expect(getScaleNote(8, 3)).toBe('Scale \u00d72.7 to feed 8');
    });
});

describe('shuffleMatches', () => {
    test('returns the same items in a new array', () => {
        const items = [1, 2, 3, 4, 5];
        const result = shuffleMatches(items);
        expect(result).toHaveLength(5);
        expect(result).not.toBe(items);
        expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
    });

    test('handles empty and single-item arrays', () => {
        expect(shuffleMatches([])).toEqual([]);
        expect(shuffleMatches([7])).toEqual([7]);
    });
});

describe('answerCount', () => {
    test('counts only set answers', () => {
        expect(answerCount(DEFAULT_ANSWERS)).toBe(0);
        expect(answerCount({ ...DEFAULT_ANSWERS, mealType: 'Main', people: 4 })).toBe(2);
    });
});
