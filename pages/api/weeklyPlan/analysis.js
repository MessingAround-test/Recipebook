import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import User from '../../../models/User';
import IngredientConversion from '../../../models/IngredientConversion';
import { verifyToken } from '../../../lib/auth';
import { calculateDailyIntake, NUTRIENT_LABELS } from '../../../lib/dailyIntake';
import { normalizeToGrams } from '../../../lib/conversion';
import { mergeHealthScoreConfig, getNutrientWeight } from '../../../lib/healthScore';
import { buildNutrientCoverage, computeProjectedScore } from '../../../lib/planCoverage';
import { computeRecipeNutrientTotals, computePlainIngredientNutrients, escapeRegExp } from '../../../lib/planNutrition';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();

    try {
        const { plan } = req.body;
        if (!plan) return res.status(400).json({ success: false, message: 'Plan is required' });

        const numDays = Math.max(1, plan.numDays || 7);

        const userId = decoded.id;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const profile = {
            age: user.age,
            gender: user.gender,
            weight_kg: user.weight,
            height_cm: user.height,
            activity_level: user.activity_level,
            daily_exercise_kj: user.daily_exercise_kj
        };
        const targets = calculateDailyIntake(profile);
        const nutrientKeys = Object.keys(targets);
        const healthScoreConfig = mergeHealthScoreConfig(user.health_score_config);

        const totals = {};
        nutrientKeys.forEach(k => totals[k] = 0);
        let totalCost = 0;

        const recipeAnalysis = [];

        // Track filled meal slots (only plannedRecipes, not everydayItems)
        const filledSlots = new Set();

        // 1. Process Planned Recipes
        for (const item of (plan.plannedRecipes || [])) {
            if (item.day !== 'Undecided') {
                filledSlots.add(`${item.day}-${item.mealType}`);

                // An explicit "Average Meal" placeholder is counted at average
                // values (1/3 of daily macro target, 15% for vitamins/minerals).
                if (item.isAverageMeal) {
                    nutrientKeys.forEach(k => {
                        const isMacro = ['energy_kcal', 'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g'].includes(k);
                        totals[k] += isMacro ? (targets[k] / 3) : (targets[k] * 0.15);
                    });
                    continue;
                }

                const data = await computeRecipeNutrientTotals(item.recipe_id, item.servings, nutrientKeys);
                if (data) {
                    nutrientKeys.forEach(k => {
                        totals[k] += data.nutrients[k] || 0;
                    });
                    totalCost += data.cost;

                    // Check if expensive or low nutrition
                    // Example: > $8 per serving is expensive
                    const costPerServe = data.cost / item.servings;
                    const isExpensive = costPerServe > 8;

                    // Low nutrition: < 10% of target for all vitamins/minerals combined, but high calories
                    // This is a simple heuristic
                    let totalVitMinPct = 0;
                    nutrientKeys.forEach(k => {
                        if (k !== 'energy_kcal' && k !== 'carbohydrates_g' && k !== 'protein_g' && k !== 'fat_g') {
                            totalVitMinPct += (data.nutrients[k] / targets[k]);
                        }
                    });
                    const isLowNutrition = totalVitMinPct < 1.0 && (data.nutrients.energy_kcal / targets.energy_kcal) > 0.2;

                    recipeAnalysis.push({
                        id: item.id || item._id,
                        recipe_id: item.recipe_id,
                        day: item.day,
                        mealType: item.mealType,
                        cost: data.cost,
                        isExpensive,
                        isLowNutrition
                    });
                }
            }
        }

        // 2. Process Pantry Pool Items (everydayItems)
        // Pool quantities are WEEKLY totals, spread evenly across the plan's days.
        // They are added once to the weekly totals; dailyAverages (totals / numDays) handles the spreading.
        let everydayCost = 0;
        for (const item of (plan.everydayItems || [])) {
            if (item.recipe_id) {
                const data = await computeRecipeNutrientTotals(item.recipe_id, item.quantity, nutrientKeys, { isEveryday: true });
                if (data) {
                    nutrientKeys.forEach(k => {
                        totals[k] += data.nutrients[k] || 0;
                    });
                    totalCost += data.cost;
                    everydayCost += data.cost;
                }
                continue;
            }

            // Plain ingredient (no recipe): look up its per-100g nutrition by name.
            // Quantity is the weekly total; 'each' units use grams_per_each, 'grams' is literal.
            const plain = await computePlainIngredientNutrients(item.name, item.quantity, item.quantity_unit, nutrientKeys);
            if (plain) {
                nutrientKeys.forEach(k => {
                    totals[k] += plain.nutrients[k] || 0;
                });
            }
        }

        // 3. No auto-backfill: empty meal slots count as no meal. The user can
        // add explicit "Average Meal" placeholders from the recipe pool if they
        // want a day estimated at average values (handled in step 1).
        const numMissingSlots = 0;

        // Calculate cost percentage per recipe
        recipeAnalysis.forEach(r => {
            r.costPercentage = totalCost > 0 ? (r.cost / totalCost) * 100 : 0;
        });

        // 4. Calculate Daily Averages and Deficiencies
        const dailyAverages = {};
        nutrientKeys.forEach(k => {
            dailyAverages[k] = totals[k] / numDays;
        });

        // Deficiencies respect the user's health-score weightings: nutrients
        // with a weight of 0 are excluded entirely.
        const deficiencies = [];
        nutrientKeys.forEach(k => {
            const target = targets[k];
            if (target <= 0) return;
            const weight = getNutrientWeight(k, healthScoreConfig);
            if (weight <= 0) return;
            const pct = dailyAverages[k] / target;
            if (pct < 0.95) {
                deficiencies.push({ key: k, pct });
            }
        });

        deficiencies.sort((a, b) => a.pct - b.pct);

        const people = plan.defaultServings || 1;
        const nutrientCoverage = buildNutrientCoverage({
            totals,
            targets,
            numDays,
            people,
            config: healthScoreConfig
        });
        const projectedScore = computeProjectedScore({
            totals,
            targets,
            numDays,
            people,
            config: healthScoreConfig
        });

        // 5. DB-backed suggestions for the biggest low nutrients.
        // For each nutrient projected to come in low we find foods from
        // IngredientConversion (real per-100g nutrient data) plus recipes from
        // the user's library that contain those foods. Foods/recipes already in
        // the plan period are excluded, and each suggestion shows how much of
        // the daily target it covers (foods per 100g, recipes per serving).
        const SUGGEST_PER_GROUP = 2;
        const SUGGEST_FOOD_COUNT = 5;
        const SUGGEST_RECIPE_COUNT = 5;

        const byGroup = { macro: [], mineral: [], vitamin: [] };
        nutrientCoverage
            .filter(c => c.pct < 95)
            .forEach(c => {
                if (byGroup[c.group] && byGroup[c.group].length < SUGGEST_PER_GROUP) {
                    byGroup[c.group].push(c.key);
                }
            });

        // Foods and recipes already in the plan period should not be re-suggested.
        // recipe_id may arrive as a hex string, an ObjectId, or (after a load)
        // a populated object like { _id, name, ... } — normalize all forms.
        const normalizeRecipeId = (r) => {
            if (!r) return null;
            if (typeof r === 'string') return r.trim();
            if (r._id != null) return String(r._id);
            return String(r);
        };
        const isObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id));
        const planRecipeIds = [...new Set([
            ...(plan.plannedRecipes || []).map(r => normalizeRecipeId(r.recipe_id)),
            ...(plan.everydayItems || []).map(i => normalizeRecipeId(i.recipe_id))
        ].filter(Boolean))];
        const plannedRecipeIdSet = new Set(planRecipeIds);

        // Names of the foods already covered by the plan. Exact matches count,
        // plus word-boundary substrings so "spinach, raw" counts as "spinach".
        const plannedFoodNames = new Set();
        const validPlanRecipeIds = planRecipeIds.filter(isObjectId);
        if (validPlanRecipeIds.length > 0) {
            const plannedDocs = await Recipe.find({ _id: { $in: validPlanRecipeIds } })
                .select('ingredients')
                .lean();
            plannedDocs.forEach(doc => {
                (doc.ingredients || []).forEach(ing => plannedFoodNames.add(String(ing.Name || '').toLowerCase()));
            });
        }
        (plan.everydayItems || []).forEach(i => {
            if (!i.recipe_id && i.name) plannedFoodNames.add(String(i.name).toLowerCase());
        });
        const isFoodAlreadyPlanned = (candidate) => {
            const c = String(candidate || '').toLowerCase().trim();
            if (!c) return true;
            const containsAsWord = (longer, shorter) => {
                const idx = longer.indexOf(shorter);
                if (idx === -1) return false;
                const before = idx === 0 ? ' ' : longer[idx - 1];
                const after = idx + shorter.length >= longer.length ? ' ' : longer[idx + shorter.length];
                return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
            };
            for (const pRaw of plannedFoodNames) {
                const p = String(pRaw || '').toLowerCase().trim();
                if (!p) continue;
                if (c === p) return true;
                if (c.length >= p.length) {
                    if (containsAsWord(c, p)) return true;
                } else if (containsAsWord(p, c)) {
                    return true;
                }
            }
            return false;
        };

        // Per-serving amount of a single nutrient for a recipe (for impact display).
        const recipeNutrientPerServing = async (rec, key) => {
            let total = 0;
            for (const ing of (rec.ingredients || [])) {
                const conv = await IngredientConversion.findOne({
                    ingredient_name: { $regex: new RegExp(`^${escapeRegExp(String(ing.Name || ''))}$`, 'i') }
                });
                if (conv && conv[key]) {
                    const { value: grams } = normalizeToGrams(ing.AmountType, ing.Amount, conv.grams_per_each);
                    if (grams) total += (conv[key] || 0) * (grams / 100);
                }
            }
            return total / (rec.servings || 1);
        };

        const suggestionKeys = [...byGroup.macro, ...byGroup.mineral, ...byGroup.vitamin];
        const suggestions = [];
        for (const key of suggestionKeys) {
            const coverageItem = nutrientCoverage.find(c => c.key === key);
            if (!coverageItem) continue;

            const minContribution = targets[key] * 0.1;
            let foods = [];
            let recipes = [];
            try {
                const ingredientCandidates = await IngredientConversion.find({
                    [key]: { $gte: minContribution },
                    should_recommend: { $ne: false }
                })
                    .sort({ [key]: -1 })
                    .limit(30)
                    .lean();

                foods = ingredientCandidates
                    .filter(c => !isFoodAlreadyPlanned(c.ingredient_name))
                    .slice(0, SUGGEST_FOOD_COUNT)
                    .map(c => ({
                        name: c.ingredient_name,
                        pct: targets[key] ? ((c[key] || 0) / targets[key]) * 100 : 0
                    }));

                const candidateFoodNames = ingredientCandidates.slice(0, 12).map(c => c.ingredient_name);
                if (candidateFoodNames.length > 0) {
                    const nameRegexes = candidateFoodNames.map(name => new RegExp(escapeRegExp(name), 'i'));
                    const matchingRecipes = await Recipe.find({ 'ingredients.Name': { $in: nameRegexes } })
                        .select('name image ingredients servings')
                        .limit(10)
                        .lean();

                    const scored = [];
                    for (const rec of matchingRecipes) {
                        if (plannedRecipeIdSet.has(String(rec._id))) continue;
                        const perServing = await recipeNutrientPerServing(rec, key);
                        if (perServing > 0) {
                            scored.push({
                                _id: String(rec._id),
                                name: rec.name,
                                image: rec.image,
                                pct: targets[key] ? (perServing / (targets[key] * numDays)) * 100 : 0
                            });
                        }
                    }
                    scored.sort((a, b) => b.pct - a.pct);
                    recipes = scored.slice(0, SUGGEST_RECIPE_COUNT);
                }
            } catch (err) {
                console.error(`Suggestions error for ${key}:`, err);
            }

            suggestions.push({
                key,
                label: NUTRIENT_LABELS[key]?.label || key,
                pct: coverageItem.pct,
                foods,
                recipes
            });
        }

        return res.status(200).json({
            success: true,
            analysis: {
                numDays,
                weeklyTotals: totals,
                dailyAverages,
                dailyTargets: targets,
                deficiencies,
                nutrientCoverage,
                projectedScore,
                healthScoreConfig,
                suggestions,
                totalCost,
                averageDailyCost: totalCost / numDays,
                totalCostPerPerson: totalCost / people,
                averageDailyCostPerPerson: (totalCost / numDays) / people,
                numMissingSlots,
                everydayCost,
                dailyEverydayCost: everydayCost / numDays,
                recipeAnalysis
            }
        });

    } catch (err) {
        console.error("Weekly Plan Analysis Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
