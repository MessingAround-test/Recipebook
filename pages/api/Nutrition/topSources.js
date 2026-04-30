import dbConnect from '../../../lib/dbConnect'
import IngredientConversion from '../../../models/IngredientConversion'
import { verifyToken } from "../../../lib/auth";

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        await dbConnect();
        const { nutrient, search } = req.query;

        if (!nutrient) {
            return res.status(400).json({ success: false, message: 'Nutrient is required' });
        }

        const User = require('../../../models/User').default;
        const user = await User.findById(decoded.id) || await User.findOne({ id: decoded.id });
        const preference = user?.dietary_preference || 'none';

        let allowedCategories = ["Fresh Produce", "Meat", "Seafood", "Nuts", "Seeds", "Dairy", "Grains", "Pantry"];
        if (preference === 'vegetarian') {
            allowedCategories = allowedCategories.filter(c => c !== "Meat" && c !== "Seafood");
        } else if (preference === 'vegan') {
            allowedCategories = allowedCategories.filter(c => c !== "Meat" && c !== "Seafood" && c !== "Dairy");
        } else if (preference === 'pescetarian') {
            allowedCategories = allowedCategories.filter(c => c !== "Meat");
        }

        // We want to filter for whole foods/fresh produce to give better recommendations
        // But we also want to show newly added records that might not have a category yet.
        const query = {
            [nutrient]: { $gt: 0 },
            $or: [
                { category: { $in: allowedCategories } },
                { category: { $exists: false } },
                { category: "" },
                { category: null }
            ]
        };

        if (search) {
            query.ingredient_name = { $regex: search, $options: 'i' };
        }

        const results = await IngredientConversion.find(query)
            .sort({ [nutrient]: -1 })
            .limit(12)
            .lean();

        return res.status(200).json({ success: true, data: results });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
