import mongoose from 'mongoose';
import dbConnect from '../../../lib/dbConnect';
import WorkoutPlan from '../../../models/WorkoutPlan';
import Exercise from '../../../models/Exercise';
import WorkoutSession from '../../../models/WorkoutSession';
import { verifyToken, requireFeature } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { sanitizePlanItem, STARTER_EXERCISES, STARTER_PLANS } from '../../../lib/gym';

/** Create the per-user exercise catalog + Push/Pull/Legs plans. Idempotent per user. */
async function seedStarterData(userId) {
    const created = await Exercise.insertMany(
        STARTER_EXERCISES.map(e => ({ user_id: userId, name: e.name, muscle_group: e.muscle_group, is_custom: false }))
    );
    const byName = {};
    created.forEach(e => { byName[e.name] = e._id; });

    const plans = STARTER_PLANS.map(p => ({
        user_id: userId,
        name: p.name,
        description: p.description,
        items: p.items.map((item, idx) => ({
            exercise_id: byName[item.exerciseName],
            order: idx,
            target_sets: item.target_sets,
            rep_mode: item.rep_mode,
            target_reps: item.target_reps,
            target_duration_sec: item.target_duration_sec,
            target_weight_kg: item.target_weight_kg
        }))
    }));
    await WorkoutPlan.insertMany(plans);
}

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    if (!(await requireFeature(req, res, decoded, 'healthTracker'))) return;
    logAPI(req);

    await dbConnect();
    const userId = decoded.id;
    const { method } = req;

    switch (method) {
        case 'GET':
            try {
                // First visit: seed this user's starter catalog + plans.
                const [exerciseCount, planCount] = await Promise.all([
                    Exercise.countDocuments({ user_id: userId }),
                    WorkoutPlan.countDocuments({ user_id: userId })
                ]);
                if (exerciseCount === 0 && planCount === 0) {
                    await seedStarterData(userId);
                }

                const [plans, lastPerformedAgg] = await Promise.all([
                    WorkoutPlan.find({ user_id: userId, is_archived: { $ne: true } }).sort({ name: 1 }).lean(),
                    WorkoutSession.aggregate([
                        { $match: { user_id: new mongoose.Types.ObjectId(String(userId)), status: 'completed', plan_id: { $ne: null } } },
                        { $sort: { date: -1, started_at: -1 } },
                        { $group: { _id: '$plan_id', last_date: { $first: '$date' } } }
                    ]).catch(() => [])
                ]);
                return res.status(200).json({ success: true, plans, lastPerformed: lastPerformedAgg });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        case 'POST': {
            const { name, description, items } = req.body || {};
            const cleanName = (name || '').toString().trim();
            if (!cleanName) return res.status(400).json({ success: false, message: 'Plan name is required' });

            const rawItems = Array.isArray(items) ? items : [];
            if (!rawItems.length) return res.status(400).json({ success: false, message: 'Plan needs at least one exercise' });
            if (rawItems.length > 30) return res.status(400).json({ success: false, message: 'Too many exercises' });

            try {
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

                const plan = await WorkoutPlan.create({
                    user_id: userId,
                    name: cleanName,
                    description: (description || '').toString(),
                    items: sanitized
                });
                return res.status(200).json({ success: true, plan });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
        }

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
