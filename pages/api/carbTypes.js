import dbConnect from '../../lib/dbConnect';
import CarbType from '../../models/CarbType';
import User from '../../models/User';
import { verifyToken } from '../../lib/auth';
import { logAPI } from '../../lib/logger';

export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    await dbConnect();
    const userData = await User.findById(decoded.id);
    if (!userData) return res.status(400).json({ success: false, message: 'user not found, please relog' });
    const isAdmin = userData.role === 'admin';
    // Seed the default catalog on first ever read
    if (req.method === 'GET') await CarbType.seedIfNeeded();

    try {
        if (req.method === 'GET') {
            const carbs = await CarbType.find({ active: { $ne: false } }).sort({ order: 1, name: 1 }).lean();
            return res.status(200).json({ success: true, data: carbs });
        }

        if (!isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        const body = req.body || {};
        const cleanText = (v) => typeof v === 'string' ? v.trim() : '';

        if (req.method === 'POST') {
            const name = cleanText(body.name);
            if (!name) return res.status(400).json({ success: false, message: 'Missing name' });
            const timing = body.timing && !body.variants && !body.phases
                ? {
                    cookMinutes: clampOrNothing(body.timing.cookMinutes),
                    prepMinutes: clampOrNothing(body.timing.prepMinutes)
                }
                : undefined;
            const phases = !body.variants && !timing
                ? cleanPhases(body.phases)
                : undefined;
            const variants = Array.isArray(body.variants) && body.variants.length > 0
                ? body.variants.map(v => ({
                    name: cleanText(v.name),
                    cookMinutes: clampOrNothing(v.cookMinutes),
                    prepMinutes: clampOrNothing(v.prepMinutes),
                    ...(cleanPerServe(v.perServe) ? { perServe: v.perServe } : {}),
                    ...(Array.isArray(v.phases) && v.phases.length > 0 ? { phases: cleanPhases(v.phases) } : {})
                })).filter(v => v.name)
                : undefined;
            if (!timing && (!variants || variants.length === 0) && (!phases || phases.length === 0)) {
                return res.status(400).json({ success: false, message: 'Provide a cook time, phases or variants' });
            }
            const created = await CarbType.create({
                name,
                aliases: Array.isArray(body.aliases) ? body.aliases.map(cleanText).filter(Boolean) : [],
                timing,
                ...(phases ? { phases } : {}),
                variants,
                defaultStepText: cleanText(body.defaultStepText) || undefined,
                createdBy: userData.email,
                order: typeof body.order === 'number' ? body.order : 100
            });
            return res.status(200).json({ success: true, data: created });
        }

        if (req.method === 'PUT') {
            const { _id, ...fields } = body;
            if (!_id) return res.status(400).json({ success: false, message: 'Missing _id' });
            const update = {};
            if (cleanText(fields.name)) update.name = cleanText(fields.name);
            if (Array.isArray(fields.aliases)) update.aliases = fields.aliases.map(cleanText).filter(Boolean);
            if (fields.timing) update.timing = { cookMinutes: clampOrNothing(fields.timing.cookMinutes), prepMinutes: clampOrNothing(fields.timing.prepMinutes) };
            if (fields.perServe && typeof fields.perServe === 'object') update.perServe = fields.perServe;
            if (Array.isArray(fields.phases)) update.phases = cleanPhases(fields.phases);
            if (Array.isArray(fields.variants)) {
                update.variants = fields.variants.map(v => ({
                    name: cleanText(v.name),
                    cookMinutes: clampOrNothing(v.cookMinutes),
                    prepMinutes: clampOrNothing(v.prepMinutes),
                    ...(cleanPerServe(v.perServe) ? { perServe: v.perServe } : {}),
                    ...(Array.isArray(v.phases) && v.phases.length > 0 ? { phases: cleanPhases(v.phases) } : {})
                })).filter(v => v.name);
            }
            if (typeof fields.defaultStepText !== 'undefined') update.defaultStepText = cleanText(fields.defaultStepText);
            if (typeof fields.order !== 'undefined') update.order = fields.order;
            if (typeof fields.active !== 'undefined') update.active = !!fields.active;
            if (Object.keys(update).length === 0) return res.status(400).json({ success: false, message: 'Nothing to update' });
            const updated = await CarbType.findByIdAndUpdate(_id, { $set: update }, { new: true });
            if (!updated) return res.status(404).json({ success: false, message: 'Carb type not found' });
            return res.status(200).json({ success: true, data: updated });
        }

        if (req.method === 'DELETE') {
            const { _id } = body;
            if (!_id) return res.status(400).json({ success: false, message: 'Missing _id' });
            // System types are deactivated rather than deleted, so existing
            // recipes never reference a carb the catalog no longer knows.
            const target = await CarbType.findById(_id);
            if (!target) return res.status(404).json({ success: false, message: 'Carb type not found' });
            if (target.isSystem) {
                target.active = false;
                await target.save();
                return res.status(200).json({ success: true, data: target, message: 'Carb type deactivated' });
            }
            await target.deleteOne();
            return res.status(200).json({ success: true, message: 'Carb type deleted' });
        }
    } catch (error) {
        console.error('carbTypes error:', error);
        const dup = error?.code === 11000;
        return res.status(dup ? 409 : 500).json({ success: false, message: dup ? 'A carb type with that name already exists' : (error.message || 'Internal error') });
    }
}

function clampOrNothing(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Phase rows: name required, minutes non-negative integer. */
function cleanPhases(phases) {
    return (phases || [])
        .map(p => ({
            name: cleanText(p.name),
            minutes: Math.max(0, Math.round(Number(p.minutes) || 0)),
            instruction: cleanText(p.instruction)
        }))
        .filter(p => p.name)
}

/** Per-serve ratio map: filters to numeric, non-negative values. Returns
 *  undefined when empty so untouched fields don't get nulled. */
function cleanPerServe(perServe) {
    if (!perServe || typeof perServe !== 'object') return undefined
    const out = {}
    let any = false
    for (const [k, v] of Object.entries(perServe)) {
        if (k === '_id') continue
        const n = Number(v)
        if (Number.isFinite(n) && n > 0) { out[k] = n; any = true }
    }
    return any ? out : undefined
}
