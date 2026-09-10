import dbConnect from '../../lib/dbConnect';
import User from '../../models/User';
import { verifyToken } from '../../lib/auth';
import { logAPI } from '../../lib/logger';
import CarbType from '../../models/CarbType';
import { findCarbType, resolveVariant } from '../../lib/carbSideOps';

/** User carb choices history. GET: last-used carb list. POST: records a
 *  choice made at Start Cooking (a choice is intent even if the cook quits
 *  before finishing). */
export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();
    const userData = await User.findById(decoded.id);
    if (!userData) return res.status(400).json({ success: false, message: 'user not found, please relog' });

    try {
        if (req.method === 'GET') {
            const history = (userData.carbHistory || []).slice(0, 20);
            return res.status(200).json({ success: true, data: history });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const typeName = typeof body.type === 'string' ? body.type.trim() : '';
            if (!typeName) return res.status(400).json({ success: false, message: 'Missing type' });

            const catalog = await CarbType.find({ active: { $ne: false } }).sort({ order: 1 }).lean();
            const carbType = findCarbType(catalog, typeName);
            const resolvedType = carbType?.name || typeName;
            const variant = resolveVariant(carbType, body.variant);

            const history = [
                { type: resolvedType, variant, at: new Date() },
                ...(userData.carbHistory || []).filter(h => !(h.type === resolvedType && h.variant === variant) && !(h.type === resolvedType && !variant)).slice(0, 19)
            ];
            userData.carbHistory = history;
            await userData.save();
            return res.status(200).json({ success: true, data: history });
        }

        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('carbChoice error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal error' });
    }
}
