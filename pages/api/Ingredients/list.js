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

        // Get unique search terms from SearchLog (successful ones)
        const searchTerms = await SearchLog.distinct('search_term', { success: true });

        // Get unique ingredient names from IngredientConversion
        const conversionNames = await IngredientConversion.distinct('ingredient_name');

        // Combine and de-duplicate
        const allNames = Array.from(new Set([...searchTerms, ...conversionNames]))
            .filter(name => name && name.length > 1)
            .sort((a, b) => a.localeCompare(b));

        res.status(200).json({ success: true, data: allNames });
    } catch (error) {
        console.error("API Error in /api/Ingredients/list:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}
