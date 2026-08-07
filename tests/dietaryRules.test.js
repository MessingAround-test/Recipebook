const { buildDietaryConstraints, allowedIngredientCategories } = require('../lib/dietaryRules');

describe('buildDietaryConstraints', () => {
    test('returns no restrictions when none are set', () => {
        expect(buildDietaryConstraints({})).toBe('No dietary restrictions.');
    });

    test('handles vegetarian preference', () => {
        const text = buildDietaryConstraints({ dietary_preference: 'vegetarian' });
        expect(text).toContain('NO meat, poultry, or seafood');
    });

    test('handles vegan preference', () => {
        const text = buildDietaryConstraints({ dietary_preference: 'vegan' });
        expect(text).toContain('NO animal products whatsoever');
    });

    test('combines preference with restrictions', () => {
        const text = buildDietaryConstraints({ dietary_preference: 'pescetarian', dietary_restrictions: ['dairy_free', 'gluten_free'] });
        expect(text).toContain('NO meat or poultry');
        expect(text).toContain('Dairy-free: NO milk');
        expect(text).toContain('Gluten-free: NO wheat');
    });
});

describe('allowedIngredientCategories', () => {
    test('default allows everything', () => {
        const cats = allowedIngredientCategories({});
        expect(cats).toContain('Meat');
        expect(cats).toContain('Seafood');
        expect(cats).toContain('Dairy');
    });

    test('vegan excludes meat, seafood, dairy', () => {
        const cats = allowedIngredientCategories({ dietary_preference: 'vegan' });
        expect(cats).not.toContain('Meat');
        expect(cats).not.toContain('Seafood');
        expect(cats).not.toContain('Dairy');
        expect(cats).toContain('Fresh Produce');
    });

    test('pescetarian + dairy_free + nut_free filters categories', () => {
        const cats = allowedIngredientCategories({
            dietary_preference: 'pescetarian',
            dietary_restrictions: ['dairy_free', 'nut_free']
        });
        expect(cats).not.toContain('Meat');
        expect(cats).toContain('Seafood');
        expect(cats).not.toContain('Dairy');
        expect(cats).not.toContain('Nuts');
    });
});
