import dbConnect from '../../../lib/dbConnect';
import WeeklyPlan from '../../../models/WeeklyPlan';
import { verifyToken, requireFeature } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { CURRENT_PLAN_VERSION } from '../../../lib/planVersion';

// Lists prior weeks (before the given startDate) that carry a per-meal
// servings coverage pattern, so the planner can offer to reuse the timing
// ("who's eating which meal") from a previous week. Never returns meals or
// pantry data — only the coverage-shaped docs' range info + pattern.

const LIMIT = 12;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    if (!(await requireFeature(req, res, decoded, 'weeklyPlanner'))) return;
    logAPI(req);

    await dbConnect();

    try {
        const { before } = req.query;
        if (!before) return res.status(400).json({ success: false, message: 'before (startDate) is required' });

        const docs = await WeeklyPlan.find({
            user_id: decoded.id,
            version: CURRENT_PLAN_VERSION,
            startDate: { $lt: String(before) }
        })
            .select('startDate numDays mealCoverage')
            .sort({ startDate: -1 })
            .limit(LIMIT)
            .lean();

        const weeks = (docs || [])
            .filter(d => {
                const c = d.mealCoverage;
                return c && typeof c === 'object' && Object.keys(c).length > 0;
            })
            .map(d => ({
                startDate: d.startDate,
                numDays: d.numDays || 7,
                mealCoverage: d.mealCoverage
            }));

        return res.status(200).json({ success: true, weeks });
    } catch (err) {
        console.error('Coverage history error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
