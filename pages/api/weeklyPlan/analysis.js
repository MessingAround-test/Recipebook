import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import User from '../../../models/User';
import IngredientConversion from '../../../models/IngredientConversion';
import { verifyToken } from '../../../lib/auth';
import { calculateDailyIntake } from '../../../lib/dailyIntake';
import { normalizeToGrams } from '../../../lib/conversion';
import { mergeHealthScoreConfig, getNutrientWeight } from '../../../lib/healthScore';
import { buildNutrientCoverage, computeProjectedScore } from '../../../lib/planCoverage';

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

        // Helper to fetch and calculate recipe nutrients
        const getRecipeNutritionAndCost = async (recipeId, servingsToLog, isEveryday = false, isLeftover = false) => {
            const rec = await Recipe.findById(recipeId);
            if (!rec) return null;

            const recipeNutrients = {};
            nutrientKeys.forEach(k => recipeNutrients[k] = 0);

            for (const ing of rec.ingredients) {
                const conv = await IngredientConversion.findOne({ 
                    ingredient_name: { $regex: new RegExp(`^${ing.Name}$`, 'i') } 
                });
                if (conv) {
                    const { value: grams } = normalizeToGrams(ing.AmountType, ing.Amount, conv.grams_per_each);
                    if (grams) {
                        nutrientKeys.forEach(k => {
                            recipeNutrients[k] += (conv[k] || 0) * (grams / 100);
                        });
                    }
                }
            }

            const recServings = rec.servings || 1;
            const ratio = servingsToLog / recServings;

            // Scale by ratio
            nutrientKeys.forEach(k => recipeNutrients[k] *= ratio);

            // Use unitCost (cost of buying all ingredients) for a realistic checkout cost, fallback to approxCost
            const baseCost = rec.unitCost || rec.approxCost || rec.cost || 0;
            
            let cost = 0;
            if (isEveryday) {
                // If everyday, servingsToLog is actually the total quantity for the day
                cost = baseCost * servingsToLog;
            } else {
                // For planned recipes (including leftovers), split the unit cost proportionally across servings
                cost = (baseCost / recServings) * servingsToLog;
            }

            return { rec, nutrients: recipeNutrients, cost };
        };

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

                const data = await getRecipeNutritionAndCost(item.recipe_id, item.servings, false, item.isLeftover);
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
            const data = await getRecipeNutritionAndCost(item.recipe_id, item.quantity, true);
            if (data) {
                nutrientKeys.forEach(k => {
                    totals[k] += data.nutrients[k] || 0;
                });
                totalCost += data.cost;
                everydayCost += data.cost;
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
