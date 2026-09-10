import { verifyToken } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger';
import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import User from '../../../models/User';
import { analyzeCarbSideForRecipe } from '../../../lib/carbSideServer';

/** One-shot carb side analysis for a recipe (POST { recipeId, force? }).
 *  The result is persisted on the recipe — Start Cooking never calls AI. */
export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { recipeId, force } = req.body || {};
    if (!recipeId) {
        return res.status(400).json({ success: false, message: 'Missing recipeId' });
    }

    try {
        await dbConnect();
        const userData = await User.findById(decoded.id);
        if (!userData) return res.status(400).json({ success: false, message: 'user not found, please relog' });

        const recipe = await Recipe.findById(recipeId);
        if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });

        // Ownership: admins can re-analyze any recipe, users only their own
        if (userData.role !== 'admin' && recipe.creator_email !== userData.email) {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not own this recipe' });
        }

        const result = await analyzeCarbSideForRecipe(recipe, { force: force === true });
        return res.status(200).json({ success: true, data: result.carbSide, skipped: result.skipped === true });
    } catch (error) {
        console.error('Error running carb side analysis:', error);
        return res.status(500).json({ success: false, message: error.message || 'Error processing request' });
    }
}
