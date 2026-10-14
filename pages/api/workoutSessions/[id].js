import dbConnect from '../../../lib/dbConnect';
import WorkoutSession from '../../../models/WorkoutSession';
import { verifyToken, requireFeature } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { validateSessionDate } from '../../../lib/gym';

/** Hydrate each exercise with sets from the most recent prior completed session. */
async function hydratePreviousSets(userId, session) {
    const out = session.toObject ? session.toObject() : JSON.parse(JSON.stringify(session));
    for (const ex of out.exercises) {
        const prev = await WorkoutSession.findOne({
            user_id: userId,
            status: 'completed',
            _id: { $ne: out._id },
            $or: [
                { date: { $lt: out.date } },
                { date: out.date, started_at: { $lt: out.started_at } }
            ],
            'exercises.exercise_id': ex.exercise_id
        }).sort({ date: -1, started_at: -1 }).lean();

        if (prev) {
            const prevEx = prev.exercises.find(e => String(e.exercise_id) === String(ex.exercise_id));
            ex.previous_sets = prevEx ? prevEx.sets : [];
            ex.previous_date = prev.date;
        } else {
            ex.previous_sets = [];
            ex.previous_date = null;
        }
    }
    return out;
}

function sanitizeSetInput(raw) {
    if (!raw || typeof raw !== 'object') return { error: 'Invalid set' };
    const set_number = Math.floor(Number(raw.set_number));
    if (!set_number || set_number < 1 || set_number > 50) return { error: 'Invalid set number' };

    const num = (v, min, max) => {
        if (v == null || v === '') return null;
        const n = Number(v);
        if (Number.isNaN(n) || n < min || n > max) return NaN;
        return Math.round(n * 100) / 100;
    };

    const actual_reps = num(raw.actual_reps, 1, 500);
    const actual_weight_kg = num(raw.actual_weight_kg, 0, 1000);
    const actual_duration_sec = num(raw.actual_duration_sec, 1, 7200);
    for (const v of [actual_reps, actual_weight_kg, actual_duration_sec]) {
        if (Number.isNaN(v)) return { error: 'Set values out of range' };
    }
    if ((actual_reps == null || actual_reps <= 0) && (actual_duration_sec == null || actual_duration_sec <= 0)) {
        return { error: 'Log reps or a duration' };
    }

    return {
        set: {
            set_number,
            planned_reps: num(raw.planned_reps, 1, 500),
            planned_weight_kg: num(raw.planned_weight_kg, 0, 1000),
            planned_duration_sec: num(raw.planned_duration_sec, 1, 7200),
            actual_reps,
            actual_weight_kg,
            actual_duration_sec,
            is_failure: Boolean(raw.is_failure),
            completed_at: raw.completed_at ? String(raw.completed_at) : new Date().toISOString()
        }
    };
}

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
                const session = await WorkoutSession.findOne({ _id: id, user_id: userId }).lean();
                if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
                const hydrated = await hydratePreviousSets(userId, session);
                return res.status(200).json({ success: true, session: hydrated });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        case 'PUT': {
            const body = req.body || {};
            try {
                const session = await WorkoutSession.findOne({ _id: id, user_id: userId });
                if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

                // History date edit (no action field).
                if (!body.action && body.date !== undefined) {
                    const dateError = validateSessionDate(body.date);
                    if (dateError) return res.status(400).json({ success: false, message: dateError });
                    session.date = body.date;
                    await session.save();
                    return res.status(200).json({ success: true, session });
                }

                if (session.status !== 'active') {
                    return res.status(400).json({ success: false, message: `Session is already ${session.status}` });
                }

                const exercise_index = Math.floor(Number(body.exercise_index));
                const ex = Number.isInteger(exercise_index) ? session.exercises[exercise_index] : null;

                switch (body.action) {
                    case 'logSet': {
                        if (!ex) return res.status(400).json({ success: false, message: 'Invalid exercise index' });
                        const { set, error } = sanitizeSetInput(body.set);
                        if (error) return res.status(400).json({ success: false, message: error });
                        const existing = ex.sets.findIndex(s => s.set_number === set.set_number);
                        if (existing >= 0) ex.sets[existing] = set;
                        else {
                            ex.sets.push(set);
                            ex.sets.sort((a, b) => a.set_number - b.set_number);
                        }
                        await session.save();
                        return res.status(200).json({ success: true, session });
                    }

                    case 'removeSet': {
                        if (!ex) return res.status(400).json({ success: false, message: 'Invalid exercise index' });
                        const setNumber = Math.floor(Number(body.set_number));
                        ex.sets = ex.sets.filter(s => s.set_number !== setNumber);
                        await session.save();
                        return res.status(200).json({ success: true, session });
                    }

                    case 'updateExercise': {
                        if (!ex) return res.status(400).json({ success: false, message: 'Invalid exercise index' });
                        const patch = body.patch || {};
                        const target_sets = Math.floor(Number(patch.target_sets));
                        if (target_sets && target_sets >= 1 && target_sets <= 30) ex.target_sets = target_sets;
                        if (['reps', 'failure', 'timed'].includes(patch.rep_mode)) ex.rep_mode = patch.rep_mode;
                        if (patch.target_reps !== undefined) {
                            const r = patch.target_reps == null || patch.target_reps === '' ? null : Math.floor(Number(patch.target_reps));
                            ex.target_reps = r && r > 0 ? r : null;
                        }
                        if (patch.target_duration_sec !== undefined) {
                            const d = patch.target_duration_sec == null || patch.target_duration_sec === '' ? null : Math.floor(Number(patch.target_duration_sec));
                            ex.target_duration_sec = d && d > 0 ? d : null;
                        }
                        if (patch.target_weight_kg !== undefined) {
                            const w = patch.target_weight_kg == null || patch.target_weight_kg === '' ? null : Math.round(Number(patch.target_weight_kg) * 10) / 10;
                            ex.target_weight_kg = w && w > 0 ? w : null;
                        }
                        await session.save();
                        return res.status(200).json({ success: true, session });
                    }

                    case 'complete': {
                        session.status = 'completed';
                        session.completed_at = new Date();
                        await session.save();
                        return res.status(200).json({ success: true, session });
                    }

                    case 'abandon': {
                        session.status = 'abandoned';
                        session.completed_at = new Date();
                        await session.save();
                        return res.status(200).json({ success: true, session });
                    }

                    default:
                        return res.status(400).json({ success: false, message: 'Unknown action' });
                }
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
        }

        case 'DELETE':
            try {
                const session = await WorkoutSession.findOneAndDelete({ _id: id, user_id: userId });
                if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
                return res.status(200).json({ success: true });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        default:
            res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
