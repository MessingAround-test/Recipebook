import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';
import dbConnect from '../../../lib/dbConnect';
import HiddenItem from '../../../models/HiddenItem';

function normalizePatterns(patterns) {
    return (Array.isArray(patterns) ? patterns : [patterns])
        .filter(p => typeof p === 'string' && p.trim().length > 0)
        .map(p => p.trim().toLowerCase());
}

export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        await dbConnect();

        if (req.method === "GET") {
            const docs = await HiddenItem.find({}).sort({ pattern: 1 }).lean().exec();
            return res.status(200).json({ success: true, data: docs.map(d => d.pattern) });
        }

        if (req.method === "POST") {
            const patterns = normalizePatterns(req.body?.patterns);
            if (patterns.length === 0) {
                return res.status(400).json({ success: false, message: "No patterns provided" });
            }

            for (const pattern of patterns) {
                await HiddenItem.updateOne(
                    { pattern },
                    { pattern },
                    { upsert: true }
                );
            }

            const docs = await HiddenItem.find({}).sort({ pattern: 1 }).lean().exec();
            return res.status(200).json({ success: true, data: docs.map(d => d.pattern) });
        }

        if (req.method === "DELETE") {
            const patterns = normalizePatterns(req.body?.patterns);
            if (patterns.length === 0) {
                return res.status(400).json({ success: false, message: "No patterns provided" });
            }

            await HiddenItem.deleteMany({ pattern: { $in: patterns } });

            const docs = await HiddenItem.find({}).sort({ pattern: 1 }).lean().exec();
            return res.status(200).json({ success: true, data: docs.map(d => d.pattern) });
        }

        return res.status(405).json({ success: false, message: "Method Not Allowed" });
    } catch (error) {
        console.error("API Error in /api/HiddenItems:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}
