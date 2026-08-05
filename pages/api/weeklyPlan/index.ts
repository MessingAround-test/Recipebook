import dbConnect from '../../../lib/dbConnect';
import WeeklyPlan from '../../../models/WeeklyPlan';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { legacyDayNameToDate } from '../../../lib/dateUtils';

// Migrate legacy plans (created before custom ranges / pantry pool):
// - day values were weekday names on a Monday-start week -> convert to dates
// - everydayItems quantities were PER DAY -> convert to WEEKLY totals
const LEGACY_PLAN_VERSION = 1;
const CURRENT_PLAN_VERSION = 2;

async function migrateLegacyPlan(plan) {
    if (plan.version >= CURRENT_PLAN_VERSION) return plan;

    const startDate = plan.startDate;
    let changed = false;

    if (!plan.numDays) {
        plan.numDays = 7;
        changed = true;
    }

    if (Array.isArray(plan.plannedRecipes)) {
        for (const r of plan.plannedRecipes) {
            if (r.day && r.day !== 'Undecided' && !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) {
                r.day = legacyDayNameToDate(r.day, startDate);
                changed = true;
            }
        }
    }

    if (Array.isArray(plan.everydayItems) && !plan.version) {
        // Legacy everyday items were per-day quantities; convert to weekly totals
        for (const item of plan.everydayItems) {
            item.quantity = (Number(item.quantity) || 0) * 7;
        }
        changed = true;
    }

    if (changed) {
        plan.version = CURRENT_PLAN_VERSION;
        await plan.save();
    }

    return plan;
}

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
                    // Create an empty plan for that range if it doesn't exist
                    plan = await WeeklyPlan.create({ user_id: userId, startDate, numDays: 7, plannedRecipes: [], everydayItems: [] });
                    created = true;
                } else {
                    await migrateLegacyPlan(plan);
                }
                return res.status(200).json({ success: true, created, plan });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        case 'POST':
            const { startDate: postStartDate, plannedRecipes, everydayItems, defaultServings, numDays } = req.body;
            if (!postStartDate) return res.status(400).json({ success: false, message: "startDate is required" });

            try {
                const plan = await WeeklyPlan.findOneAndUpdate(
                    { user_id: userId, startDate: postStartDate },
                    {
                        plannedRecipes: plannedRecipes || [],
                        everydayItems: everydayItems || [],
                        defaultServings: defaultServings || 2,
                        numDays: numDays || 7,
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
