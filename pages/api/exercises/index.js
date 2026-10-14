import dbConnect from '../../../lib/dbConnect';
import Exercise from '../../../models/Exercise';
import { verifyToken, requireFeature } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';

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
                const exercises = await Exercise.find({ user_id: userId }).sort({ name: 1 }).lean();
                return res.status(200).json({ success: true, exercises });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        case 'POST': {
            const { name, muscle_group } = req.body || {};
            const cleanName = (name || '').toString().trim();
            if (!cleanName) return res.status(400).json({ success: false, message: 'Name is required' });
            if (cleanName.length > 80) return res.status(400).json({ success: false, message: 'Name too long' });

            try {
                const exercise = await Exercise.create({
                    user_id: userId,
                    name: cleanName,
                    muscle_group: (muscle_group || 'other').toString().trim().toLowerCase() || 'other',
                    is_custom: true
                });
                return res.status(200).json({ success: true, exercise });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
        }

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
