import { verifyToken } from "../../../lib/auth.ts";
import dbConnect from '../../../lib/dbConnect'
import User from '../../../models/User'
import Recipe from '../../../models/Recipe'
import ShoppingList from '../../../models/ShoppingList'
import ShoppingListItem from '../../../models/ShoppingListItem'
import IngredientConversion from '../../../models/IngredientConversion'
import { logAPI } from "../../../lib/logger.ts";
import { determineCategory } from '../../../lib/categoryDetermination';
import { callGroqChat } from '../../../lib/ai';

// Centralized logic moved to lib/categoryDetermination.ts

export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method Not Allowed" });
    }

    try {
        await dbConnect();

        const { recipeId, shoppingListId } = req.body;

        if (!recipeId || !shoppingListId) {
            return res.status(400).json({ success: false, message: "recipeId and shoppingListId are required" });
        }

        const db_id = decoded.id;
        const userData = await User.findById(db_id);
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Verify recipe exists and user has access
        const recipe = await Recipe.findOne({ _id: recipeId });
        if (!recipe) {
            return res.status(404).json({ success: false, message: "Recipe not found" });
        }
        if (decoded.role !== "admin" && recipe.creator_email !== userData.email) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        // Verify shopping list exists
        const shoppingList = await ShoppingList.findOne({ _id: shoppingListId });
        if (!shoppingList) {
            return res.status(404).json({ success: false, message: "Shopping list not found" });
        }

        // Add each ingredient to the shopping list
        let added = 0;
        for (const ingredient of recipe.ingredients) {
            const category = await determineCategory(ingredient.Name, { IngredientConversion, ShoppingListItem }, callGroqChat);

            await ShoppingListItem.create({
                name: ingredient.Name.toLowerCase(),
                quantity: ingredient.Amount,
                quantity_type: ingredient.AmountType,
                category: category,
                shoppingListId: shoppingListId,
                recipe_id: recipeId,
                recipe_name: recipe.name,
                createdBy: userData._id,
                complete: false,
                deleted: false,
                note: `From recipe: ${recipe.name}`
            });
            added++;
        }

        return res.status(200).json({ success: true, added, message: `${added} items added to shopping list` });
    } catch (error) {
        console.error('Error adding recipe to shopping list:', error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}
