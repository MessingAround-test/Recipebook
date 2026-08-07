import Recipe from '../models/Recipe';
import IngredientConversion from '../models/IngredientConversion';
import { normalizeToGrams } from './conversion';

export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Computes a recipe's nutrient totals and cost for a given number of logged
 * servings. Reused by the weekly-plan analysis and the day-suggestion logic so
 * the numbers always agree.
 */
export async function computeRecipeNutrientTotals(recipeId, servingsToLog, nutrientKeys, { isEveryday = false } = {}) {
    const rec = await Recipe.findById(recipeId);
    if (!rec) return null;

    const nutrients = {};
    nutrientKeys.forEach(k => nutrients[k] = 0);

    for (const ing of (rec.ingredients || [])) {
        const conv = await IngredientConversion.findOne({
            ingredient_name: { $regex: new RegExp(`^${escapeRegExp(ing.Name || '')}$`, 'i') }
        });
        if (conv) {
            const { value: grams } = normalizeToGrams(ing.AmountType, ing.Amount, conv.grams_per_each);
            if (grams) {
                nutrientKeys.forEach(k => {
                    nutrients[k] += (conv[k] || 0) * (grams / 100);
                });
            }
        }
    }

    const recServings = rec.servings || 1;
    const ratio = servingsToLog / recServings;
    nutrientKeys.forEach(k => nutrients[k] *= ratio);

    const baseCost = rec.unitCost || rec.approxCost || rec.cost || 0;
    const cost = isEveryday
        ? baseCost * servingsToLog
        : (baseCost / recServings) * servingsToLog;

    return { rec, nutrients, cost };
}

/**
 * Computes nutrient totals from a raw ingredient list (e.g. a freshly generated
 * recipe not yet saved to the DB) at full recipe scale. Used to preview the
 * nutritional impact of an AI-generated recipe before it's added.
 */
export async function computeIngredientListNutrients(ingredients, nutrientKeys) {
    const nutrients = {};
    nutrientKeys.forEach(k => nutrients[k] = 0);

    for (const ing of (ingredients || [])) {
        const conv = await IngredientConversion.findOne({
            ingredient_name: { $regex: new RegExp(`^${escapeRegExp(ing.Name || '')}$`, 'i') }
        });
        if (conv) {
            const { value: grams } = normalizeToGrams(ing.AmountType, ing.Amount, conv.grams_per_each);
            if (grams) {
                nutrientKeys.forEach(k => {
                    nutrients[k] += (conv[k] || 0) * (grams / 100);
                });
            }
        }
    }

    return nutrients;
}

/**
 * Computes nutrient totals for a plain (non-recipe) pantry item given its
 * weekly total quantity. Returns null when the ingredient can't be resolved.
 */
export async function computePlainIngredientNutrients(name, weeklyQuantity, quantityUnit, nutrientKeys) {
    if (!name) return null;
    const conv = await IngredientConversion.findOne({
        ingredient_name: { $regex: new RegExp(`^${escapeRegExp(String(name))}$`, 'i') }
    });
    if (!conv) return null;

    const unit = String(quantityUnit || 'each').toLowerCase();
    const grams = unit === 'grams'
        ? Number(weeklyQuantity) || 0
        : (Number(weeklyQuantity) || 0) * (conv.grams_per_each || 0);
    if (grams <= 0) return null;

    const nutrients = {};
    nutrientKeys.forEach(k => nutrients[k] = (conv[k] || 0) * (grams / 100));
    return { conv, nutrients, grams };
}

/**
 * Computes nutrient totals for a single day: that day's planned recipes plus
 * the prorated daily share of everyday (pantry pool) items, then converts to
 * per-person coverage against the given daily targets.
 */
export async function computeDayNutrients({ plan, day, targets, people, numDays }) {
    const nutrientKeys = Object.keys(targets || {});
    const totals = {};
    nutrientKeys.forEach(k => totals[k] = 0);

    const plannedMeals = [];
    let cost = 0;

    for (const item of (plan.plannedRecipes || [])) {
        if (!item || item.day !== day || item.day === 'Undecided') continue;
        plannedMeals.push({ mealType: item.mealType, name: item.recipe_name, carbType: item.carbType });

        // An explicit "Average Meal" placeholder counts at average values.
        if (item.isAverageMeal) {
            nutrientKeys.forEach(k => {
                const isMacro = ['energy_kcal', 'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g'].includes(k);
                totals[k] += isMacro ? (targets[k] / 3) : (targets[k] * 0.15);
            });
            continue;
        }

        const data = await computeRecipeNutrientTotals(item.recipe_id, item.servings, nutrientKeys);
        if (data) {
            nutrientKeys.forEach(k => totals[k] += data.nutrients[k] || 0);
            cost += data.cost;
        }
    }

    // Everyday items are weekly totals, spread evenly across the plan's days.
    const days = Math.max(1, numDays || 7);
    for (const item of (plan.everydayItems || [])) {
        if (item.recipe_id) {
            const data = await computeRecipeNutrientTotals(item.recipe_id, item.quantity / days, nutrientKeys, { isEveryday: true });
            if (data) {
                nutrientKeys.forEach(k => totals[k] += data.nutrients[k] || 0);
                cost += data.cost;
            }
            continue;
        }
        const plain = await computePlainIngredientNutrients(item.name, item.quantity / days, item.quantity_unit, nutrientKeys);
        if (plain) {
            nutrientKeys.forEach(k => totals[k] += plain.nutrients[k] || 0);
        }
    }

    const divisor = Math.max(1, people || 1);
    const perPerson = {};
    nutrientKeys.forEach(k => perPerson[k] = (totals[k] || 0) / divisor);

    const coverage = [];
    for (const key of nutrientKeys) {
        const target = targets[key];
        if (!target || !Number.isFinite(target) || target <= 0) continue;
        coverage.push({ key, value: perPerson[key], target, pct: (perPerson[key] / target) * 100 });
    }

    return { dayTotals: totals, perPerson, coverage, plannedMeals, cost };
}
