import dbConnect from '../../../lib/dbConnect';
import DailyLog from '../../../models/DailyLog';
import IngredientConversion from '../../../models/IngredientConversion';
import User from '../../../models/User';
import { verifyToken } from "../../../lib/auth.ts";
import { calculateDailyIntake } from '../../../lib/dailyIntake.ts';

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();
    const userId = decoded.id;

    try {
        // 1. Get user profile and calculate targets
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        
        // Prepare profile for calculator
        const profile = {
            age: user.age,
            gender: user.gender,
            weight_kg: user.weight,
            height_cm: user.height,
            activity_level: user.activity_level,
            daily_exercise_kj: user.daily_exercise_kj
        };
        const targets = calculateDailyIntake(profile);

        // 2. Fetch logs for the last 7 days
        const now = new Date();
        const logs = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const log = await DailyLog.findOne({ user_id: userId, date: dateStr });
            if (log) logs.push(log);
        }

        // 3. Aggregate intake
        const weeklyTotals = {};
        const nutrientKeys = Object.keys(targets);
        nutrientKeys.forEach(k => weeklyTotals[k] = 0);

        logs.forEach(log => {
            log.items.forEach(item => {
                nutrientKeys.forEach(k => {
                    weeklyTotals[k] += (item.nutrients[k] || 0);
                });
            });
        });

        // 4. Find the most deficient nutrient (lowest % of weekly target)
        let mostDeficient = null;
        let lowestPct = Infinity;

        nutrientKeys.forEach(k => {
            if (k === 'energy_kcal') return; // Skip energy for primary recommendation
            const weeklyTarget = targets[k] * 7;
            if (weeklyTarget <= 0) return;
            const pct = weeklyTotals[k] / weeklyTarget;
            if (pct < lowestPct) {
                lowestPct = pct;
                mostDeficient = k;
            }
        });

        if (!mostDeficient || lowestPct >= 0.95) {
            return res.status(200).json({ 
                success: true, 
                message: "You are meeting almost all your targets! Great job.", 
                recommendations: [] 
            });
        }

        // 5. Query ingredients high in the deficient nutrient
        const recommendations = await IngredientConversion.find({
            [mostDeficient]: { $gt: 0 }
        })
        .sort({ [mostDeficient]: -1 })
        .limit(5);

        return res.status(200).json({
            success: true,
            deficientNutrient: mostDeficient,
            currentWeeklyPct: Math.round(lowestPct * 100),
            recommendations: recommendations.map(r => ({
                name: r.ingredient_name,
                value: r[mostDeficient],
                grams_per_each: r.grams_per_each
            }))
        });

    } catch (err) {
        console.error("Recommendations Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
