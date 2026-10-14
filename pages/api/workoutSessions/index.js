import mongoose from 'mongoose';
import dbConnect from '../../../lib/dbConnect';
import WorkoutSession from '../../../models/WorkoutSession';
import WorkoutPlan from '../../../models/WorkoutPlan';
import Exercise from '../../../models/Exercise';
import { verifyToken, requireFeature } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { validateSessionDate, todayLocalISO } from '../../../lib/gym';

function isValidObjectId(v) {
    return mongoose.Types.ObjectId.isValid(String(v));
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
        case 'GET': {
            const { exerciseId, status, limit } = req.query;
            try {
                const filter = { user_id: userId };
                if (status && ['active', 'completed', 'abandoned'].includes(status)) filter.status = status;
                if (exerciseId) {
                    if (!isValidObjectId(exerciseId)) return res.status(400).json({ success: false, message: 'Invalid exercise id' });
                    filter['exercises.exercise_id'] = exerciseId;
                }
                const cap = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
                const sessions = await WorkoutSession.find(filter)
                    .sort({ date: -1, started_at: -1 })
                    .limit(cap)
                    .lean();
                return res.status(200).json({ success: true, sessions });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
        }

        case 'POST': {
            const { plan_id, exercise_ids, date } = req.body || {};

            const sessionDate = date || todayLocalISO();
            const dateError = validateSessionDate(sessionDate);
            if (dateError) return res.status(400).json({ success: false, message: dateError });

            try {
                let exercises = [];
                let planDoc = null;
                let planName = '';
                let planIdOut = null;

                if (plan_id) {
                    if (!isValidObjectId(plan_id)) return res.status(400).json({ success: false, message: 'Invalid plan id' });
                    planDoc = await WorkoutPlan.findOne({ _id: plan_id, user_id: userId }).lean();
                    if (!planDoc) return res.status(404).json({ success: false, message: 'Plan not found' });
                    planName = planDoc.name;
                    planIdOut = planDoc._id;

                    const ids = planDoc.items.map(i => i.exercise_id);
                    const exDocs = await Exercise.find({ user_id: userId, _id: { $in: ids } }).lean();
                    const byId = {};
                    exDocs.forEach(e => { byId[String(e._id)] = e; });

                    exercises = planDoc.items.map((item, idx) => ({
                        exercise_id: item.exercise_id,
                        name_snapshot: byId[String(item.exercise_id)]?.name || 'Exercise',
                        muscle_group: byId[String(item.exercise_id)]?.muscle_group || '',
                        order: idx,
                        target_sets: item.target_sets,
                        rep_mode: item.rep_mode,
                        target_reps: item.target_reps,
                        target_duration_sec: item.target_duration_sec,
                        target_weight_kg: item.target_weight_kg,
                        sets: []
                    }));
                } else if (Array.isArray(exercise_ids) && exercise_ids.length) {
                    if (exercise_ids.length > 20) return res.status(400).json({ success: false, message: 'Too many exercises (max 20)' });
                    if (exercise_ids.some(id => !isValidObjectId(id))) return res.status(400).json({ success: false, message: 'Invalid exercise id' });
                    const exDocs = await Exercise.find({ user_id: userId, _id: { $in: exercise_ids } }).lean();
                    if (exDocs.length !== exercise_ids.length) return res.status(400).json({ success: false, message: 'Unknown exercise in selection' });
                    const byId = {};
                    exDocs.forEach(e => { byId[String(e._id)] = e; });

                    // Quick start defaults: 3 sets to failure, adjustable in-session.
                    exercises = exercise_ids.map((id, idx) => ({
                        exercise_id: id,
                        name_snapshot: byId[String(id)].name,
                        muscle_group: byId[String(id)].muscle_group || '',
                        order: idx,
                        target_sets: 3,
                        rep_mode: 'failure',
                        target_reps: null,
                        target_duration_sec: null,
                        target_weight_kg: null,
                        sets: []
                    }));
                } else {
                    return res.status(400).json({ success: false, message: 'Start a plan or pick exercises' });
                }

                const session = await WorkoutSession.create({
                    user_id: userId,
                    plan_id: planIdOut,
                    plan_name_snapshot: planName,
                    date: sessionDate,
                    status: 'active',
                    started_at: new Date(),
                    exercises
                });
                return res.status(200).json({ success: true, session });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
        }

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
