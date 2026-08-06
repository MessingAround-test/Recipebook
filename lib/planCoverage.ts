import { NUTRIENT_LABELS } from './dailyIntake';
import { getNutrientWeight, calculateHealthScore, HealthScoreConfig } from './healthScore';

/**
 * Weighted weekly-plan nutrient coverage helpers.
 *
 * The weekly planner analysis produces household-level weekly totals.
 * These helpers convert that into per-person, per-day coverage so users can
 * see whether following the plan hits each person's recommended intake.
 * Nutrients with a weight of 0 in the user's health-score settings are
 * excluded entirely (the user has opted out of tracking them).
 */

export interface NutrientCoverageItem {
    key: string;
    label: string;
    unit: string;
    group: 'macro' | 'mineral' | 'vitamin';
    /** Per-person, per-day projected amount. */
    value: number;
    /** Per-person, per-day target amount. */
    target: number;
    /** value / target as a percentage. */
    pct: number;
    /** Importance weight from the user's health-score settings. */
    weight: number;
    /** "Lower is better" nutrient (under target is fine, over is penalised). */
    isLimit: boolean;
}

export function perPersonDailyTotals(
    totals: Record<string, number>,
    numDays: number,
    people: number
): Record<string, number> {
    const out: Record<string, number> = {};
    for (const key of Object.keys(totals || {})) {
        out[key] = (totals[key] || 0) / Math.max(1, numDays) / Math.max(1, people);
    }
    return out;
}

/**
 * Builds the full weighted coverage list for a plan, sorted so the most
 * important gaps rank first (weight × shortfall, shortfall capped at 100%).
 * Nutrients with weight <= 0 or no positive target are omitted.
 */
export function buildNutrientCoverage(opts: {
    totals: Record<string, number>;
    targets: Record<string, number>;
    numDays: number;
    people: number;
    config: HealthScoreConfig;
}): NutrientCoverageItem[] {
    const { totals, targets, numDays, people, config } = opts;
    const perDay = perPersonDailyTotals(totals, numDays, people);

    const results: NutrientCoverageItem[] = [];
    for (const key of Object.keys(targets || {})) {
        const meta = NUTRIENT_LABELS[key as keyof typeof NUTRIENT_LABELS];
        if (!meta) continue;
        const weight = getNutrientWeight(key, config);
        if (weight <= 0) continue;
        const target = targets[key];
        if (!target || !Number.isFinite(target) || target <= 0) continue;
        const value = perDay[key] || 0;
        results.push({
            key,
            label: meta.label,
            unit: meta.unit,
            group: meta.group,
            value,
            target,
            pct: (value / target) * 100,
            weight,
            isLimit: config.limitNutrients.includes(key)
        });
    }

    results.sort((a, b) => {
        const shortA = Math.min(1, Math.max(0, 1 - a.pct / 100));
        const shortB = Math.min(1, Math.max(0, 1 - b.pct / 100));
        const gapA = a.weight * shortA;
        const gapB = b.weight * shortB;
        if (gapB !== gapA) return gapB - gapA;
        return a.pct - b.pct;
    });

    return results;
}

/**
 * Weighted average 0-100 projected score across the weighted nutrient set,
 * computed on a per-person, per-day basis. Returns null when nothing is scored.
 */
export function computeProjectedScore(opts: {
    totals: Record<string, number>;
    targets: Record<string, number>;
    numDays: number;
    people: number;
    config: HealthScoreConfig;
}): number | null {
    const { totals, targets, numDays, people, config } = opts;
    const perDay = perPersonDailyTotals(totals, numDays, people);
    const anyScored = Object.keys(targets || {}).some(
        k => getNutrientWeight(k, config) > 0 && (targets[k] || 0) > 0
    );
    if (!anyScored) return null;
    return calculateHealthScore(perDay, targets, config);
}
