import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import DailyLog from '../../../models/DailyLog';
import SymptomLog from '../../../models/SymptomLog';
import SymptomClassification from '../../../models/SymptomClassification';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { calculateDailyIntake } from '../../../lib/dailyIntake';
import { computeCorrelations } from '../../../lib/correlation';
import { mergeHealthScoreConfig } from '../../../lib/healthScore';

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

function getCacheKey(userId, isAll, startDate, endDate, scoreConfigSignature) {
    return `${userId}|${isAll}|${startDate}|${endDate}|${scoreConfigSignature}`;
}

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    logAPI(req);

    await dbConnect();

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { startDate, endDate, all } = req.query;
    const isAll = all === 'true' || all === '1';
    if (!isAll && (!startDate || !endDate)) {
        return res.status(400).json({ success: false, message: "startDate and endDate are required" });
    }

    try {
        const userId = decoded.id;

        const user = await User.findById(userId).select(
            'age gender weight_kg height_cm activity_level daily_exercise_kj health_score_config'
        );
        const profile = {
            age: user?.age,
            gender: user?.gender,
            weight_kg: user?.weight_kg,
            height_cm: user?.height_cm,
            activity_level: user?.activity_level,
            daily_exercise_kj: user?.daily_exercise_kj,
        };
        const targets = calculateDailyIntake(profile);
        const scoreConfig = mergeHealthScoreConfig(user?.health_score_config);

        const dateFilter = isAll
            ? { user_id: userId }
            : { user_id: userId, date: { $gte: startDate, $lte: endDate } };

        const cacheKey = getCacheKey(userId, isAll, startDate, endDate, JSON.stringify(scoreConfig));
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
            return res.status(200).json({ success: true, ...hit.payload });
        }

        const [dailyLogs, symptomLogs, classifications] = await Promise.all([
            DailyLog.find(dateFilter).select('date items exercise_kcal').lean(),
            SymptomLog.find(dateFilter).select('date symptoms mood').lean(),
            SymptomClassification.find().select('name category').lean(),
        ]);

        const result = computeCorrelations(dailyLogs, symptomLogs, targets, classifications, { scoreConfig });

        const payload = { meta: result.meta, symptoms: result.symptoms };
        cache.set(cacheKey, { ts: Date.now(), payload });
        if (cache.size > 500) cache.clear();

        return res.status(200).json({ success: true, ...payload });
    } catch (err) {
        console.error("Error computing correlations:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
