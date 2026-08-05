const {
    calculateHealthScore,
    mergeHealthScoreConfig,
    sanitizeHealthScoreConfig,
    getNutrientPct,
    DEFAULT_HEALTH_SCORE_CONFIG,
} = require('../lib/healthScore');

const MACROS = ['energy_kcal', 'protein_g', 'carbohydrates_g', 'fat_g', 'fiber_g'];
const MICROS = ['calcium_mg', 'iron_mg'];

function targetsWith(val) {
    const t = {};
    for (const k of MACROS) t[k] = val;
    for (const k of MICROS) t[k] = val;
    return t;
}

test('defaults give macros 2x weighting vs micronutrients', () => {
    const targets = targetsWith(100);
    const totals = {};
    for (const k of MACROS) totals[k] = 100; // 100%
    for (const k of MICROS) totals[k] = 50;  // 50%

    // 5 macros @ 100 (weight 2) + 2 micros @ 50 (weight 1)
    const score = calculateHealthScore(totals, targets);
    expect(score).toBe(92);
});

test('equal weights would produce the plain average (sanity check)', () => {
    const targets = targetsWith(100);
    const totals = {};
    for (const k of MACROS) totals[k] = 100;
    for (const k of MICROS) totals[k] = 50;
    const cfg = { ...DEFAULT_HEALTH_SCORE_CONFIG, macroWeight: 1, microWeight: 1 };
    // plain average = (5*100 + 2*50) / 7 = 85.7 -> 86
    expect(calculateHealthScore(totals, targets, cfg)).toBe(86);
});

test('a weight of 0 excludes a nutrient from the score', () => {
    const targets = targetsWith(100);
    const totals = {};
    for (const k of MACROS) totals[k] = 100;
    for (const k of MICROS) totals[k] = 50;
    const cfg = { ...DEFAULT_HEALTH_SCORE_CONFIG, weights: { calcium_mg: 0, iron_mg: 0 } };
    expect(calculateHealthScore(totals, targets, cfg)).toBe(100);
});

test('per-nutrient weight overrides the group default', () => {
    const targets = targetsWith(100);
    const totals = {};
    for (const k of MACROS) totals[k] = 100;
    for (const k of MICROS) totals[k] = 50;
    const cfg = { ...DEFAULT_HEALTH_SCORE_CONFIG, weights: { protein_g: 1 } };
    // protein now weight 1 instead of 2
    const expected = Math.round(
        ((4 * 100 * 2) + (1 * 100 * 1) + (2 * 50 * 1)) / ((4 * 2) + 1 + 2)
    );
    expect(calculateHealthScore(totals, targets, cfg)).toBe(expected);
});

test('sodium as a limit nutrient: under target is perfect, over is penalised', () => {
    const targets = { sodium_mg: 2300 };
    expect(calculateHealthScore({ sodium_mg: 1150 }, targets)).toBe(100);  // 50% -> perfect
    expect(calculateHealthScore({ sodium_mg: 2300 }, targets)).toBe(100);  // 100% -> perfect
    expect(calculateHealthScore({ sodium_mg: 3450 }, targets)).toBe(50);   // 150% -> 50
    expect(calculateHealthScore({ sodium_mg: 4600 }, targets)).toBe(0);    // 200% -> 0
    expect(calculateHealthScore({ sodium_mg: 7000 }, targets)).toBe(0);    // >200% -> 0
});

test('normal nutrients are capped at 100% (over-eating does not boost score)', () => {
    const targets = targetsWith(100);
    const totals = {};
    for (const k of MACROS) totals[k] = 250; // 250%
    for (const k of MICROS) totals[k] = 300;
    expect(calculateHealthScore(totals, targets)).toBe(100);
});

test('missing targets are skipped and do not crash', () => {
    const targets = { energy_kcal: 100, protein_g: 0, calcium_mg: 100 };
    const totals = { energy_kcal: 100, calcium_mg: 50 };
    const cfg = { ...DEFAULT_HEALTH_SCORE_CONFIG, macroWeight: 2, microWeight: 1 };
    // energy 100 (w2) + calcium 50 (w1) -> (200 + 50) / 3 = 83.3 -> 83
    expect(calculateHealthScore(totals, targets, cfg)).toBe(83);
});

test('no totals yields a score of 0', () => {
    const targets = targetsWith(100);
    expect(calculateHealthScore({}, targets)).toBe(0);
});

test('unknown nutrients in totals are ignored', () => {
    const targets = targetsWith(100);
    const totals = { bogus_key: 100000 };
    expect(calculateHealthScore(totals, targets)).toBe(0);
});

test('getNutrientPct applies limit formula for limit nutrients', () => {
    const cfg = { ...DEFAULT_HEALTH_SCORE_CONFIG, limitNutrients: ['sodium_mg'] };
    expect(getNutrientPct('sodium_mg', 2300, 2300, cfg)).toBe(100);
    expect(getNutrientPct('sodium_mg', 4600, 2300, cfg)).toBe(0);
    expect(getNutrientPct('protein_g', 50, 100, cfg)).toBe(50);
    expect(getNutrientPct('protein_g', 200, 100, cfg)).toBe(100);
});

test('mergeHealthScoreConfig handles null/partial/valid input', () => {
    expect(mergeHealthScoreConfig(null)).toEqual(DEFAULT_HEALTH_SCORE_CONFIG);
    expect(mergeHealthScoreConfig(undefined)).toEqual(DEFAULT_HEALTH_SCORE_CONFIG);

    const merged = mergeHealthScoreConfig({ macroWeight: 3 });
    expect(merged.macroWeight).toBe(3);
    expect(merged.microWeight).toBe(1);
    expect(merged.weights).toEqual({});
    expect(merged.limitNutrients).toEqual(['sodium_mg']);

    const full = mergeHealthScoreConfig({
        macroWeight: 4,
        microWeight: 2,
        weights: { protein_g: 5, bogus: 7, fat_g: 0 },
        limitNutrients: ['sodium_mg', 'fat_g', 'nope'],
    });
    expect(full).toEqual({
        macroWeight: 4,
        microWeight: 2,
        weights: { protein_g: 5, fat_g: 0 },
        limitNutrients: ['sodium_mg', 'fat_g'],
    });
});

test('sanitizeHealthScoreConfig clamps weights and drops junk', () => {
    const cfg = sanitizeHealthScoreConfig({
        macroWeight: 999,
        microWeight: -5,
        weights: { energy_kcal: 10, sodium_mg: 1, invalid_key: 3 },
        limitNutrients: ['sodium_mg', 42, 'not_a_nutrient'],
    });
    expect(cfg.macroWeight).toBe(100);
    expect(cfg.microWeight).toBe(0);
    expect(cfg.weights).toEqual({ energy_kcal: 10, sodium_mg: 1 });
    expect(cfg.limitNutrients).toEqual(['sodium_mg']);
});
