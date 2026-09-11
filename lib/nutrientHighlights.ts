import { DailyIntakeTargets, NUTRIENT_LABELS } from './dailyIntake';

export interface NutrientHighlight {
    key: string;
    label: string;
    unit: string;
    pct: number;
    tier: 'very-high' | 'high';
}

export interface NutrientHighlights {
    pros: NutrientHighlight[];
    cons: NutrientHighlight[];
}

/** Nutrients where a high %DI is a "con" (limit these). */
export const CON_NUTRIENT_KEYS: string[] = [
    'energy_kcal',
    'fat_g',
    'carbohydrates_g',
    'sodium_mg',
];

/** Thresholds as % of the daily target. */
export const PRO_HIGH_PCT = 30;
export const PRO_VERY_HIGH_PCT = 50;
export const CON_HIGH_PCT = 40;

/**
 * Derives standout "pros" (beneficial nutrients eaten in meaningful amounts)
 * and "cons" (limit nutrients eaten in large amounts) from a set of totals.
 *
 * `totals` should already be scaled to the amount being viewed (e.g. one serve).
 * Percentages are relative to the personalised `targets`.
 */
export function computeNutrientHighlights(
    totals: Record<string, number>,
    targets: DailyIntakeTargets,
    { maxPerSide = 3 }: { maxPerSide?: number } = {}
): NutrientHighlights {
    const allKeys = Object.keys(NUTRIENT_LABELS) as (keyof DailyIntakeTargets)[];

    const pctFor = (key: string): number => {
        const target = targets[key as keyof DailyIntakeTargets] || 0;
        if (target <= 0) return 0;
        return ((totals[key] || 0) / target) * 100;
    };

    const toHighlight = (key: string): NutrientHighlight => {
        const pct = pctFor(key);
        const meta = NUTRIENT_LABELS[key as keyof DailyIntakeTargets];
        return {
            key,
            label: meta?.label ?? key,
            unit: meta?.unit ?? '',
            pct,
            tier: pct >= PRO_VERY_HIGH_PCT ? 'very-high' : 'high',
        };
    };

    const pros = allKeys
        .filter((key) => !CON_NUTRIENT_KEYS.includes(key))
        .map((key) => ({ key, pct: pctFor(key) }))
        .filter((entry) => entry.pct >= PRO_HIGH_PCT)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, maxPerSide)
        .map((entry) => toHighlight(entry.key));

    const cons = CON_NUTRIENT_KEYS
        .map((key) => ({ key, pct: pctFor(key) }))
        .filter((entry) => entry.pct >= CON_HIGH_PCT)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, maxPerSide)
        .map((entry) => toHighlight(entry.key));

    return { pros, cons };
}
