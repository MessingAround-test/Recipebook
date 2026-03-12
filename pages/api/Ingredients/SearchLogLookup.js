import dbConnect from '../../../lib/dbConnect';
import SearchLog from '../../../models/SearchLog';
import IngredientConversion from '../../../models/IngredientConversion';
import { verifyToken } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';

export default async function handler(req, res) {
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    logAPI(req)

    const { search_term } = req.query;
    if (!search_term) {
        return res.status(400).json({ success: false, message: "search_term is required" });
    }

    try {
        await dbConnect();

        // Find the global conversion factor for this search term
        const conversion = await IngredientConversion.findOne({
            ingredient_name: search_term.toLowerCase()
        }).exec();

        if (!conversion) {
            return res.status(200).json({ success: true, res: { grams_per_each: 0, each_per_gram: 0 } });
        }

        const result = {
            grams_per_each: conversion.grams_per_each,
            each_per_gram: conversion.grams_per_each > 0 ? 1 / conversion.grams_per_each : 0
        };

        return res.status(200).json({ success: true, res: result });
    } catch (error) {
        console.error("SearchLogLookup failed:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
