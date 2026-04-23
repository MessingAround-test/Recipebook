import dbConnect from '../../../lib/dbConnect';
import { logSearchAndGetConversion } from '../../../lib/searchLogger';
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

        // 1. Get or Refresh global conversion factor (triggers AI if missing or old)
        const edgeToken = req.headers.edgetoken || "";
        const conversion = await logSearchAndGetConversion(search_term, null, true, "", edgeToken);

        if (!conversion) {
            return res.status(200).json({ success: true, res: { grams_per_each: 0, each_per_gram: 0 } });
        }

        const result = {
            grams_per_each: conversion.grams_per_each,
            each_per_gram: conversion.grams_per_each > 0 ? 1 / conversion.grams_per_each : 0,
            // Macros per 100g
            protein_g: conversion.protein_g || 0,
            fat_g: conversion.fat_g || 0,
            carbohydrates_g: conversion.carbohydrates_g || 0,
            fiber_g: conversion.fiber_g || 0,
            energy_kcal: conversion.energy_kcal || 0,
            // Vitamins per 100g
            vitamin_a_ug: conversion.vitamin_a_ug || 0,
            vitamin_b1_mg: conversion.vitamin_b1_mg || 0,
            vitamin_b2_mg: conversion.vitamin_b2_mg || 0,
            vitamin_b3_mg: conversion.vitamin_b3_mg || 0,
            vitamin_b6_mg: conversion.vitamin_b6_mg || 0,
            vitamin_b12_ug: conversion.vitamin_b12_ug || 0,
            vitamin_c_mg: conversion.vitamin_c_mg || 0,
            vitamin_d_ug: conversion.vitamin_d_ug || 0,
            vitamin_e_mg: conversion.vitamin_e_mg || 0,
            vitamin_k_ug: conversion.vitamin_k_ug || 0,
            // Minerals per 100g
            calcium_mg: conversion.calcium_mg || 0,
            iron_mg: conversion.iron_mg || 0,
            magnesium_mg: conversion.magnesium_mg || 0,
            phosphorus_mg: conversion.phosphorus_mg || 0,
            potassium_mg: conversion.potassium_mg || 0,
            sodium_mg: conversion.sodium_mg || 0,
            zinc_mg: conversion.zinc_mg || 0,
        };

        return res.status(200).json({ success: true, res: result });
    } catch (error) {
        console.error("SearchLogLookup failed:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
