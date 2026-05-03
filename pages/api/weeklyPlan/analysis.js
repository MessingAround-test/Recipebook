import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import User from '../../../models/User';
import IngredientConversion from '../../../models/IngredientConversion';
import { verifyToken } from '../../../lib/auth';
import { calculateDailyIntake } from '../../../lib/dailyIntake';
import { normalizeToGrams } from '../../../lib/conversion';

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

        // 2. Process Everyday Items
        let everydayCost = 0;
        for (const item of (plan.everydayItems || [])) {
            // Everyday items quantities are PER DAY, so multiply by 7 for the week
            const data = await getRecipeNutritionAndCost(item.recipe_id, item.quantity, true);
            if (data) {
                nutrientKeys.forEach(k => {
                    totals[k] += (data.nutrients[k] || 0) * 7;
                });
                const weeklyCost = data.cost * 7;
                totalCost += weeklyCost;
                everydayCost += weeklyCost;
            }
        }

        // Track which days have any meals planned
        const activeDays = new Set();
        for (const item of (plan.plannedRecipes || [])) {
            if (item.day !== 'Undecided') {
                activeDays.add(item.day);
            }
        }

        // 3. Fill in Missing Meals
        // We only backfill meals for days that are COMPLETELY empty.
        // If a day has any meals planned, we assume the user is intentionally skipping the rest.
        const numEmptyDays = 7 - activeDays.size;
        const numMissingSlots = numEmptyDays * 3;

        if (numMissingSlots > 0) {
            nutrientKeys.forEach(k => {
                // Average meal provides 1/3 of daily target for macros, but only 15% for vitamins/minerals
                const isMacro = ['energy_kcal', 'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g'].includes(k);
                const avgMealValue = isMacro ? (targets[k] / 3) : (targets[k] * 0.15);
                totals[k] += numMissingSlots * avgMealValue;
            });
        }

        // Calculate cost percentage per recipe
        recipeAnalysis.forEach(r => {
            r.costPercentage = totalCost > 0 ? (r.cost / totalCost) * 100 : 0;
        });

        // 4. Calculate Daily Averages and Deficiencies
        const dailyAverages = {};
        nutrientKeys.forEach(k => {
            dailyAverages[k] = totals[k] / 7;
        });

        const deficiencies = [];
        nutrientKeys.forEach(k => {
            const target = targets[k];
            if (target <= 0) return;
            const pct = dailyAverages[k] / target;
            if (pct < 0.95) {
                deficiencies.push({ key: k, pct });
            }
        });

        deficiencies.sort((a, b) => a.pct - b.pct);

        return res.status(200).json({
            success: true,
            analysis: {
                weeklyTotals: totals,
                dailyAverages,
                dailyTargets: targets,
                deficiencies,
                totalCost,
                averageDailyCost: totalCost / 7,
                totalCostPerPerson: totalCost / (plan.defaultServings || 1),
                averageDailyCostPerPerson: (totalCost / 7) / (plan.defaultServings || 1),
                numMissingSlots,
                everydayCost,
                dailyEverydayCost: everydayCost / 7,
                recipeAnalysis
            }
        });

    } catch (err) {
        console.error("Weekly Plan Analysis Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
