import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User';
import DailyLog from '../../../models/DailyLog';
import SymptomLog from '../../../models/SymptomLog';
import SymptomClassification from '../../../models/SymptomClassification';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { calculateDailyIntake } from '../../../lib/dailyIntake';
import { calculateHealthScore, mergeHealthScoreConfig } from '../../../lib/healthScore';

function getLocalDateString(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
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
        const healthScoreConfig = mergeHealthScoreConfig(user?.health_score_config);

        const dailyLogs = await DailyLog.find({
            user_id: userId,
            date: { $gte: startDate, $lte: endDate }
        }).select('date items').lean();

        const symptomLogs = await SymptomLog.find({
            user_id: userId,
            date: { $gte: startDate, $lte: endDate }
        }).select('date symptoms').lean();

        const classifications = await SymptomClassification.find().select('name category').lean();
        const categoryMap = new Map(classifications.map(c => [c.name, c.category]));

        const logsByDate = dailyLogs.reduce((acc, log) => {
            acc[log.date] = log;
            return acc;
        }, {});

        const symptomsByDate = symptomLogs.reduce((acc, log) => {
            acc[log.date] = log;
            return acc;
        }, {});

        const days = [];
        const iter = new Date(startDate);
        const end = new Date(endDate);
        while (iter <= end) {
            const dStr = getLocalDateString(iter);
            const log = logsByDate[dStr];
            const totals = {};
            if (log && log.items) {
                log.items.forEach(item => {
                    Object.keys(item.nutrients || {}).forEach(k => {
                        totals[k] = (totals[k] || 0) + (item.nutrients[k] || 0);
                    });
                });
            }
            const score = calculateHealthScore(totals, targets, healthScoreConfig);

            const counts = { positive: 0, negative: 0, neutral: 0, none: 0 };
            const symptomLog = symptomsByDate[dStr];
            if (symptomLog && symptomLog.symptoms) {
                const seen = new Set();
                symptomLog.symptoms.forEach(s => {
                    const name = String(s.name || '').toLowerCase().trim();
                    if (!name || seen.has(name)) return;
                    seen.add(name);
                    const category = categoryMap.get(name) || 'none';
                    counts[category] = (counts[category] || 0) + 1;
                });
            }

            days.push({
                date: dStr,
                score,
                positive: counts.positive,
                negative: counts.negative,
                neutral: counts.neutral,
                none: counts.none
            });

            iter.setDate(iter.getDate() + 1);
        }

        return res.status(200).json({
            success: true,
            days,
            categories: {
                positive: 'positive',
                negative: 'negative',
                neutral: 'neutral',
                none: 'none'
            }
        });
    } catch (err) {
        console.error("Error fetching trends:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
