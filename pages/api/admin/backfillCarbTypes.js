import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import { verifyToken } from '../../../lib/auth';
import { callGroqChat } from '../../../lib/ai';

const VALID_CARB_TYPES = ['Rice', 'Bread/Wraps', 'Pasta/Noodles', 'Potato', 'Quinoa', 'None/Other'];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    // Optional: check if user is an admin if you have an admin flag, 
    // but for personal use, token verify is usually enough.

    try {
        await dbConnect();

        // Find recipes that do not have carbType
        const recipes = await Recipe.find({ carbType: { $exists: false } });

        if (recipes.length === 0) {
            return res.status(200).json({ success: true, message: "No recipes need backfilling." });
        }

        const updatedRecipes = [];
        const errors = [];

        for (const recipe of recipes) {
            try {
                // Prepare ingredients string for AI
                const ingredientsStr = recipe.ingredients.map(ing => `${ing.Amount || ''} ${ing.AmountType || ''} ${ing.Name}`).join(', ');

                const messages = [
                    {
                        role: "system",
                        content: `You are a culinary assistant. Given a recipe name and its ingredients, determine the primary carbohydrate source.
Use exactly one of the following categories: ${VALID_CARB_TYPES.join(', ')}.

Output MUST be a single JSON object with the key "carbType". Nothing else.`
                    },
                    {
                        role: "user",
                        content: `Recipe: "${recipe.name}"\nIngredients: ${ingredientsStr}`
                    }
                ];

                const responseText = await callGroqChat(messages, true);
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    const match = responseText.match(/\{[\s\S]*\}/);
                    if (match) {
                        data = JSON.parse(match[0]);
                    } else {
                        throw new Error("Failed to parse AI response as JSON");
                    }
                }

                if (data.carbType && VALID_CARB_TYPES.includes(data.carbType)) {
                    recipe.carbType = data.carbType;
                    await recipe.save();
                    updatedRecipes.push({ id: recipe._id, name: recipe.name, carbType: data.carbType });
                    console.log(`Updated recipe ${recipe.name} with carbType ${data.carbType}`);
                } else {
                    console.warn(`Invalid carbType returned for ${recipe.name}: ${data.carbType}`);
                    errors.push({ id: recipe._id, name: recipe.name, error: "Invalid carbType returned" });
                }

                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (err) {
                console.error(`Error processing recipe ${recipe.name}:`, err);
                errors.push({ id: recipe._id, name: recipe.name, error: err.message });
            }
        }

        return res.status(200).json({ 
            success: true, 
            message: `Backfilled ${updatedRecipes.length} recipes.`,
            updated: updatedRecipes,
            errors: errors
        });

    } catch (err) {
        console.error("Backfill error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
