import dbConnect from '../../../lib/dbConnect';
import mongoose from 'mongoose';
import Recipe from '../../../models/Recipe';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { saveRecipeImages } from '../../../lib/recipeImageServer';

export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();

    const userData = await User.findById(decoded.id);
    if (!userData || userData.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    try {
        if (req.method === 'GET') {
            // One row per recipe; sizes come from $strLenCP on the raw field so
            // the huge blob itself never crosses the wire.
            const rows = await Recipe.aggregate([
                {
                    $project: {
                        name: 1,
                        hasImage: { $ifNull: ['$hasImage', false] },
                        legacy: {
                            $cond: [
                                { $and: [{ $gt: ['$image', null] }, { $ne: ['$image', ''] }] },
                                true,
                                false
                            ]
                        },
                        legacyBytes: {
                            $cond: [
                                { $and: [{ $gt: ['$image', null] }, { $eq: [{ $type: '$image' }, 'string'] }] },
                                { $strLenCP: '$image' },
                                0
                            ]
                        },
                        legacyIsUrl: { $eq: [{ $indexOfCP: ['$image', 'data:'] }, 0] }
                    }
                },
                { $sort: { name: 1 } }
            ]);
            return res.status(200).json({ success: true, data: rows });
        }

        if (req.method === 'POST') {
            const { recipeIds } = req.body || {};
            if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
                return res.status(400).json({ success: false, message: 'No recipeIds provided' });
            }

            const ObjectId = mongoose.Types.ObjectId;
            const traced = [];

            for (const id of recipeIds) {
                try {
                    const raw = await Recipe.collection.findOne(
                        { _id: new ObjectId(id) },
                        { projection: { name: 1, image: 1 } }
                    );
                    if (!raw) {
                        traced.push({ id, name: null, status: 'failed', error: 'Recipe not found' });
                        continue;
                    }
                    if (!raw.image) {
                        traced.push({ id, name: raw.name, status: 'skipped', error: 'No legacy inline image' });
                        continue;
                    }

                    const bytesBefore = typeof raw.image === 'string' ? raw.image.length : 0;
                    const result = await saveRecipeImages(id, raw.image);
                    if (result.ok) {
                        traced.push({ id, name: raw.name, status: 'migrated', bytesBefore, fullStored: true, thumbStored: true });
                    } else {
                        traced.push({ id, name: raw.name, status: 'failed', error: 'Image could not be decoded — inline field left intact' });
                    }
                } catch (e) {
                    traced.push({ id, name: null, status: 'failed', error: String(e?.message || e) });
                }
            }

            return res.status(200).json({
                success: true,
                message: `Migrated ${traced.filter(t => t.status === 'migrated').length}, skipped ${traced.filter(t => t.status === 'skipped').length}, failed ${traced.filter(t => t.status === 'failed').length}`,
                data: traced
            });
        }

        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    } catch (err) {
        console.error('migrateRecipeImages error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
