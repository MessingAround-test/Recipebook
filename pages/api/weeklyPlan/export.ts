import dbConnect from '../../../lib/dbConnect';
import WeeklyPlan from '../../../models/WeeklyPlan';
import Recipe from '../../../models/Recipe';
import ShoppingList from '../../../models/ShoppingList';
import ShoppingListItem from '../../../models/ShoppingListItem';
import IngredientConversion from '../../../models/IngredientConversion';
import { determineCategory } from '../../../lib/categoryDetermination';
import { callGroqChat } from '../../../lib/ai';
import { verifyToken, requireFeatures } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import mongoose from 'mongoose';

// Meal ordering used for the "I have ingredients up to <day> <meal>" cutoff.
// A planned block is exported when it falls strictly after that boundary.
const MEAL_ORDER: Record<string, number> = {
    Breakfast: 0,
    Lunch: 1,
    Dinner: 2,
    Snack: 3
};

/**
 * Decides whether a planned block should be exported.
 * - Leftover blocks are never exported: they represent already-cooked servings
 *   of a recipe whose ingredients were bought with the original block.
 * - With a cutoff, only blocks strictly after "<day> <meal>" are included.
 *   Undecided blocks (still in the Recipe Pool) are always included.
 */
function shouldExportBlock(pRecipe: any, cutoffDay?: string | null, cutoffMeal?: string | null): boolean {
    if (pRecipe.isLeftover) return false;
    if (!cutoffDay || !cutoffMeal) return true;
    const day = String(pRecipe.day || 'Undecided');
    if (day === 'Undecided') return true;
    if (day > cutoffDay) return true;
    if (day < cutoffDay) return false;
    const meal = String(pRecipe.mealType || 'Dinner');
    const mealIdx = MEAL_ORDER[meal] ?? 3;
    const cutoffIdx = MEAL_ORDER[cutoffMeal] ?? 0;
    return mealIdx > cutoffIdx;
}

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    if (!(await requireFeatures(req, res, decoded, ['weeklyPlanner', 'shoppingList']))) return;
    logAPI(req);

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    await dbConnect();
    const userId = decoded.id;

    try {
        const { startDate, shoppingListId, cutoffDay, cutoffMeal } = req.body;
        if (!startDate) return res.status(400).json({ success: false, message: "startDate is required" });

        const plan = await WeeklyPlan.findOne({ user_id: userId, startDate });
        if (!plan) {
            return res.status(404).json({ success: false, message: "Weekly plan not found" });
        }

        let targetListId = shoppingListId;

        // If no list provided, create a new one
        if (!targetListId) {
            const newList = await ShoppingList.create({
                name: `Week of ${startDate}`,
                complete: false,
                createdBy: userId
            });
            targetListId = newList._id;
        }

        const itemsToAdd = [];

        // Add everyday items
        if (plan.everydayItems && plan.everydayItems.length > 0) {
            for (const item of plan.everydayItems) {
                let expanded = false;
                
                if (item.recipe_id) {
                    const recipe = await Recipe.findById(item.recipe_id);
                    if (recipe && recipe.ingredients) {
                        const baseServings = Number(recipe.servings) || 1;
                        // Pool item quantity is the WEEKLY total
                        const scale = Number(item.quantity) / baseServings;
                        
                        for (const ing of recipe.ingredients) {
                            const amount = Number(ing.Amount || 0) * scale;
                            const category = await determineCategory(ing.Name, { IngredientConversion, ShoppingListItem }, callGroqChat);
                            
                            itemsToAdd.push({
                                name: ing.Name,
                                quantity: amount,
                                quantity_type: ing.AmountType || 'each',
                                category: category,
                                shoppingListId: targetListId,
                                complete: false,
                                createdBy: userId,
                                deleted: false,
                                recipe_id: recipe._id.toString(),
                                recipe_name: recipe.name,
                                note: ''
                            });
                        }
                        expanded = true;
                    }
                }

                if (!expanded) {
                    const category = await determineCategory(item.name, { IngredientConversion, ShoppingListItem }, callGroqChat);
                    itemsToAdd.push({
                        name: item.name,
                        quantity: Number(item.quantity),
                        quantity_type: item.quantity_unit || 'each',
                        category: category,
                        shoppingListId: targetListId,
                        complete: false,
                        createdBy: userId,
                        deleted: false,
                        note: ''
                    });
                }
            }
        }

        // Planned blocks are aggregated per recipe so ingredients are exported
        // exactly once at the scale needed to cover:
        //   - every non-leftover block inside the export window, plus
        //   - that recipe's leftover blocks, but only when the base cook is
        //     part of this export (you buy ingredients for the whole cook;
        //     leftovers from an earlier cook need nothing new).
        interface RecipeNeed { baseServings: number; leftoverServings: number }
        const needs = new Map<string, RecipeNeed>();
        const planned = plan.plannedRecipes || [];
        for (const pRecipe of planned) {
            if (!pRecipe.recipe_id || pRecipe.isLeftover) continue;
            if (!shouldExportBlock(pRecipe, cutoffDay, cutoffMeal)) continue;
            const key = String(pRecipe.recipe_id);
            const entry = needs.get(key) || { baseServings: 0, leftoverServings: 0 };
            entry.baseServings += Number(pRecipe.servings) || 0;
            needs.set(key, entry);
        }
        // Leftover blocks ride along only when their base cook is in the window.
        for (const pRecipe of planned) {
            if (!pRecipe.recipe_id || !pRecipe.isLeftover) continue;
            const entry = needs.get(String(pRecipe.recipe_id));
            if (!entry || entry.baseServings <= 0) continue;
            entry.leftoverServings += Number(pRecipe.servings) || 0;
        }

        const recipeIds = Array.from(needs.keys());
        if (recipeIds.length > 0) {
            const recipeDocs = await Recipe.find({ _id: { $in: recipeIds } });
            const recipeById = new Map(recipeDocs.map(r => [String(r._id), r]));
            for (const recipeId of Array.from(needs.keys())) {
                const entry = needs.get(recipeId)!;
                const totalServings = entry.baseServings + entry.leftoverServings;
                if (totalServings <= 0) continue;
                const recipe: any = recipeById.get(recipeId);
                if (!recipe || !recipe.ingredients) continue;
                const baseServings = Number(recipe.servings) || 1;
                const scale = totalServings / baseServings;

                for (const ing of recipe.ingredients) {
                    const amount = Number(ing.Amount || 0) * scale;
                    const category = await determineCategory(ing.Name, { IngredientConversion, ShoppingListItem }, callGroqChat);

                    itemsToAdd.push({
                        name: ing.Name,
                        quantity: amount,
                        quantity_type: ing.AmountType || 'each',
                        category: category,
                        shoppingListId: targetListId,
                        complete: false,
                        createdBy: userId,
                        deleted: false,
                        recipe_id: recipe._id.toString(),
                        recipe_name: recipe.name,
                        note: ''
                    });
                }
            }
        }

        if (itemsToAdd.length > 0) {
            await ShoppingListItem.insertMany(itemsToAdd);
        }

        return res.status(200).json({ success: true, listId: targetListId, addedCount: itemsToAdd.length });

    } catch (err) {
        console.error("Export to shopping list error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
