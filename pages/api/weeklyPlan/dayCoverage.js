import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { calculateDailyIntake, NUTRIENT_LABELS } from '../../../lib/dailyIntake';
import { computeDayNutrients } from '../../../lib/planNutrition';

// Estimated nutrient coverage for a single day of the plan, based purely on
// what's already planned (no AI recommendations). Mirrors the coverage panel
// used by the planner's day-fill popup, without the "what to add" suggestions.

export default async function handler(req, res) {
    logAPI(req);
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();

    try {
        const { plan, day } = req.body;
        if (!plan || !day) {
            return res.status(400).json({ success: false, message: 'plan and day are required' });
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

        const dayData = await computeDayNutrients({ plan, day, targets, people, numDays: plan.numDays });
        const { coverage, plannedMeals } = dayData;

        return res.status(200).json({
            success: true,
            dayCoverage: coverage.map(c => ({
                key: c.key,
                label: NUTRIENT_LABELS[c.key]?.label || c.key,
                unit: NUTRIENT_LABELS[c.key]?.unit || '',
                pct: Math.round(c.pct),
                value: c.value,
                target: c.target
            })),
            plannedMeals
        });
    } catch (err) {
        console.error('Day coverage error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
