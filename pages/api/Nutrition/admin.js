import dbConnect from '../../../lib/dbConnect';
import IngredientConversion from '../../../models/IngredientConversion';
import User from '../../../models/User';
import SearchLog from '../../../models/SearchLog';
import Ingredients from '../../../models/Ingredients';
import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger';

export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        await dbConnect();
        const user = await User.findById(decoded.id);
        const isAdmin = user && user.role === 'admin';

        if (req.method === 'GET') {
            const { search } = req.query;
            let query = {};
            if (search) {
                query.ingredient_name = { $regex: search, $options: 'i' };
            }
            const data = await IngredientConversion.find(query).sort({ ingredient_name: 1 }).limit(50);
            return res.status(200).json({ success: true, data });
        }

        // All other methods require admin privileges
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        if (req.method === 'PUT') {
            const { id, ...updateData } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'ID is required' });

            updateData.last_updated = Date.now();
            const updated = await IngredientConversion.findByIdAndUpdate(id, updateData, { new: true });
            if (!updated) return res.status(404).json({ success: false, message: 'Record not found' });

            return res.status(200).json({ success: true, data: updated });
        }

        if (req.method === 'POST') {
            const newData = req.body;
            const created = await IngredientConversion.create(newData);
            return res.status(201).json({ success: true, data: created });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ success: false, message: 'ID is required' });

            const item = await IngredientConversion.findById(id);
            if (!item) return res.status(404).json({ success: false, message: 'Record not found' });

            const ingredientName = item.ingredient_name;

            // Delete the main record
            await IngredientConversion.findByIdAndDelete(id);

            // Delete related search terms/logs and cached products
            // Using search_term to match in SearchLog and Ingredients
            await SearchLog.deleteMany({ search_term: ingredientName.toLowerCase().trim() });
            await Ingredients.deleteMany({ search_term: ingredientName.toLowerCase().trim() });

            return res.status(200).json({ success: true, message: `Record and all related search data for "${ingredientName}" deleted` });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Nutrition Admin API Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}
