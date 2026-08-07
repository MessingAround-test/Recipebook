jest.mock('../models/Recipe', () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock('../models/IngredientConversion', () => ({ __esModule: true, default: { findOne: jest.fn() } }));

const Recipe = require('../models/Recipe').default;
const IngredientConversion = require('../models/IngredientConversion').default;
const {
    computeRecipeNutrientTotals,
    computePlainIngredientNutrients,
    computeDayNutrients,
    computeIngredientListNutrients
} = require('../lib/planNutrition');

const NUTRIENT_KEYS = ['energy_kcal', 'protein_g'];

describe('computeRecipeNutrientTotals', () => {
    beforeEach(() => {
        Recipe.findById.mockReset();
        IngredientConversion.findOne.mockReset();
        IngredientConversion.findOne.mockResolvedValue({
            grams_per_each: null,
            energy_kcal: 200,
            protein_g: 20
        });
    });

    test('scales nutrients and cost by logged servings', async () => {
        Recipe.findById.mockResolvedValue({
            _id: 'r1',
            servings: 2,
            unitCost: 10,
            ingredients: [{ Name: 'chicken', AmountType: 'gram', Amount: 100 }]
        });

        const result = await computeRecipeNutrientTotals('r1', 1, NUTRIENT_KEYS);

        // Per 100g = 200 kcal / 20 protein. Recipe serves 2, logged 1 => half.
        expect(result.nutrients.energy_kcal).toBeCloseTo(100);
        expect(result.nutrients.protein_g).toBeCloseTo(10);
        expect(result.cost).toBeCloseTo(5);
    });
});

describe('computePlainIngredientNutrients', () => {
    test('converts each units via grams_per_each', async () => {
        IngredientConversion.findOne.mockResolvedValue({
            grams_per_each: 100,
            energy_kcal: 50,
            protein_g: 2
        });

        const result = await computePlainIngredientNutrients('Spinach', 7, 'each', NUTRIENT_KEYS);
        // 7 x 100g each => 700g => 7 * (50) kcal, 7 * (2) protein
        expect(result.nutrients.energy_kcal).toBeCloseTo(350);
        expect(result.nutrients.protein_g).toBeCloseTo(14);
    });
});

describe('computeIngredientListNutrients', () => {
    test('sums nutrients from a raw ingredient list at full recipe scale', async () => {
        IngredientConversion.findOne.mockReset();
        IngredientConversion.findOne.mockImplementation(async ({ ingredient_name }) => {
            const src = String(ingredient_name?.$regex?.source || '').toLowerCase();
            if (src.includes('chicken')) return { grams_per_each: null, energy_kcal: 200, protein_g: 20 };
            return { grams_per_each: null, energy_kcal: 50, protein_g: 2 };
        });

        const ingredients = [
            { Name: 'Chicken', AmountType: 'gram', Amount: 200 },
            { Name: 'Rice', AmountType: 'gram', Amount: 150 }
        ];
        const result = await computeIngredientListNutrients(ingredients, NUTRIENT_KEYS);

        // Chicken 200g => 2 * 200 = 400 kcal, 2 * 20 = 40 protein.
        // Rice 150g => 1.5 * 50 = 75 kcal, 1.5 * 2 = 3 protein.
        expect(result.energy_kcal).toBeCloseTo(475);
        expect(result.protein_g).toBeCloseTo(43);
    });
});

describe('computeDayNutrients', () => {
    const targets = { energy_kcal: 2000, protein_g: 100 };

    beforeEach(() => {
        Recipe.findById.mockReset();
        IngredientConversion.findOne.mockReset();
    });

    test('sums day recipes + prorated everyday items, then divides by people', async () => {
        Recipe.findById.mockResolvedValue({
            _id: 'r1',
            servings: 2,
            unitCost: 10,
            ingredients: [{ Name: 'chicken', AmountType: 'gram', Amount: 100 }]
        });
        IngredientConversion.findOne.mockImplementation(async ({ ingredient_name }) => {
            const src = String(ingredient_name?.$regex?.source || '').toLowerCase();
            if (src.includes('chicken')) {
                return { grams_per_each: null, energy_kcal: 200, protein_g: 20 };
            }
            // Spinach
            return { grams_per_each: 100, energy_kcal: 50, protein_g: 2 };
        });

        const plan = {
            defaultServings: 2,
            numDays: 7,
            plannedRecipes: [
                { day: '2026-08-07', mealType: 'Dinner', recipe_id: 'r1', recipe_name: 'Chicken', servings: 1, carbType: 'Rice' }
            ],
            everydayItems: [
                { name: 'Spinach', quantity: 7, quantity_unit: 'each' }
            ]
        };

        const result = await computeDayNutrients({ plan, day: '2026-08-07', targets, people: 2, numDays: 7 });

        // Planned: 100 kcal / 10 protein. Everyday prorated 1 each => 50 kcal / 2 protein.
        // Totals: 150 kcal / 12 protein. Per person (2): 75 / 6.
        expect(result.plannedMeals).toEqual([{ mealType: 'Dinner', name: 'Chicken', carbType: 'Rice' }]);
        expect(result.dayTotals.energy_kcal).toBeCloseTo(150);
        expect(result.dayTotals.protein_g).toBeCloseTo(12);
        expect(result.perPerson.energy_kcal).toBeCloseTo(75);
        expect(result.perPerson.protein_g).toBeCloseTo(6);
        expect(result.coverage.find(c => c.key === 'energy_kcal').pct).toBeCloseTo(3.75);
    });

    test('ignores Undecided and other-day recipes', async () => {
        Recipe.findById.mockResolvedValue({
            _id: 'r1',
            servings: 2,
            unitCost: 10,
            ingredients: [{ Name: 'chicken', AmountType: 'gram', Amount: 100 }]
        });
        IngredientConversion.findOne.mockResolvedValue({
            grams_per_each: null,
            energy_kcal: 200,
            protein_g: 20
        });

        const plan = {
            defaultServings: 2,
            numDays: 7,
            plannedRecipes: [
                { day: 'Undecided', mealType: 'Dinner', recipe_id: 'r1', recipe_name: 'Chicken', servings: 1 },
                { day: '2026-08-08', mealType: 'Lunch', recipe_id: 'r1', recipe_name: 'Chicken', servings: 1 },
                { day: '2026-08-07', mealType: 'Breakfast', recipe_id: 'r1', recipe_name: 'Chicken', servings: 1 }
            ],
            everydayItems: []
        };

        const result = await computeDayNutrients({ plan, day: '2026-08-07', targets, people: 1, numDays: 7 });

        // Only the Breakfast entry on 2026-08-07 counts.
        expect(result.plannedMeals).toHaveLength(1);
        expect(result.plannedMeals[0].mealType).toBe('Breakfast');
        expect(result.dayTotals.energy_kcal).toBeCloseTo(100);
    });
});
