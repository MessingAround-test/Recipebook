import dbConnect from '../../lib/dbConnect';
import SidePairing from '../../models/SidePairing';
import { verifyToken } from '../../lib/auth';
import { logAPI } from '../../lib/logger';

/** Per-pairing side-dish feedback. GET ?mainRecipeId= (or ?sideRecipeId=): the
 *  user's pairing records for ranking the pick sheet. POST: upsert — the cook
 *  marked a side used with a main and reported whether it went well. */
export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();

    try {
        if (req.method === 'GET') {
            const query = { userId: decoded.id };
            if (req.query.mainRecipeId) query.mainRecipeId = req.query.mainRecipeId;
            if (req.query.sideRecipeId) query.sideRecipeId = req.query.sideRecipeId;
            const data = await SidePairing.find(query)
                .sort({ updatedAt: -1 })
                .limit(50)
                .lean();
            return res.status(200).json({ success: true, data });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const mainId = typeof body.mainRecipeId === 'string' ? body.mainRecipeId.trim() : '';
            const sideId = typeof body.sideRecipeId === 'string' ? body.sideRecipeId.trim() : '';
            if (!mainId || !sideId) {
                return res.status(400).json({ success: false, message: 'Missing mainRecipeId or sideRecipeId' });
            }
            if (mainId === sideId) {
                return res.status(400).json({ success: false, message: 'A dish cannot be its own side' });
            }

            const liked = body.liked !== false;
            const note = typeof body.note === 'string' ? body.note.trim() : '';

            const existing = await SidePairing.findOne({
                userId: decoded.id, mainRecipeId: mainId, sideRecipeId: sideId
            });
            if (existing) {
                if (liked === existing.liked) existing.timesUsed = (existing.timesUsed || 1) + 1;
                else existing.timesUsed = (existing.timesUsed || 1) + 1;
                existing.liked = liked;
                if (note) existing.note = note;
                await existing.save();
                return res.status(200).json({ success: true, data: existing });
            }
            const created = await SidePairing.create({
                userId: decoded.id, mainRecipeId: mainId, sideRecipeId: sideId, liked, note: note || undefined
            });
            return res.status(200).json({ success: true, data: created });
        }

        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('sidePairings error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal error' });
    }
}
