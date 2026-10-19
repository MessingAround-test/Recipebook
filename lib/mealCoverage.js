// Per-meal servings coverage: how many people actually need each meal on each
// day (e.g. breakfast 1, dinner 2 because a partner is only home at night).
// Shared by the planner client (block sizing, steppers, badges) and the
// weekly-plan analysis endpoints. Everything falls back to the plan-wide
// defaultServings so plans without coverage behave exactly as before.

export const COVERAGE_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function clampServings(n) {
    const v = Math.round(Number(n) || 0);
    return Number.isFinite(v) && v > 0 ? v : 1;
}

/** Does this plan carry any per-meal coverage entries at all? */
export function hasMealCoverage(plan) {
    const coverage = plan && plan.mealCoverage;
    if (!coverage || typeof coverage !== 'object') return false;
    return Object.keys(coverage).some(day => {
        const meals = coverage[day];
        return meals && typeof meals === 'object' && Object.keys(meals).length > 0;
    });
}

/** Required servings for one day + meal. Missing values fall back to defaultServings. */
export function getRequiredServings(plan, day, meal) {
    const fallback = clampServings(plan && plan.defaultServings ? plan.defaultServings : 2);
    const n = plan && plan.mealCoverage && plan.mealCoverage[day] && plan.mealCoverage[day][meal];
    if (n == null) return fallback;
    return clampServings(n);
}

/**
 * The "person there the entire time" number for a day: the minimum required
 * servings across that day's meals. Unset meals count at defaultServings (as
 * getRequiredServings would); meals with a value of 0 (nobody needs that
 * meal) are excluded so they don't drag the min down. An empty day falls
 * back to defaultServings.
 */
export function getDayAnchorServings(plan, day) {
    const fallback = clampServings(plan && plan.defaultServings ? plan.defaultServings : 2);
    const meals = plan && plan.mealCoverage && plan.mealCoverage[day];
    let min = null;
    for (const meal of COVERAGE_MEALS) {
        const n = meals && typeof meals === 'object' ? meals[meal] : null;
        const v = n == null ? fallback : Math.round(Number(n) || 0);
        if (v <= 0) continue;
        if (min == null || v < min) min = v;
    }
    return min == null ? fallback : min;
}

/**
 * How many people the blocks already planned in a slot feed. Each dish is
 * sized to the people eating it, so the largest block is the slot's coverage
 * (not the sum — a second dish doesn't mean more people).
 */
export function getSlotPlannedPeople(plan, day, meal) {
    if (!plan || !Array.isArray(plan.plannedRecipes)) return 0;
    let max = 0;
    for (const r of plan.plannedRecipes) {
        if (!r || r.day !== day || r.mealType !== meal) continue;
        const v = Math.round(Number(r.servings) || 0);
        if (v > max) max = v;
    }
    return max;
}

/**
 * Sizing rule when adding a recipe to a slot that needs `required` servings:
 * the cook block feeds min(recipeYield, required) people and any excess
 * becomes leftovers. When the recipe yields less than required the block keeps
 * its yield — the UI highlights the slot as needing a scale-up.
 */
export function computeBlockServings(recipeYield, required) {
    const yield_ = clampServings(recipeYield);
    const req = clampServings(required);
    const primary = Math.max(1, Math.min(yield_, req));
    const leftover = Math.max(0, yield_ - primary);
    return { primary, leftover };
}

/**
 * Applies a source week's coverage pattern onto a target range by day index
 * (day 0 of the source maps to day 0 of the target, etc.). Every target day
 * is fully materialized — all four meals — using the source's listed value
 * or the standard defaultServings when the source is silent. Returns a full
 * replacement for the target's coverage (existing mods are overwritten).
 */
export function applyCoverageByIndex(sourceCoverage, sourceStart, sourceNumDays, targetDays, defaultServings = 2) {
    if (!sourceCoverage || !sourceStart || !Array.isArray(targetDays)) return {};
    const fallback = clampServings(defaultServings);
    const limit = Math.min(clampServings(sourceNumDays), targetDays.length);
    const result = {};
    for (let i = 0; i < targetDays.length; i++) {
        const sourceDay = i < limit ? shiftDate(sourceStart, i) : null;
        const meals = sourceDay && sourceCoverage ? sourceCoverage[sourceDay] : null;
        const clean = {};
        for (const meal of COVERAGE_MEALS) {
            const n = meals && typeof meals === 'object' ? meals[meal] : null;
            clean[meal] = n == null ? fallback : clampServings(n);
        }
        result[targetDays[i]] = clean;
    }
    return result;
}

/** Local-safe YYYY-MM-DD + n days shift (no Date UTC pitfalls). */
export function shiftDate(dateStr, days) {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}
