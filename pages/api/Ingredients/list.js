import dbConnect from '../../../lib/dbConnect';
import SearchLog from '../../../models/SearchLog';
import IngredientConversion from '../../../models/IngredientConversion';
import { verifyToken } from "../../../lib/auth.ts";

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        await dbConnect();

        // Get unique search terms from SearchLog (successful ones) sorted by most recent
        const recentSearches = await SearchLog.aggregate([
            { $match: { success: true } },
            { $group: { 
                _id: "$search_term", 
                last_used: { $max: "$last_fetched" } 
            }},
            { $sort: { last_used: -1 } },
            { $limit: 100 }
        ]);
        const searchTerms = recentSearches.map(s => s._id);

        // Get unique ingredient names from IngredientConversion sorted by most recent update
        const recentConversions = await IngredientConversion.aggregate([
            { $group: { 
                _id: "$ingredient_name", 
                last_used: { $max: "$last_updated" } 
            }},
            { $sort: { last_used: -1 } },
            { $limit: 100 }
        ]);
        const conversionNames = recentConversions.map(c => c._id);

        // Combine, prioritizing recent searches first, then de-duplicate
        const allNamesSet = new Set([...searchTerms, ...conversionNames]);
        const allNames = Array.from(allNamesSet).filter(name => name && name.length > 1);
        
        // Note: We keep the order from the Set (recent first) instead of sorting alphabetically


        res.status(200).json({ success: true, data: allNames });
    } catch (error) {
        console.error("API Error in /api/Ingredients/list:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}
