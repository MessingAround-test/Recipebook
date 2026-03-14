import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import User from '../../../models/User';
import SearchLog from '../../../models/SearchLog';
import ApiKeyUsage from '../../../models/ApiKeyUsage';
import ExtractionUsage from '../../../models/ExtractionUsage';
import { verifyAdmin } from "../../../lib/auth.ts";

export default async function handler(req, res) {
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;

    try {
        await dbConnect();

        const { range = '24h' } = req.query;

        // Calculate time ranges
        const now = new Date();
        let startTime = new Date();
        let growthTime = new Date();

        switch (range) {
            case '1h': startTime.setHours(startTime.getHours() - 1); break;
            case '12h': startTime.setHours(startTime.getHours() - 12); break;
            case '24h': startTime.setHours(startTime.getHours() - 24); break;
            case '3d': startTime.setDate(startTime.getDate() - 3); break;
            case '7d': startTime.setDate(startTime.getDate() - 7); break;
            case '30d': startTime.setDate(startTime.getDate() - 30); break;
            default: startTime.setHours(startTime.getHours() - 24);
        }

        // Growth is always 30 days for context, or matching the range if longer
        growthTime.setDate(now.getDate() - 30);
        const growthStartTime = startTime < growthTime ? startTime : growthTime;

        // 1. Total Counts
        const totalRecipes = await Recipe.countDocuments();
        const totalUsers = await User.countDocuments();
        const totalSearchLogs = await SearchLog.countDocuments();

        // 2. API Usage stats
        const apiUsage = await ApiKeyUsage.find({
            hour: { $gte: startTime }
        }).sort({ hour: 1 });

        // 3. Extraction Usage
        const extractionUsage = await ExtractionUsage.find({
            hour: { $gte: startTime }
        }).sort({ hour: 1 });

        // 4. Database Growth
        const recipesByDay = await Recipe.aggregate([
            { $match: { created_at: { $gte: growthStartTime } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const usersByDay = await User.aggregate([
            { $match: { created_at: { $gte: growthStartTime } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        return res.status(200).json({
            success: true,
            stats: {
                totals: {
                    recipes: totalRecipes,
                    users: totalUsers,
                    searchLogs: totalSearchLogs
                },
                apiUsage: apiUsage,
                extractionUsage: extractionUsage,
                growth: {
                    recipes: recipesByDay,
                    users: usersByDay
                }
            }
        });
    } catch (error) {
        console.error("Dashboard stats failed:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
