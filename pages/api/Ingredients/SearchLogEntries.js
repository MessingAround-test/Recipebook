import dbConnect from '../../../lib/dbConnect';
import SearchLog from '../../../models/SearchLog';
import IngredientConversion from '../../../models/IngredientConversion';
import { verifyToken, verifyAdmin } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';

export default async function handler(req, res) {
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;
    logAPI(req)

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        await dbConnect();

        // 1. Fetch all search logs
        const logs = await SearchLog.find({}).sort({ last_fetched: -1 }).lean().exec();

        return res.status(200).json({ success: true, res: logs });
    } catch (error) {
        console.error("Failed to fetch SearchLog entries:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
