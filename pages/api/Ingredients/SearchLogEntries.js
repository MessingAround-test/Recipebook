import dbConnect from '../../../lib/dbConnect';
import SearchLog from '../../../models/SearchLog';
import IngredientConversion from '../../../models/IngredientConversion';
import { verifyToken } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    logAPI(req)

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        await dbConnect();

        // 1. Fetch all search logs
        const logs = await SearchLog.find({}).sort({ last_fetched: -1 }).lean().exec();

        // 2. Fetch all unique conversions needed for these logs
        const uniqueTerms = [...new Set(logs.map(log => log.search_term))];
        const conversions = await IngredientConversion.find({
            ingredient_name: { $in: uniqueTerms }
        }).lean().exec();

        // Create a map for easy lookup
        const conversionMap = {};
        conversions.forEach(c => {
            conversionMap[c.ingredient_name] = c.grams_per_each;
        });

        // 3. Attach conversion factor to logs
        const enrichedLogs = logs.map(log => ({
            ...log,
            grams_per_each: conversionMap[log.search_term] || 0
        }));

        return res.status(200).json({ success: true, res: enrichedLogs });
    } catch (error) {
        console.error("Failed to fetch SearchLog entries:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
