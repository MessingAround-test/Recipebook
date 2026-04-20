import SearchLog from '../models/SearchLog';
import IngredientConversion from '../models/IngredientConversion';
import ExtractionUsage from '../models/ExtractionUsage';
import axios from 'axios';

/**
 * Logs extraction metrics (Cache hits vs Supplier Extractions).
 */
export async function logExtractionStats(type, count = 1) {
    try {
        const now = new Date();
        const minutes = Math.floor(now.getMinutes() / 15) * 15;
        const startOfInterval = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), minutes);

        await ExtractionUsage.findOneAndUpdate(
            { hour: startOfInterval, type },
            { $inc: { count: count } },
            { upsert: true }
        );
    } catch (err) {
        console.error('Error logging extraction stats:', err);
    }
}

/**
 * Logs a search attempt and ensures a global conversion factor is present.
 */
export async function logSearchAndGetConversion(searchTerm, source, success, errorMessage = "", edgeToken = "", recordsCount = 0) {
    try {
        const normalizedTerm = searchTerm.toLowerCase().trim();
        console.log(`Logging search for [${normalizedTerm}] via [${source}] with count [${recordsCount}]`);

        // 1. Log the search attempt only if a source is provided
        if (source) {
            await SearchLog.findOneAndUpdate(
                { search_term: normalizedTerm, source: source },
                {
                    success: success,
                    error_message: errorMessage,
                    records_count: recordsCount || 0,
                    last_fetched: Date.now()
                },
                { upsert: true }
            );
        }

        // 2. Get or Refresh global conversion factor
        let conversion = await IngredientConversion.findOne({ ingredient_name: normalizedTerm });

        // If missing, failed previously (0), or we want to refresh, call AI
        if (!conversion || !conversion.grams_per_each) {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8080";
                const response = await axios.get(`${baseUrl}/api/ai/determine_conversion?ingredient_name=${encodeURIComponent(normalizedTerm)}`, {
                    headers: { 'edgetoken': edgeToken }
                });

                if (response.data && response.data.success) {
                    conversion = await IngredientConversion.findOneAndUpdate(
                        { ingredient_name: normalizedTerm },
                        {
                            grams_per_each: response.data.data.grams_per_each,
                            last_updated: Date.now()
                        },
                        { upsert: true, new: true }
                    );
                }
            } catch (aiError) {
                console.error("Failed to fetch AI conversion for ingredient:", normalizedTerm, aiError.message);
            }
        }

        return conversion;
    } catch (error) {
        console.error("Error in logSearchAndGetConversion:", error);
        return null;
    }
}
