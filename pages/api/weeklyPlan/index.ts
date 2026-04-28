import dbConnect from '../../../lib/dbConnect';
import WeeklyPlan from '../../../models/WeeklyPlan';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';

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
                if (!plan) {
                    // Create an empty plan for that week if it doesn't exist
                    plan = await WeeklyPlan.create({ user_id: userId, startDate, plannedRecipes: [], everydayItems: [] });
                }
                return res.status(200).json({ success: true, plan });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        case 'POST':
            const { startDate: postStartDate, plannedRecipes, everydayItems, defaultServings } = req.body;
            if (!postStartDate) return res.status(400).json({ success: false, message: "startDate is required" });

            try {
                const plan = await WeeklyPlan.findOneAndUpdate(
                    { user_id: userId, startDate: postStartDate },
                    { plannedRecipes: plannedRecipes || [], everydayItems: everydayItems || [], defaultServings: defaultServings || 2 },
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
