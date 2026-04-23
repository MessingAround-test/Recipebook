import dbConnect from '../../lib/dbConnect';
import User from '../../models/User';
import { verifyToken } from '../../lib/auth';
import { logAPI } from '../../lib/logger';
import { calculateDailyIntake } from '../../lib/dailyIntake';

export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        await dbConnect();

        if (req.method === 'GET') {
            const user = await User.findById(decoded.id).select(
                'age gender weight_kg height_cm activity_level daily_exercise_kj'
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
            };

            const targets = calculateDailyIntake(profile);
            return res.status(200).json({ success: true, targets, profile });

        } else {
            return res.status(405).json({ success: false, message: 'Method Not Allowed' });
        }
    } catch (error) {
        console.error('Error in dailyIntake API:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}
