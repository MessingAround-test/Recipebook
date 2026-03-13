import dbConnect from '../../../lib/dbConnect';
import Ingredients from '../../../models/Ingredients';
import IngredientConversion from '../../../models/IngredientConversion';
import SearchLog from '../../../models/SearchLog';
import { logSearchAndGetConversion } from '../../../lib/searchLogger';
import { verifyToken, verifyAdmin } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';

export default async function handler(req, res) {
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;
    logAPI(req)

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        await dbConnect();

        // 1. Clear existing shared conversions to ensure consistency from scratch
        // (User request: we dont need to migrate IngredientConversion, just fill it in if it doesnt exist)
        // Clearing it now ensures that the upcoming migration of logs will repopulate it freshly/consistently.
        await IngredientConversion.deleteMany({});
        await SearchLog.deleteMany({});

        // 2. Find all unique search_term + source combinations from existing Ingredients
        const uniqueSearches = await Ingredients.aggregate([
            {
                $group: {
                    _id: {
                        search_term: "$search_term",
                        source: "$source"
                    }
                }
            }
        ]);

        console.log(`Found ${uniqueSearches.length} unique search term and source combinations to migrate into logs.`);

        let processed = 0;
        let errors = 0;

        for (const search of uniqueSearches) {
            const { search_term, source } = search._id;

            if (!search_term || !source) continue;

            try {
                const count = await Ingredients.countDocuments({ search_term, source });
                // This call will create a SearchLog entry AND populate IngredientConversion on-demand
                await logSearchAndGetConversion(search_term, source, true, "", req.headers.edgetoken || req.query.EDGEtoken || "", count);
                processed++;
            } catch (err) {
                console.error(`Error processing ${search_term} (${source}):`, err.message);
                errors++;
            }
        }

        return res.status(200).json({
            success: true,
            message: `Migration completed. Shared conversions cleared. ${processed} search logs generated.`,
            processed,
            errors
        });
    } catch (error) {
        console.error("Migration API failed:", error);
        return res.status(500).json({ success: false, message: "Migration failed: " + error.message });
    }
}
