import dbConnect from '../../lib/dbConnect';
import User from '../../models/User';
import { verifyToken } from '../../lib/auth';
import { logAPI } from '../../lib/logger';
import { calculateDailyIntake } from '../../lib/dailyIntake';
import { mergeHealthScoreConfig, sanitizeHealthScoreConfig } from '../../lib/healthScore';

export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        await dbConnect();

        if (req.method === 'GET') {
            const user = await User.findById(decoded.id).select(
                'age gender weight_kg height_cm activity_level daily_exercise_kj target_weight_kg weekly_goal_kg health_score_config'
            );
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const profile = {
                age: user.age,
                gender: user.gender,
                weight_kg: user.weight_kg,
                height_cm: user.height_cm,
                activity_level: user.activity_level,
                daily_exercise_kj: user.daily_exercise_kj,
                target_weight_kg: user.target_weight_kg,
                weekly_goal_kg: user.weekly_goal_kg,
            };

            const targets = calculateDailyIntake(profile);
            const healthScoreConfig = mergeHealthScoreConfig(user.health_score_config);
            return res.status(200).json({ success: true, targets, profile, healthScoreConfig });

        } else if (req.method === 'PUT') {
            const { healthScoreConfig } = req.body || {};
            if (healthScoreConfig === undefined) {
                return res.status(400).json({ success: false, message: 'healthScoreConfig is required' });
            }

            const sanitized = sanitizeHealthScoreConfig(healthScoreConfig);
            const user = await User.findByIdAndUpdate(
                decoded.id,
                { $set: { health_score_config: sanitized } },
                { new: true }
            ).select('health_score_config');
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            console.log(`User ${decoded.id} updated health score config with:`, sanitized);
            return res.status(200).json({ success: true, healthScoreConfig: mergeHealthScoreConfig(user.health_score_config) });

        } else {
            return res.status(405).json({ success: false, message: 'Method Not Allowed' });
        }
    } catch (error) {
        console.error('Error in dailyIntake API:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}
