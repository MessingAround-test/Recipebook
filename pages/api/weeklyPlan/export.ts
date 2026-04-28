import dbConnect from '../../../lib/dbConnect';
import WeeklyPlan from '../../../models/WeeklyPlan';
import Recipe from '../../../models/Recipe';
import ShoppingList from '../../../models/ShoppingList';
import ShoppingListItem from '../../../models/ShoppingListItem';
import IngredientConversion from '../../../models/IngredientConversion';
import { determineCategory } from '../../../lib/categoryDetermination';
import { callGroqChat } from '../../../lib/ai';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import mongoose from 'mongoose';

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    logAPI(req);

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    await dbConnect();
    const userId = decoded.id;

    try {
        const { startDate, shoppingListId } = req.body;
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
                        // Quantity is how many of this recipe they want, multiplied by 7 for the week
                        const scale = (Number(item.quantity) * 7) / baseServings;
                        
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
                                note: 'Everyday item'
                            });
                        }
                        expanded = true;
                    }
                }

                if (!expanded) {
                    const category = await determineCategory(item.name, { IngredientConversion, ShoppingListItem }, callGroqChat);
                    itemsToAdd.push({
                        name: item.name,
                        quantity: Number(item.quantity) * 7,
                        quantity_type: item.quantity_unit || 'each',
                        category: category,
                        shoppingListId: targetListId,
                        complete: false,
                        createdBy: userId,
                        deleted: false,
                        note: 'Everyday item'
                    });
                }
            }
        }

        // Add recipe ingredients
        if (plan.plannedRecipes && plan.plannedRecipes.length > 0) {
            for (const pRecipe of plan.plannedRecipes) {
                if (!pRecipe.recipe_id) continue;
                
                const recipe = await Recipe.findById(pRecipe.recipe_id);
                if (recipe && recipe.ingredients) {
                    const baseServings = Number(recipe.servings) || 1;
                    const scale = Number(pRecipe.servings) / baseServings;

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
                            note: pRecipe.day ? `For ${pRecipe.day}` : ''
                        });
                    }
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
