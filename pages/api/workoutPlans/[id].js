import dbConnect from '../../../lib/dbConnect';
import WorkoutPlan from '../../../models/WorkoutPlan';
import Exercise from '../../../models/Exercise';
import { verifyToken, requireFeature } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { sanitizePlanItem } from '../../../lib/gym';

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    if (!(await requireFeature(req, res, decoded, 'healthTracker'))) return;
    logAPI(req);

    await dbConnect();
    const userId = decoded.id;
    const { id } = req.query;
    const { method } = req;

    switch (method) {
        case 'GET':
            try {
                const plan = await WorkoutPlan.findOne({ _id: id, user_id: userId }).lean();
                if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
                return res.status(200).json({ success: true, plan });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        case 'PUT': {
            const { name, description, items, is_archived } = req.body || {};
            try {
                const plan = await WorkoutPlan.findOne({ _id: id, user_id: userId });
                if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

                if (name !== undefined) {
                    const cleanName = (name || '').toString().trim();
                    if (!cleanName) return res.status(400).json({ success: false, message: 'Plan name is required' });
                    plan.name = cleanName;
                }
                if (description !== undefined) plan.description = (description || '').toString();
                if (is_archived !== undefined) plan.is_archived = Boolean(is_archived);

                if (items !== undefined) {
                    const rawItems = Array.isArray(items) ? items : [];
                    if (!rawItems.length) return res.status(400).json({ success: false, message: 'Plan needs at least one exercise' });
                    if (rawItems.length > 30) return res.status(400).json({ success: false, message: 'Too many exercises' });

                    const exerciseIds = rawItems.map(i => i.exercise_id).filter(Boolean);
                    const owned = await Exercise.find({ user_id: userId, _id: { $in: exerciseIds } }).select('_id').lean();
                    const ownedSet = new Set(owned.map(e => String(e._id)));
                    if (exerciseIds.some(id => !ownedSet.has(String(id)))) {
                        return res.status(400).json({ success: false, message: 'Unknown exercise in plan' });
                    }

                    const sanitized = [];
                    for (let i = 0; i < rawItems.length; i++) {
                        const item = sanitizePlanItem({ ...rawItems[i], order: i });
                        if (typeof item === 'string') return res.status(400).json({ success: false, message: item });
                        sanitized.push(item);
                    }
                    plan.items = sanitized;
                }

                await plan.save();
                return res.status(200).json({ success: true, plan });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
        }

        case 'DELETE':
            try {
                const plan = await WorkoutPlan.findOneAndDelete({ _id: id, user_id: userId });
                if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
                return res.status(200).json({ success: true });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        default:
            res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
