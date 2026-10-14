import mongoose from 'mongoose';
import dbConnect from '../../../lib/dbConnect';
import WorkoutSession from '../../../models/WorkoutSession';
import Exercise from '../../../models/Exercise';
import { verifyToken, requireFeature } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { estimateE1RM, setVolume } from '../../../lib/gym';

/**
 * GET ?exerciseId=... — per-date progression points for one exercise plus PRs.
 * Only completed sessions count. All maths is done here (same helpers as client).
 */
export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    if (!(await requireFeature(req, res, decoded, 'healthTracker'))) return;
    logAPI(req);

    await dbConnect();
    const userId = decoded.id;
    const { method } = req;

    if (method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }

    const { exerciseId } = req.query;
    if (!exerciseId || !mongoose.Types.ObjectId.isValid(String(exerciseId))) {
        return res.status(400).json({ success: false, message: 'exerciseId is required' });
    }

    try {
        const exercise = await Exercise.findOne({ _id: exerciseId, user_id: userId }).lean();
        if (!exercise) return res.status(404).json({ success: false, message: 'Exercise not found' });

        const sessions = await WorkoutSession.find({
            user_id: userId,
            status: 'completed',
            'exercises.exercise_id': exerciseId
        }).sort({ date: 1, started_at: 1 }).lean();

        const points = [];
        let prs = { top_weight_kg: 0, best_e1rm: 0, top_duration_sec: 0, best_date: null, e1rm_date: null, duration_date: null };

        for (const session of sessions) {
            const ex = session.exercises.find(e => String(e.exercise_id) === String(exerciseId));
            if (!ex || !ex.sets || !ex.sets.length) continue;

            const done = ex.sets.filter(s => s.actual_reps || s.actual_duration_sec);
            if (!done.length) continue;

            const topW = Math.max(0, ...done.map(s => Number(s.actual_weight_kg) || 0));
            const vol = Math.round(done.reduce((sum, s) => sum + setVolume(s.actual_weight_kg, s.actual_reps), 0));
            const e1rm = Math.max(0, ...done.map(s => estimateE1RM(Number(s.actual_weight_kg) || 0, Number(s.actual_reps) || 0)));
            const topD = Math.max(0, ...done.map(s => Number(s.actual_duration_sec) || 0));
            const totalD = done.reduce((sum, s) => sum + (Number(s.actual_duration_sec) || 0), 0);
            const totalReps = done.reduce((sum, s) => sum + (Number(s.actual_reps) || 0), 0);

            points.push({
                session_id: session._id,
                date: session.date,
                sets: done.length,
                top_weight_kg: topW,
                volume_kg: vol,
                best_e1rm: e1rm,
                top_duration_sec: topD,
                total_duration_sec: totalD,
                total_reps: totalReps,
            });

            if (topW > prs.top_weight_kg) { prs.top_weight_kg = topW; prs.best_date = session.date; }
            if (e1rm > prs.best_e1rm) { prs.best_e1rm = e1rm; prs.e1rm_date = session.date; }
            if (topD > prs.top_duration_sec) { prs.top_duration_sec = topD; prs.duration_date = session.date; }
        }

        return res.status(200).json({ success: true, exercise, points, prs, totalSessions: points.length });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}
