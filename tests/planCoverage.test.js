const {
    buildNutrientCoverage,
    perPersonDailyTotals,
    computeProjectedScore,
} = require('../lib/planCoverage');
const { DEFAULT_HEALTH_SCORE_CONFIG } = require('../lib/healthScore');

const FULL_TARGETS = {
    energy_kcal: 2000,
    protein_g: 100,
    fat_g: 60,
    carbohydrates_g: 250,
    fiber_g: 30,
    calcium_mg: 1000,
    iron_mg: 8,
    magnesium_mg: 400,
    phosphorus_mg: 700,
    potassium_mg: 3400,
    sodium_mg: 2300,
    zinc_mg: 11,
    vitamin_a_ug: 900,
    vitamin_b1_mg: 1.2,
    vitamin_b2_mg: 1.3,
    vitamin_b3_mg: 16,
    vitamin_b6_mg: 1.3,
    vitamin_b12_ug: 2.4,
    vitamin_c_mg: 90,
    vitamin_d_ug: 15,
    vitamin_e_mg: 15,
    vitamin_k_ug: 120,
};

test('perPersonDailyTotals divides weekly household totals down to per-person per-day', () => {
    const totals = { energy_kcal: 14000, protein_g: 700 };
    const perDay = perPersonDailyTotals(totals, 7, 2);
    expect(perDay.energy_kcal).toBe(1000);
    expect(perDay.protein_g).toBe(50);
});

test('zero weight excludes a nutrient entirely', () => {
    const config = {
        ...DEFAULT_HEALTH_SCORE_CONFIG,
        weights: { sodium_mg: 0, iron_mg: 0 },
    };
    const totals = {};
    for (const k of Object.keys(FULL_TARGETS)) totals[k] = 0;
    totals.sodium_mg = 2300 * 7 * 2; // household daily at 100%
    totals.iron_mg = 8 * 7 * 2;

    const coverage = buildNutrientCoverage({ totals, targets: FULL_TARGETS, numDays: 7, people: 2, config });
    const keys = coverage.map(c => c.key);
    expect(keys).not.toContain('sodium_mg');
    expect(keys).not.toContain('iron_mg');
    expect(keys.length).toBe(Object.keys(FULL_TARGETS).length - 2);
});

test('coverage ranks the most important gaps first (weight × shortfall)', () => {
    const totals = {};
    for (const k of Object.keys(FULL_TARGETS)) totals[k] = FULL_TARGETS[k] * 7 * 2; // 100% baseline
    // Energy (macro, weight 2) at 30% -> gap 1.4
    // Zinc (mineral, weight 1) at 0% -> gap 1.0
    // Fiber (macro, weight 2) at 50% -> gap 1.0
    totals.energy_kcal = (FULL_TARGETS.energy_kcal * 0.3) * 7 * 2;
    totals.zinc_mg = 0;
    totals.fiber_g = (FULL_TARGETS.fiber_g * 0.5) * 7 * 2;

    const coverage = buildNutrientCoverage({ totals, targets: FULL_TARGETS, numDays: 7, people: 2, config: DEFAULT_HEALTH_SCORE_CONFIG });
    const byKey = Object.fromEntries(coverage.map(c => [c.key, c]));

    expect(byKey.energy_kcal.pct).toBeCloseTo(30, 5);
    expect(byKey.fiber_g.pct).toBe(50);
    expect(byKey.zinc_mg.pct).toBe(0);
    // The higher-weighted macro gap outranks the mineral even though the mineral is lower %.
    expect(coverage[0].key).toBe('energy_kcal');
    expect(coverage[1].key).toBe('zinc_mg');
    expect(coverage[2].key).toBe('fiber_g');
});

test('a nutrient at 100% coverage is scored, not ranked as a gap', () => {
    const totals = {};
    for (const k of Object.keys(FULL_TARGETS)) totals[k] = 0;
    totals.protein_g = 100 * 7 * 2; // 100%
    totals.energy_kcal = 2000 * 7 * 2; // 100%

    const coverage = buildNutrientCoverage({ totals, targets: FULL_TARGETS, numDays: 7, people: 2, config: DEFAULT_HEALTH_SCORE_CONFIG });
    const byKey = Object.fromEntries(coverage.map(c => [c.key, c]));
    expect(byKey.protein_g.pct).toBe(100);
    expect(byKey.protein_g.weight).toBe(2);
});

test('computeProjectedScore returns weighted average on a per-person basis', () => {
    const totals = {};
    for (const k of Object.keys(FULL_TARGETS)) totals[k] = FULL_TARGETS[k] * 7 * 2; // 100% of every nutrient
    const score = computeProjectedScore({ totals, targets: FULL_TARGETS, numDays: 7, people: 2, config: DEFAULT_HEALTH_SCORE_CONFIG });
    expect(score).toBe(100);
});

test('computeProjectedScore returns null when every weighted nutrient is disabled', () => {
    const config = { ...DEFAULT_HEALTH_SCORE_CONFIG, weights: {} };
    for (const k of Object.keys(FULL_TARGETS)) config.weights[k] = 0;
    const score = computeProjectedScore({ totals: {}, targets: FULL_TARGETS, numDays: 7, people: 2, config });
    expect(score).toBeNull();
});
