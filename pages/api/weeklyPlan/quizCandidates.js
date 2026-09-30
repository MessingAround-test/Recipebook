import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import User from '../../../models/User';
import { verifyToken, requireFeature } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { calculateDailyIntake, NUTRIENT_LABELS } from '../../../lib/dailyIntake';
import { computeDayNutrients, computeRecipeNutrientTotals } from '../../../lib/planNutrition';
import { buildDietaryConstraints } from '../../../lib/dietaryRules';
import { filterRecipes, weekCarbCounts, recipeMatchesPlannerSlot } from '../../../lib/recipeQuiz';

// Candidate pool for the planner's day-fill quiz. Mirrors /recipes/quiz's
// pure filtering (meal type, time, novelty, price, carb choice), then enriches
// each match with its per-person nutrient contribution so matches can be
// ranked by how much they lift the day's low nutrients.

export default async function handler(req, res) {
    logAPI(req);
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    if (!(await requireFeature(req, res, decoded, 'weeklyPlanner'))) return;

    await dbConnect();

    try {
        const { plan, day, answers } = req.body;
        if (!plan || !day || !answers) {
            return res.status(400).json({ success: false, message: 'plan, day and answers are required' });
        }

        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const profile = {
            age: user.age,
            gender: user.gender,
            weight_kg: user.weight_kg,
            height_cm: user.height_cm,
            activity_level: user.activity_level,
            daily_exercise_kj: user.daily_exercise_kj
        };
        const targets = calculateDailyIntake(profile);
        const people = plan.defaultServings || 1;
        const nutrientKeys = Object.keys(targets);

        // Day nutrient coverage: what the day already covers / gaps to fill.
        const dayData = await computeDayNutrients({ plan, day, targets, people, numDays: plan.numDays });
        const { coverage, plannedMeals } = dayData;
        const dayCoverage = coverage.map(c => ({
            key: c.key,
            label: NUTRIENT_LABELS[c.key]?.label || c.key,
            unit: NUTRIENT_LABELS[c.key]?.unit || '',
            pct: Math.round(c.pct),
            value: c.value,
            target: c.target
        }));

        const lowKeys = new Set(coverage.filter(c => c.pct < 95).map(c => c.key));

        const deltaFromValues = (values) => {
            const delta = [];
            nutrientKeys.forEach(k => {
                const target = targets[k];
                const amount = values[k] || 0;
                if (!target || target <= 0 || amount <= 0) return;
                delta.push({ key: k, label: NUTRIENT_LABELS[k]?.label || k, pct: (amount / target) * 100 });
            });
            return delta;
        };

        // Load the library and apply the shared quiz filtering. Recipe docs
        // carry every field filterRecipes needs (time, priceCategory,
        // mealTypes, timesCooked, carbType, instructions, prepWork).
        const recipeQuery = decoded.role === 'admin' ? {} : { creator_email: user.email };
        const library = await Recipe.find({ ...recipeQuery, hidden: { $ne: true } }).lean();

        const slot = answers.mealType || null;
        const matches = filterRecipes(library, {
            ...answers,
            mealType: null, // planner slot matching is handled by recipeMatchesPlannerSlot below
            time: answers.time
                ? { min: Math.max(0, Number(answers.time.min) || 0), max: Math.max(0, Number(answers.time.max) || 120) }
                : null
        }).filter(r => recipeMatchesPlannerSlot(r, slot));

        // Keep matches already in the plan out of consideration, so the quiz
        // never re-suggests something the user already placed.
        const planRecipeIds = new Set(
            [...(plan.plannedRecipes || []), ...(plan.everydayItems || [])]
                .map(r => String(r.recipe_id))
                .filter(Boolean)
        );
        const usable = matches.filter(r => !planRecipeIds.has(String(r._id)));

        // Enrich each match with nutrient deltas (per person, per day).
        const candidates = [];
        for (const recipe of usable.slice(0, 60)) {
            const data = await computeRecipeNutrientTotals(recipe._id, plan.defaultServings || 1, nutrientKeys);
            if (!data) continue;
            const perPerson = {};
            nutrientKeys.forEach(k => perPerson[k] = (data.nutrients[k] || 0) / Math.max(1, people));
            const nutrientDelta = deltaFromValues(perPerson);

            // Impact score: boosts weighted double for the day's low nutrients.
            let impact = 0;
            (nutrientDelta || []).forEach(d => { impact += d.pct * (lowKeys.has(d.key) ? 2 : 1); });

            candidates.push({
                _id: String(recipe._id),
                name: recipe.name,
                image: recipe.image || undefined,
                genre: recipe.genre || undefined,
                time: recipe.time || undefined,
                priceCategory: recipe.priceCategory || undefined,
                mealTypes: recipe.mealTypes || [],
                carbType: recipe.carbType || undefined,
                timesCooked: recipe.timesCooked || 0,
                hidden: !!recipe.hidden,
                servings: recipe.servings || null,
                instructions: recipe.instructions || [],
                prepWork: recipe.prepWork || [],
                created_at: recipe.created_at || null,
                nutrientDelta,
                impact
            });
        }

        return res.status(200).json({
            success: true,
            dayCoverage,
            plannedMeals,
            emptySlots: cookingEmptySlots(plannedMeals),
            dayCoverageText: buildDietaryConstraints(user) || null,
            weekCarbCounts: weekCarbCounts(plan.plannedRecipes || []),
            candidates: candidates.sort((a, b) => b.impact - a.impact)
        });
    } catch (err) {
        console.error('Quiz candidates error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

const PLANNER_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
function cookingEmptySlots(plannedMeals) {
    const filled = new Set((plannedMeals || []).map(p => p.mealType));
    return PLANNER_MEALS.filter(m => !filled.has(m));
}
