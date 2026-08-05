import dbConnect from '../../../lib/dbConnect';
import DailyLog from '../../../models/DailyLog';
import { verifyToken } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';
import { logSearchAndGetConversion } from '../../../lib/searchLogger';

const NUTRIENT_KEYS = [
    'energy_kcal', 'protein_g', 'fat_g', 'carbohydrates_g', 'fiber_g',
    'vitamin_a_ug', 'vitamin_b1_mg', 'vitamin_b2_mg', 'vitamin_b3_mg',
    'vitamin_b6_mg', 'vitamin_b12_ug', 'vitamin_c_mg', 'vitamin_d_ug',
    'vitamin_e_mg', 'vitamin_k_ug',
    'calcium_mg', 'iron_mg', 'magnesium_mg', 'phosphorus_mg',
    'potassium_mg', 'sodium_mg', 'zinc_mg'
];

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    logAPI(req);

    await dbConnect();

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { date } = req.body;
    if (!date) return res.status(400).json({ success: false, message: "Date is required" });

    const userId = decoded.id;
    const edgeToken = req.headers.edgetoken || "";

    try {
        const log = await DailyLog.findOne({ user_id: userId, date });
        if (!log) return res.status(404).json({ success: false, message: "No log found for this date" });

        const { normalizeToGrams } = require('../../../lib/conversion');

        await Promise.all((log.items || []).map(async (item) => {
            const conv = await logSearchAndGetConversion(item.name, null, true, "", edgeToken);
            if (!conv) return;

            const { value: grams } = normalizeToGrams(item.quantity_unit, item.quantity, conv.grams_per_each);
            const ratio = (grams ?? item.quantity) / 100;

            const nutrients = {};
            NUTRIENT_KEYS.forEach(k => { nutrients[k] = (conv[k] || 0) * ratio; });

            item.nutrients = nutrients;
        }));

        await log.save();

        return res.status(200).json({ success: true, log });
    } catch (err) {
        console.error("Error recomputing DailyLog nutrients:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
