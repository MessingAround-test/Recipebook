import dbConnect from '../../../lib/dbConnect';
import PantryAssumption from '../../../models/PantryAssumption';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { PLANNING_BUCKET_ORDER } from '../../../lib/pantryPlanning';

const VALID_TYPES = ['name', 'category'];
const VALID_MATCHES = ['exact', 'contains'];

export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    await dbConnect();
    const userData = await User.findById(decoded.id);
    if (!userData) return res.status(400).json({ success: false, message: 'user not found, please relog' });
    const isAdmin = userData.role === 'admin';

    // Seed the default rule catalog on first read.
    if (req.method === 'GET') {
        try { await PantryAssumption.seedIfNeeded(); } catch (e) { /* ignore */ }
    }

    try {
        if (req.method === 'GET') {
            const rules = await PantryAssumption.find({})
                .sort({ type: 1, priority: -1, value: 1 })
                .lean();
            return res.status(200).json({ success: true, data: rules });
        }

        if (!isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        const body = req.body || {};

        if (req.method === 'POST') {
            const clean = cleanRule(body);
            if (clean.error) return res.status(400).json({ success: false, message: clean.error });
            const created = await PantryAssumption.create({ ...clean.value, createdBy: userData.email });
            return res.status(200).json({ success: true, data: created });
        }

        if (req.method === 'PUT') {
            const { _id } = body;
            if (!_id) return res.status(400).json({ success: false, message: 'Missing _id' });
            const clean = cleanRule(body, { partial: true });
            if (clean.error) return res.status(400).json({ success: false, message: clean.error });
            if (Object.keys(clean.value).length === 0) {
                return res.status(400).json({ success: false, message: 'Nothing to update' });
            }
            const updated = await PantryAssumption.findByIdAndUpdate(_id, { $set: clean.value }, { new: true });
            if (!updated) return res.status(404).json({ success: false, message: 'Rule not found' });
            return res.status(200).json({ success: true, data: updated });
        }

        if (req.method === 'DELETE') {
            const { _id } = body;
            if (!_id) return res.status(400).json({ success: false, message: 'Missing _id' });
            const target = await PantryAssumption.findById(_id);
            if (!target) return res.status(404).json({ success: false, message: 'Rule not found' });
            if (target.isSystem) {
                target.active = false;
                await target.save();
                return res.status(200).json({ success: true, data: target, message: 'Rule deactivated' });
            }
            await target.deleteOne();
            return res.status(200).json({ success: true, message: 'Rule deleted' });
        }
    } catch (error) {
        console.error('PantryAssumptions error:', error);
        const dup = error && error.code === 11000;
        return res.status(dup ? 409 : 500).json({
            success: false,
            message: dup ? 'A rule for that value already exists' : (error.message || 'Internal error'),
        });
    }
}

function cleanText(v) {
    return typeof v === 'string' ? v.trim() : '';
}

/** Validates and normalises a rule payload. `partial` allows PUT-style updates. */
function cleanRule(body, { partial = false } = {}) {
    const out = {};
    let any = false;

    if (!partial || body.type !== undefined) {
        const type = cleanText(body.type);
        if (!VALID_TYPES.includes(type)) return { error: 'type must be "name" or "category"' };
        out.type = type;
        any = true;
    }

    if (!partial || body.value !== undefined) {
        const value = cleanText(body.value);
        if (!value) return { error: 'value is required' };
        out.value = value;
        any = true;
    }

    if (!partial || body.bucket !== undefined) {
        const bucket = cleanText(body.bucket);
        if (!PLANNING_BUCKET_ORDER.includes(bucket)) {
            return { error: `bucket must be one of: ${PLANNING_BUCKET_ORDER.join(', ')}` };
        }
        out.bucket = bucket;
        any = true;
    }

    if (!partial || body.match !== undefined) {
        const match = cleanText(body.match) || 'contains';
        if (!VALID_MATCHES.includes(match)) return { error: 'match must be "exact" or "contains"' };
        out.match = match;
    }

    if (!partial || body.exclude !== undefined) {
        const exclude = Array.isArray(body.exclude)
            ? body.exclude.map(cleanText).filter(Boolean)
            : cleanText(body.exclude).split(',').map(s => s.trim()).filter(Boolean);
        out.exclude = exclude;
    }

    if (body.priority !== undefined) {
        const n = Number(body.priority);
        out.priority = Number.isFinite(n) ? n : 50;
    } else if (!partial) {
        out.priority = 50;
    }

    if (body.active !== undefined) out.active = !!body.active;

    if (!any && !partial) return { error: 'type, value and bucket are required' };
    return { value: out };
}
