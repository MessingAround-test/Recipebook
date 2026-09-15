const { canonName, normalizeRemixChanges, applyDietaryNameTag, sanitizeSubstitutions } = require('../lib/recipeRemix');

describe('canonName', () => {
    test('ignores case and collapses whitespace', () => {
        expect(canonName('  Firm   Tofu ')).toBe('firm tofu');
        expect(canonName('FIrm Tofu')).toBe(canonName('firm tofu'));
    });

    test('handles empty values', () => {
        expect(canonName(null)).toBe('');
        expect(canonName(undefined)).toBe('');
    });
});

describe('sanitizeSubstitutions', () => {
    test('keeps valid swaps and trims whitespace', () => {
        expect(sanitizeSubstitutions([{ index: 2, from: ' Cod ', to: ' Eggplant ' }]))
            .toEqual([{ index: 2, from: 'Cod', to: 'Eggplant' }]);
    });

    test('drops entries without a target name', () => {
        expect(sanitizeSubstitutions([{ index: 0, from: 'Cod', to: '  ' }, { to: 'Tofu' }]))
            .toEqual([{ index: null, from: '', to: 'Tofu' }]);
    });

    test('handles non-arrays and bad entries', () => {
        expect(sanitizeSubstitutions(null)).toEqual([]);
        expect(sanitizeSubstitutions(['nope', {}, { to: 'Beans' }]))
            .toEqual([{ index: null, from: '', to: 'Beans' }]);
    });
});

describe('applyDietaryNameTag', () => {
    test('appends the dietary label', () => {
        expect(applyDietaryNameTag('Vori-vori', ['Pescetarian'])).toBe('Vori-vori (Pescetarian)');
    });

    test('joins multiple labels', () => {
        expect(applyDietaryNameTag('Vori-vori', ['Gluten-free', 'Dairy-free'])).toBe('Vori-vori (Gluten-free, Dairy-free)');
    });

    test('is idempotent across re-runs', () => {
        expect(applyDietaryNameTag('Vori-vori (Pescetarian)', ['Pescetarian'])).toBe('Vori-vori (Pescetarian)');
    });

    test('replaces a previous dietary tag', () => {
        expect(applyDietaryNameTag('Vori-vori (Vegetarian)', ['Pescetarian'])).toBe('Vori-vori (Pescetarian)');
    });

    test('leaves the name alone when there are no labels', () => {
        expect(applyDietaryNameTag('Vori-vori (Spicy)', [])).toBe('Vori-vori (Spicy)');
    });

    test('keeps non-dietary parentheses', () => {
        expect(applyDietaryNameTag('Vori-vori (Spicy)', ['Vegan'])).toBe('Vori-vori (Spicy) (Vegan)');
    });
});

describe('normalizeRemixChanges', () => {
    const recipe = {
        ingredients: [
            { Name: 'Firm Tofu' },
            { Name: 'Skewers', Note: 'soaked' },
            { Name: 'Coconut aminos' }
        ],
        instructions: [{ Text: 'Grill the tofu.' }]
    };

    test('drops substitutions that only differ by case/whitespace', () => {
        const changes = normalizeRemixChanges([
            { kind: 'ingredient', index: 0, originalName: 'firm tofu', newName: 'FIrm Tofu', alternatives: ['Tempeh'] }
        ], recipe);
        expect(changes).toHaveLength(0);
    });

    test('drops identical-name entries', () => {
        const changes = normalizeRemixChanges([
            { kind: 'ingredient', index: 1, originalName: 'skewers', newName: 'skewers' }
        ], recipe);
        expect(changes).toHaveLength(0);
    });

    test('keeps a real substitution and uses the recipe name for display', () => {
        const changes = normalizeRemixChanges([
            {
                kind: 'ingredient',
                index: 2,
                originalName: 'Soy sauce',
                newName: 'coconut aminos',
                reason: 'gluten-free swap',
                alternatives: ['coconut aminos', 'Coconut Aminos', 'tamari']
            }
        ], recipe);
        expect(changes).toHaveLength(1);
        expect(changes[0].originalName).toBe('Soy sauce');
        expect(changes[0].newName).toBe('Coconut aminos');
        expect(changes[0].reason).toBe('gluten-free swap');
        // Chosen substitute first, case-insensitive de-dupe.
        expect(changes[0].alternatives).toEqual(['Coconut aminos', 'tamari']);
    });

    test('normalizes literal step changes', () => {
        const changes = normalizeRemixChanges([
            { kind: 'step', index: 0, originalText: 'Grill the tofu.', newText: 'Grill the firm tofu.' }
        ], recipe);
        expect(changes).toHaveLength(1);
        expect(changes[0].kind).toBe('step');
        expect(changes[0].newText).toBe('Grill the firm tofu.');
    });

    test('ignores invalid entries and non-arrays', () => {
        expect(normalizeRemixChanges([{ kind: 'ingredient', index: -1 }], recipe)).toHaveLength(0);
        expect(normalizeRemixChanges(null, recipe)).toEqual([]);
    });
});
