import { NUTRIENT_LABELS } from './dailyIntake';

/**
 * Configurable "Health %" / Daily Score calculator.
 *
 * The score is a weighted average of how well today's intake hits each
 * nutrient target (capped at 100%). By default macros are weighted 2x and
 * micronutrients 1x, but users can override the weight of any nutrient
 * (0 disables it) and mark certain nutrients as "limit" nutrients where
 * under-eating is fine but over-eating is penalized (e.g. sodium).
 */

export interface HealthScoreConfig {
    /** Default weight applied to any macro without an explicit per-nutrient weight. */
    macroWeight: number;
    /** Default weight applied to any mineral/vitamin without an explicit per-nutrient weight. */
    microWeight: number;
    /** Per-nutrient weight overrides. 0 disables a nutrient. */
    weights: Record<string, number>;
    /** Nutrient keys scored "lower is better" (under target = perfect, over target = penalized). */
    limitNutrients: string[];
}

export const DEFAULT_HEALTH_SCORE_CONFIG: HealthScoreConfig = {
    macroWeight: 2,
    microWeight: 1,
    weights: {},
    limitNutrients: ['sodium_mg'],
};

const VALID_KEYS = Object.keys(NUTRIENT_LABELS);

function clampWeight(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

/**
 * Merges a (possibly partial / absent) stored config with the defaults so
 * every caller gets a complete, safe config.
 */
export function mergeHealthScoreConfig(stored?: Partial<HealthScoreConfig> | null): HealthScoreConfig {
    if (!stored || typeof stored !== 'object') {
        return { ...DEFAULT_HEALTH_SCORE_CONFIG, weights: {}, limitNutrients: [...DEFAULT_HEALTH_SCORE_CONFIG.limitNutrients] };
    }
    const macroWeight = Number.isFinite(stored.macroWeight) ? clampWeight(stored.macroWeight) : DEFAULT_HEALTH_SCORE_CONFIG.macroWeight;
    const microWeight = Number.isFinite(stored.microWeight) ? clampWeight(stored.microWeight) : DEFAULT_HEALTH_SCORE_CONFIG.microWeight;
    const weights: Record<string, number> = {};
    if (stored.weights && typeof stored.weights === 'object') {
        for (const key of Object.keys(stored.weights)) {
            if (!VALID_KEYS.includes(key)) continue;
            const v = stored.weights[key];
            if (typeof v === 'number' && Number.isFinite(v)) weights[key] = clampWeight(v);
        }
    }
    const limitNutrients = Array.isArray(stored.limitNutrients)
        ? stored.limitNutrients.filter((k) => typeof k === 'string' && VALID_KEYS.includes(k))
        : [...DEFAULT_HEALTH_SCORE_CONFIG.limitNutrients];
    return { macroWeight, microWeight, weights, limitNutrients };
}

/**
 * Validates/clamps arbitrary user input into a safe config for persistence.
 */
export function sanitizeHealthScoreConfig(raw: unknown): HealthScoreConfig {
    if (!raw || typeof raw !== 'object') return mergeHealthScoreConfig(null);
    const r = raw as Record<string, unknown>;
    const macroWeight = typeof r.macroWeight === 'number' ? clampWeight(r.macroWeight) : DEFAULT_HEALTH_SCORE_CONFIG.macroWeight;
    const microWeight = typeof r.microWeight === 'number' ? clampWeight(r.microWeight) : DEFAULT_HEALTH_SCORE_CONFIG.microWeight;
    const weights: Record<string, number> = {};
    if (r.weights && typeof r.weights === 'object') {
        for (const key of Object.keys(r.weights)) {
            if (!VALID_KEYS.includes(key)) continue;
            const v = (r.weights as Record<string, unknown>)[key];
            if (typeof v === 'number' && Number.isFinite(v)) weights[key] = clampWeight(v);
        }
    }
    const limitNutrients = Array.isArray(r.limitNutrients)
        ? r.limitNutrients.filter((k): k is string => typeof k === 'string' && VALID_KEYS.includes(k))
        : [...DEFAULT_HEALTH_SCORE_CONFIG.limitNutrients];
    return { macroWeight, microWeight, weights, limitNutrients };
}

export function getNutrientWeight(key: string, config: HealthScoreConfig): number {
    if (config.weights[key] !== undefined) return config.weights[key];
    const group = NUTRIENT_LABELS[key as keyof typeof NUTRIENT_LABELS]?.group;
    return group === 'macro' ? config.macroWeight : config.microWeight;
}

/**
 * Returns the 0-100 percentage score for a single nutrient, or null if the
 * nutrient should be excluded (no target, zero weight).
 */
export function getNutrientPct(
    key: string,
    value: number,
    target: number,
    config: HealthScoreConfig
): number | null {
    const weight = getNutrientWeight(key, config);
    if (weight <= 0) return null;
    if (!target || !Number.isFinite(target) || target <= 0) return null;
    const ratio = (value || 0) / target;
    if (config.limitNutrients.includes(key)) {
        if (ratio <= 1) return 100;
        return Math.max(0, 100 - (ratio - 1) * 100);
    }
    return Math.min(ratio * 100, 100);
}

/**
 * Main score calculation. Weighted average of per-nutrient percentages,
 * capped at 100 each, rounded to the nearest whole number.
 */
export function calculateHealthScore(
    totals: Record<string, number>,
    targets: Record<string, number>,
    config: HealthScoreConfig = DEFAULT_HEALTH_SCORE_CONFIG
): number {
    let sum = 0;
    let weightSum = 0;
    for (const key of Object.keys(targets)) {
        const weight = getNutrientWeight(key, config);
        if (weight <= 0) continue;
        const target = targets[key];
        if (!target || !Number.isFinite(target) || target <= 0) continue;
        const pct = getNutrientPct(key, totals[key] || 0, target, config);
        if (pct === null) continue;
        sum += pct * weight;
        weightSum += weight;
    }
    return weightSum ? Math.round(sum / weightSum) : 0;
}

/** All nutrients that can be scored, grouped for UI display. */
export const ALL_SCORE_NUTRIENT_KEYS: Record<'macro' | 'mineral' | 'vitamin', string[]> = (() => {
    const groups: Record<'macro' | 'mineral' | 'vitamin', string[]> = { macro: [], mineral: [], vitamin: [] };
    for (const key of VALID_KEYS) {
        const group = NUTRIENT_LABELS[key as keyof typeof NUTRIENT_LABELS].group;
        groups[group].push(key);
    }
    return groups;
})();
