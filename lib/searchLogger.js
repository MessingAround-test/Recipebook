import SearchLog from '../models/SearchLog';
import IngredientConversion from '../models/IngredientConversion';
import axios from 'axios';

/**
 * Logs a search attempt and ensures a global conversion factor is present.
 */
export async function logSearchAndGetConversion(searchTerm, source, success, errorMessage = "", edgeToken = "") {
    try {
        const normalizedTerm = searchTerm.toLowerCase().trim();

        // 1. ALWAYS log the search attempt
        const searchLog = new SearchLog({
            search_term: normalizedTerm,
            source: source,
            success: success,
            error_message: errorMessage,
            last_fetched: Date.now()
        });
        await searchLog.save();

        // 2. Get or Refresh global conversion factor
        let conversion = await IngredientConversion.findOne({ ingredient_name: normalizedTerm });

        // If missing or we want to refresh (maybe every N days?), call AI
        if (!conversion) {
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
