const {
    computeNutrientHighlights,
    PRO_HIGH_PCT,
    PRO_VERY_HIGH_PCT,
    CON_HIGH_PCT,
} = require('../lib/nutrientHighlights');

function targets(overrides = {}) {
    return {
        energy_kcal: 2000,
        protein_g: 100,
        fat_g: 70,
        carbohydrates_g: 250,
        fiber_g: 30,
        sodium_mg: 2000,
        calcium_mg: 1000,
        iron_mg: 10,
        vitamin_c_mg: 100,
        ...overrides,
    };
}

test('high protein and fiber show up as pros', () => {
    const totals = { protein_g: 50, fiber_g: 12 }; // 50% and 40%
    const { pros } = computeNutrientHighlights(totals, targets());
    const keys = pros.map((p) => p.key);
    expect(keys).toContain('protein_g');
    expect(keys).toContain('fiber_g');
});

test('pros below the high threshold are excluded', () => {
    const totals = { protein_g: 20 }; // 20% < 30%
    const { pros } = computeNutrientHighlights(totals, targets());
    expect(pros.map((p) => p.key)).not.toContain('protein_g');
});

test('tier is very-high at or above 50% and high otherwise', () => {
    const totals = { protein_g: 55, fiber_g: 12 }; // 55% and 40%
    const { pros } = computeNutrientHighlights(totals, targets());
    const protein = pros.find((p) => p.key === 'protein_g');
    const fiber = pros.find((p) => p.key === 'fiber_g');
    expect(protein.tier).toBe('very-high');
    expect(fiber.tier).toBe('high');
});

test('energy, fat, carbs and sodium become cons when high', () => {
    const totals = {
        energy_kcal: 1000, // 50%
        fat_g: 35, // 50%
        carbohydrates_g: 110, // 44%
        sodium_mg: 900, // 45%
    };
    const { cons } = computeNutrientHighlights(totals, targets(), { maxPerSide: 4 });
    expect(cons.map((c) => c.key)).toEqual(
        expect.arrayContaining(['energy_kcal', 'fat_g', 'carbohydrates_g', 'sodium_mg'])
    );
});

test('cons below the threshold are excluded', () => {
    const totals = { sodium_mg: 700 }; // 35% < 40%
    const { cons } = computeNutrientHighlights(totals, targets());
    expect(cons).toHaveLength(0);
});

test('sodium is never reported as a pro', () => {
    const totals = { sodium_mg: 1800 }; // 90%
    const { pros } = computeNutrientHighlights(totals, targets());
    expect(pros.map((p) => p.key)).not.toContain('sodium_mg');
});

test('pros are sorted by percentage descending and capped', () => {
    const totals = {
        protein_g: 60, // 60%
        fiber_g: 15, // 50%
        vitamin_c_mg: 80, // 80%
        calcium_mg: 400, // 40%
        iron_mg: 5, // 50%
    };
    const { pros } = computeNutrientHighlights(totals, targets(), { maxPerSide: 3 });
    expect(pros).toHaveLength(3);
    expect(pros.map((p) => p.pct)).toEqual([80, 60, 50]);
});

test('returns empty lists when nothing stands out', () => {
    const { pros, cons } = computeNutrientHighlights({}, targets());
    expect(pros).toEqual([]);
    expect(cons).toEqual([]);
});

test('exposes the configured thresholds', () => {
    expect(PRO_HIGH_PCT).toBe(30);
    expect(PRO_VERY_HIGH_PCT).toBe(50);
    expect(CON_HIGH_PCT).toBe(40);
});
