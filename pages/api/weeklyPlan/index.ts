import dbConnect from '../../../lib/dbConnect';
import WeeklyPlan from '../../../models/WeeklyPlan';
import '../../../models/Recipe';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { CURRENT_PLAN_VERSION } from '../../../lib/planVersion';

// Old-version plans are intentionally NOT migrated. Any plan whose stored
// version differs from CURRENT_PLAN_VERSION is treated as stale: its data is
// discarded and a fresh empty plan is returned. Bump CURRENT_PLAN_VERSION to
// wipe all previously saved plan data.

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    logAPI(req);

    await dbConnect();

    const { method } = req;
    const userId = decoded.id;

    switch (method) {
        case 'GET':
            const { startDate } = req.query;
            if (!startDate) return res.status(400).json({ success: false, message: "startDate is required" });

            try {
                let plan = await WeeklyPlan.findOne({ user_id: userId, startDate }).populate('plannedRecipes.recipe_id', 'name image tags');
                let created = false;

                if (!plan) {
                    // Fall back to any current-version plan whose range covers the requested date
                    const target = new Date(`${startDate}T00:00:00`);
                    const ranges = await WeeklyPlan.find({ user_id: userId, version: CURRENT_PLAN_VERSION }).select('_id startDate numDays').lean() as Array<{ _id: string; startDate: string; numDays?: number }>;
                    const covering = ranges
                        .map(p => ({ ...p, days: p.numDays || 7 }))
                        .filter(p => {
                            const s = new Date(`${p.startDate}T00:00:00`);
                            const diff = Math.round((target.getTime() - s.getTime()) / 86400000);
                            return diff >= 0 && diff < p.days;
                        })
                        .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0];

                    if (covering) {
                        plan = await WeeklyPlan.findById(covering._id).populate('plannedRecipes.recipe_id', 'name image tags');
                    } else {
                        // Create an empty plan for that range if it doesn't exist
                        plan = await WeeklyPlan.create({ user_id: userId, startDate, numDays: 7, version: CURRENT_PLAN_VERSION, plannedRecipes: [], everydayItems: [] });
                        created = true;
                    }
                }

                if (!created && plan.version !== CURRENT_PLAN_VERSION) {
                    // Stale plan (old data shape): discard it and start fresh
                    plan = await WeeklyPlan.findOneAndUpdate(
                        { user_id: userId, startDate: plan.startDate },
                        { plannedRecipes: [], everydayItems: [], numDays: 7, pantryPlacements: {}, version: CURRENT_PLAN_VERSION },
                        { new: true }
                    ).populate('plannedRecipes.recipe_id', 'name image tags');
                    created = true;
                }

                return res.status(200).json({ success: true, created, plan });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        case 'POST':
            const { startDate: postStartDate, plannedRecipes, everydayItems, defaultServings, numDays, pantryPlacements } = req.body;
            if (!postStartDate) return res.status(400).json({ success: false, message: "startDate is required" });

            try {
                const plan = await WeeklyPlan.findOneAndUpdate(
                    { user_id: userId, startDate: postStartDate },
                    {
                        plannedRecipes: plannedRecipes || [],
                        everydayItems: everydayItems || [],
                        defaultServings: defaultServings || 2,
                        numDays: numDays || 7,
                        pantryPlacements: pantryPlacements || {},
                        version: CURRENT_PLAN_VERSION
                    },
                    { upsert: true, new: true }
                ).populate('plannedRecipes.recipe_id', 'name image tags');

                return res.status(200).json({ success: true, plan });
            } catch (err) {
                console.error("Error updating WeeklyPlan:", err);
                return res.status(500).json({ success: false, message: err.message });
            }

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
