import Ingredients from '../../../models/Ingredients'
import SearchLog from '../../../models/SearchLog'
import IngredientConversion from '../../../models/IngredientConversion'
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';
import dbConnect from '../../../lib/dbConnect';

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    await dbConnect();

    let search_term = req.query.search_term
    if (search_term !== undefined) {
        search_term = search_term.toLowerCase()
    }

    if (req.method === "GET") {
        try {
            // Get unique search terms from SearchLog (successful ones) sorted by most recent
            const recentSearches = await SearchLog.aggregate([
                { $match: { success: true } },
                {
                    $group: {
                        _id: "$search_term",
                        last_used: { $max: "$last_fetched" }
                    }
                },
                { $sort: { last_used: -1 } },
                { $limit: 100 }
            ]);
            const searchTerms = recentSearches.map(s => s._id);

            // Get unique ingredient names from IngredientConversion sorted by most recent update
            const recentConversions = await IngredientConversion.aggregate([
                {
                    $group: {
                        _id: "$ingredient_name",
                        last_used: { $max: "$last_updated" }
                    }
                },
                { $sort: { last_used: -1 } },
                { $limit: 100 }
            ]);
            const conversionNames = recentConversions.map(c => c._id);

            // Combine and de-duplicate
            const allNamesSet = new Set([...searchTerms, ...conversionNames]);
            const IngredData = Array.from(allNamesSet).filter(name => name && name.length > 1);

            return res.status(200).json({ success: true, data: IngredData, message: "" })

            return res.status(200).json({ success: true, data: [], message: "No search term provided for defaults" })
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message })
        }
    } else {
        return res.status(405).json({ success: false, message: "Method Not Allowed" })
    }
}







