import { DailyIntakeTargets } from './dailyIntake'

export interface DailySuggestionRule {
    key: keyof DailyIntakeTargets
    label: string
    thresholdPct: number
    message: string
    icon: 'activity' | 'droplet'
    priority: number
}

// Pre-generated "over consumption" rules. Each rule fires only when its
// nutrient is above thresholdPct% of the daily target. Lower priority fires
// first if several nutrients are over. Add new rules here to extend.
export const DAILY_SUGGESTION_RULES: DailySuggestionRule[] = [
    {
        key: 'energy_kcal',
        label: 'Energy',
        thresholdPct: 100,
        message: 'Energy is running high — do a bit of extra exercise today',
        icon: 'activity',
        priority: 1
    },
    {
        key: 'fat_g',
        label: 'Fat',
        thresholdPct: 100,
        message: 'High in fat — do a bit of extra exercise today',
        icon: 'activity',
        priority: 2
    },
    {
        key: 'carbohydrates_g',
        label: 'Carbs',
        thresholdPct: 100,
        message: 'High in carbs — do a bit of extra exercise today',
        icon: 'activity',
        priority: 3
    },
    {
        key: 'sodium_mg',
        label: 'Sodium',
        thresholdPct: 100,
        message: 'High in sodium — drink some extra water today',
        icon: 'droplet',
        priority: 4
    }
]

export function getDailySuggestion(
    totals: Record<string, number>,
    targets: Partial<DailyIntakeTargets> | null | undefined
): DailySuggestionRule | null {
    if (!targets) return null
    const ordered = [...DAILY_SUGGESTION_RULES].sort((a, b) => a.priority - b.priority)
    for (const rule of ordered) {
        const target = targets[rule.key]
        const consumed = totals[rule.key] || 0
        if (target && target > 0 && (consumed / target) * 100 > rule.thresholdPct) {
            return rule
        }
    }
    return null
}

export interface CoverageItem {
    key: string
    pct: number
}

// Same rules, but driven by a plan's estimated day coverage (percent of each
// daily target) instead of logged totals — used for "if we ate everything
// planned today" recommendations.
export function getDailySuggestionFromCoverage(
    coverage: CoverageItem[] | null | undefined
): DailySuggestionRule | null {
    if (!coverage) return null
    const pctByKey: Record<string, number> = {}
    coverage.forEach(c => { pctByKey[c.key] = c.pct })
    const ordered = [...DAILY_SUGGESTION_RULES].sort((a, b) => a.priority - b.priority)
    for (const rule of ordered) {
        if (pctByKey[rule.key] != null && pctByKey[rule.key] > rule.thresholdPct) {
            return rule
        }
    }
    return null
}
