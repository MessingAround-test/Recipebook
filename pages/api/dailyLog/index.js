import dbConnect from '../../../lib/dbConnect';
import DailyLog from '../../../models/DailyLog';
import Recipes from '../../../models/Recipe';
import IngredientConversion from '../../../models/IngredientConversion';
import { verifyToken } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';
import { logSearchAndGetConversion } from '../../../lib/searchLogger';

// Helper to scale nutrients
function scaleNutrients(nutrients, ratio) {
    const scaled = {};
    Object.keys(nutrients).forEach(key => {
        if (typeof nutrients[key] === 'number') {
            scaled[key] = nutrients[key] * ratio;
        }
    });
    return scaled;
}

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    logAPI(req)

    await dbConnect();

    const { method } = req;
    const userId = decoded.id;

    switch (method) {
        case 'GET':
            const { date } = req.query;
            if (!date) return res.status(400).json({ success: false, message: "Date is required" });
            
            try {
                let log = await DailyLog.findOne({ user_id: userId, date });
                if (!log) {
                    // Create an empty log for that day if it doesn't exist
                    log = await DailyLog.create({ user_id: userId, date, items: [] });
                }
                return res.status(200).json({ success: true, log });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        case 'POST':
            const { date: logDate, type, name, quantity, quantity_unit, recipe_id } = req.body;
            if (!logDate || !type || !name) return res.status(400).json({ success: false, message: "Missing required fields" });

            try {
                let nutrients = {};

                if (type === 'ingredient') {
                    // 1. Get conversion data (triggers AI if needed)
                    const edgeToken = req.headers.edgetoken || "";
                    const conv = await logSearchAndGetConversion(name, null, true, "", edgeToken);
                    
                    if (conv) {
                        // 2. Calculate nutrients for the specific quantity
                        // We need a server-side version of normalizeToGrams or just import it
                        // Since normalizeToGrams is in lib/conversion.js which is JS, we can import it.
                        const { normalizeToGrams } = require('../../../lib/conversion');
                        const { value: grams } = normalizeToGrams(quantity_unit, quantity, conv.grams_per_each);
                        const ratio = (grams ?? quantity) / 100;
                        
                        const keys = [
                            'energy_kcal', 'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g',
                            'vitamin_a_ug', 'vitamin_b1_mg', 'vitamin_b2_mg', 'vitamin_b3_mg',
                            'vitamin_b6_mg', 'vitamin_b12_ug', 'vitamin_c_mg', 'vitamin_d_ug',
                            'vitamin_e_mg', 'vitamin_k_ug',
                            'calcium_mg', 'iron_mg', 'magnesium_mg', 'phosphorus_mg',
                            'potassium_mg', 'sodium_mg', 'zinc_mg'
                        ];
                        keys.forEach(k => { nutrients[k] = (conv[k] || 0) * ratio; });
                    }
                } else if (type === 'recipe') {
                    // Fetch recipe and expand its ingredients
                    const recipe = await Recipes.findById(recipe_id);
                    if (!recipe) return res.status(404).json({ success: false, message: "Recipe not found" });

                    const recipeServes = recipe.servings || 1;
                    const serveRatio = quantity / recipeServes;
                    const timestamp = new Date();

                    const newItems = [];
                    for (const ing of recipe.ingredients) {
                        const ingName = ing.Name || ing.name;
                        const conv = await logSearchAndGetConversion(ingName, null, true, "", "");
                        
                        const itemNutrients = {};
                        if (conv) {
                            const { normalizeToGrams } = require('../../../lib/conversion');
                            const { value: grams } = normalizeToGrams(ing.AmountType || ing.quantity_type, ing.Amount || ing.quantity, conv.grams_per_each);
                            const ratio = (grams ?? (ing.Amount || ing.quantity)) / 100;
                            const scaledRatio = ratio * serveRatio;
                            
                            const keys = [
                                'energy_kcal', 'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g',
                                'vitamin_a_ug', 'vitamin_b1_mg', 'vitamin_b2_mg', 'vitamin_b3_mg',
                                'vitamin_b6_mg', 'vitamin_b12_ug', 'vitamin_c_mg', 'vitamin_d_ug',
                                'vitamin_e_mg', 'vitamin_k_ug',
                                'calcium_mg', 'iron_mg', 'magnesium_mg', 'phosphorus_mg',
                                'potassium_mg', 'sodium_mg', 'zinc_mg'
                            ];
                            keys.forEach(k => { 
                                itemNutrients[k] = (conv[k] || 0) * scaledRatio; 
                            });
                        }

                        newItems.push({
                            type: 'ingredient',
                            name: ingName,
                            recipe_id: recipe._id,
                            recipe_name: recipe.name, // Added for grouping UI
                            quantity: (ing.Amount || ing.quantity) * serveRatio,
                            quantity_unit: ing.AmountType || ing.quantity_type,
                            nutrients: itemNutrients,
                            logged_at: timestamp
                        });
                    }

                    const log = await DailyLog.findOneAndUpdate(
                        { user_id: userId, date: logDate },
                        { $push: { items: { $each: newItems } } },
                        { upsert: true, new: true }
                    );

                    return res.status(200).json({ success: true, log });
                }

                const newItem = { type, name, recipe_id, quantity, quantity_unit, nutrients };
                
                const log = await DailyLog.findOneAndUpdate(
                    { user_id: userId, date: logDate },
                    { $push: { items: newItem } },
                    { upsert: true, new: true }
                );

                return res.status(200).json({ success: true, log });
            } catch (err) {
                console.error("Error adding to DailyLog:", err);
                return res.status(500).json({ success: false, message: err.message });
            }

        case 'DELETE':
            const { date: delDate, itemId } = req.body;
            try {
                // Find the log first to check if the item belongs to a group
                const currentLog = await DailyLog.findOne({ user_id: userId, date: delDate });
                if (!currentLog) return res.status(404).json({ success: false, message: "Log not found" });

                const item = currentLog.items.id(itemId);
                let update;

                if (item && item.recipe_id && item.logged_at) {
                    // Delete the entire meal (all ingredients with same recipe_id and timestamp)
                    update = { $pull: { items: { recipe_id: item.recipe_id, logged_at: item.logged_at } } };
                } else {
                    // Delete single item
                    update = { $pull: { items: { _id: itemId } } };
                }

                const log = await DailyLog.findOneAndUpdate(
                    { user_id: userId, date: delDate },
                    update,
                    { new: true }
                );
                return res.status(200).json({ success: true, log });
            } catch (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

        default:
            res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
