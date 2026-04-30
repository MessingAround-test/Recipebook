import SearchLog from '../models/SearchLog';
import IngredientConversion from '../models/IngredientConversion';
import ExtractionUsage from '../models/ExtractionUsage';
import axios from 'axios';

const pendingConversions = new Map();

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
        const dbConnect = require('./dbConnect').default;
        await dbConnect();

        console.log(`[CacheCheck] Searching for: "${normalizedTerm}"`);
        let conversion = await IngredientConversion.findOne({ ingredient_name: normalizedTerm });
        
        if (conversion) {
            console.log(`[CacheCheck] Found: "${conversion.ingredient_name}" (v${conversion.nutrients_version || 0})`);
        } else {
            console.log(`[CacheCheck] NOT found in database: "${normalizedTerm}"`);
        }

        // If missing or old nutrients version, call AI
        if (conversion && (conversion.nutrients_version || 0) >= 2) {
            console.log(`Cache hit for [${normalizedTerm}] (v${conversion.nutrients_version})`);
            return conversion;
        }

        // If missing or old nutrients version, call AI
        if (!conversion || (conversion.nutrients_version || 0) < 2) {
            // Check if there's already a pending request for this ingredient
            if (pendingConversions.has(normalizedTerm)) {
                console.log(`Waiting for existing conversion request for [${normalizedTerm}]...`);
                return await pendingConversions.get(normalizedTerm);
            }

            const conversionPromise = (async () => {
                try {
                    const edgeTokenVal = edgeToken || "";
                    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8080";
                    const response = await axios.get(`${baseUrl}/api/ai/determine_conversion?ingredient_name=${encodeURIComponent(normalizedTerm)}`, {
                        headers: { 'edgetoken': edgeTokenVal },
                        timeout: 15000
                    });

                    if (response.data && response.data.success) {
                        const aiData = response.data.data;
                        const updateFields = {
                            grams_per_each: aiData.grams_per_each,
                            protein_g: aiData.protein_g || 0,
                            fat_g: aiData.fat_g || 0,
                            carbohydrates_g: aiData.carbohydrates_g || 0,
                            fiber_g: aiData.fiber_g || 0,
                            energy_kcal: aiData.energy_kcal || 0,
                            vitamin_a_ug: aiData.vitamin_a_ug || 0,
                            vitamin_b1_mg: aiData.vitamin_b1_mg || 0,
                            vitamin_b2_mg: aiData.vitamin_b2_mg || 0,
                            vitamin_b3_mg: aiData.vitamin_b3_mg || 0,
                            vitamin_b6_mg: aiData.vitamin_b6_mg || 0,
                            vitamin_b12_ug: aiData.vitamin_b12_ug || 0,
                            vitamin_c_mg: aiData.vitamin_c_mg || 0,
                            vitamin_d_ug: aiData.vitamin_d_ug || 0,
                            vitamin_e_mg: aiData.vitamin_e_mg || 0,
                            vitamin_k_ug: aiData.vitamin_k_ug || 0,
                            calcium_mg: aiData.calcium_mg || 0,
                            iron_mg: aiData.iron_mg || 0,
                            magnesium_mg: aiData.magnesium_mg || 0,
                            phosphorus_mg: aiData.phosphorus_mg || 0,
                            potassium_mg: aiData.potassium_mg || 0,
                            sodium_mg: aiData.sodium_mg || 0,
                            zinc_mg: aiData.zinc_mg || 0,
                            category: aiData.category || "Pantry",
                            last_updated: Date.now(),
                            nutrients_version: 2
                        };
                        return await IngredientConversion.findOneAndUpdate(
                            { ingredient_name: normalizedTerm },
                            updateFields,
                            { upsert: true, new: true }
                        );
                    }
                } catch (aiError) {
                    console.error("Failed to fetch AI conversion for ingredient:", normalizedTerm, aiError.message);
                } finally {
                    pendingConversions.delete(normalizedTerm);
                }
                return null;
            })();

            pendingConversions.set(normalizedTerm, conversionPromise);
            conversion = await conversionPromise;
        }

        return conversion;
    } catch (error) {
        console.error("Error in logSearchAndGetConversion:", error);
        return null;
    }
}
