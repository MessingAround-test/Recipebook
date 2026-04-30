import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import DailyLog from '../../../models/DailyLog';
import IngredientConversion from '../../../models/IngredientConversion';
import User from '../../../models/User';
import { verifyToken } from "../../../lib/auth.ts";
import { calculateDailyIntake } from '../../../lib/dailyIntake.ts';
import { normalizeToGrams } from '../../../lib/conversion.js';

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();
    const { date } = req.query;
    const userId = decoded.id;

    try {
        // 1. Get user profile and calculate targets
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        
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

        // 2. Aggregate intake (Current day if date provided, otherwise 7-day trend)
        const totals = {};
        nutrientKeys.forEach(k => totals[k] = 0);

        if (date) {
            const log = await DailyLog.findOne({ user_id: userId, date });
            if (log) {
                log.items.forEach(item => {
                    nutrientKeys.forEach(k => {
                        totals[k] += (item.nutrients[k] || 0);
                    });
                });
            }
        } else {
            const now = new Date();
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const log = await DailyLog.findOne({ user_id: userId, date: dateStr });
                if (log) {
                    log.items.forEach(item => {
                        nutrientKeys.forEach(k => {
                            totals[k] += (item.nutrients[k] || 0);
                        });
                    });
                }
            }
            // Average it out for weekly comparison
            nutrientKeys.forEach(k => totals[k] = totals[k] / 7);
        }

        // 3. Find all deficiencies and overages
        const deficiencies = [];
        const overages = [];
        nutrientKeys.forEach(k => {
            const target = targets[k];
            if (target <= 0) return;
            const pct = totals[k] / target;
            
            // We consider anything under 95% a deficiency for daily focus
            if (pct < 0.95) deficiencies.push({ key: k, pct });
            if (pct >= 1.0) overages.push({ key: k, pct });
        });

        if (deficiencies.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: "You are meeting almost all your targets! Great job.", 
                recommendations: [] 
            });
        }

        // Sort deficiencies by lowest %
        deficiencies.sort((a, b) => a.pct - b.pct);
        const mostDeficient = deficiencies[0].key;

        // 5. Query ingredients and score them holistically
        const minIngredientContribution = targets[mostDeficient] * 0.1;
        const candidates = await IngredientConversion.find({
            [mostDeficient]: { $gte: minIngredientContribution },
            should_recommend: { $ne: false }
        })
        .sort({ [mostDeficient]: -1 })
        .limit(20);

        const scored = candidates.map(r => {
            let score = 0;

            // Prioritise fresh food
            const freshCategories = ['Fresh Produce', 'Meat and Seafood'];
            if (freshCategories.includes(r.category)) {
                score += 5;
            }

            const helpsWith = [];
            const warnings = [];

            // +1 for every nutrient deficiency it helps with
            deficiencies.forEach(d => {
                if (r[d.key] > 0) {
                    score += 1;
                    if (d.key !== mostDeficient) helpsWith.push(d.key);
                }
            });

            // -2 for high restrictive nutrients if we are already over
            const restrictives = ['sodium_mg', 'energy_kcal', 'fat_g'];
            restrictives.forEach(k => {
                const overage = overages.find(o => o.key === k);
                if (overage && r[k] > (targets[k] * 0.15)) { // If > 15% of daily target in 100g
                    score -= 2;
                    warnings.push(k);
                }
            });

            return { r, score, helpsWith, warnings };
        });

        // Final sort and selection
        scored.sort((a, b) => b.score - a.score);
        const top5 = scored.slice(0, 5);

        // 6. Search for Recipes that include top candidates (prioritizing snacks)
        const candidateNames = candidates.slice(0, 10).map(c => c.ingredient_name.toLowerCase());
        
        let recipeQuery = {
            "ingredients.Name": { 
                $in: candidateNames.map(name => new RegExp(name, 'i')) 
            }
        };

        if (decoded.role !== 'admin') {
            recipeQuery.creator_email = user.email;
        }

        let recipes = await Recipe.find(recipeQuery).limit(10);

        recipes.sort((a, b) => {
            const isASnack = (a.mealTypes || []).some(m => /snack/i.test(m)) || /snack/i.test(a.genre || '');
            const isBSnack = (b.mealTypes || []).some(m => /snack/i.test(m)) || /snack/i.test(b.genre || '');
            if (isASnack && !isBSnack) return -1;
            if (!isASnack && isBSnack) return 1;
            return 0;
        });

        const topRecipes = recipes.slice(0, 3);

        // 7. Calculate nutritional totals for the top recipes
        const detailedRecipes = await Promise.all(topRecipes.map(async (rec) => {
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

            // Divide by servings
            const servings = rec.servings || 1;
            nutrientKeys.forEach(k => recipeNutrients[k] = recipeNutrients[k] / servings);

            return {
                id: rec._id,
                name: rec.name,
                image: rec.image,
                ingredients: rec.ingredients.map(i => i.Name),
                isSnack: (rec.mealTypes || []).some(m => /snack/i.test(m)) || /snack/i.test(rec.genre || ''),
                nutrients: recipeNutrients
            };
        }));

        // Filter recipes by minimum contribution
        const minRecipeContribution = targets[mostDeficient] * 0.1;
        const filteredRecipes = detailedRecipes.filter(r => (r.nutrients[mostDeficient] || 0) >= minRecipeContribution);

        return res.status(200).json({
            success: true,
            deficientNutrient: mostDeficient,
            currentWeeklyPct: Math.round(deficiencies[0].pct * 100),
            dailyTargets: targets,
            recommendations: top5.map(item => ({
                name: item.r.ingredient_name,
                value: item.r[mostDeficient],
                grams_per_each: item.r.grams_per_each,
                helpsWith: item.helpsWith,
                warnings: item.warnings,
                fullProfile: item.r
            })),
            recipeRecommendations: filteredRecipes
        });

    } catch (err) {
        console.error("Recommendations Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
