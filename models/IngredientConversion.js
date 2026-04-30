import mongoose from 'mongoose';

const IngredientConversionSchema = new mongoose.Schema(
    {
        ingredient_name: { type: String, required: true, index: true, unique: true },
        grams_per_each: { type: Number, required: true },
        // Macros per 100g
        protein_g: { type: Number, default: 0 },
        fat_g: { type: Number, default: 0 },
        carbohydrates_g: { type: Number, default: 0 },
        fiber_g: { type: Number, default: 0 },
        energy_kcal: { type: Number, default: 0 },
        // Vitamins per 100g
        vitamin_a_ug: { type: Number, default: 0 },
        vitamin_b1_mg: { type: Number, default: 0 },
        vitamin_b2_mg: { type: Number, default: 0 },
        vitamin_b3_mg: { type: Number, default: 0 },
        vitamin_b6_mg: { type: Number, default: 0 },
        vitamin_b12_ug: { type: Number, default: 0 },
        vitamin_c_mg: { type: Number, default: 0 },
        vitamin_d_ug: { type: Number, default: 0 },
        vitamin_e_mg: { type: Number, default: 0 },
        vitamin_k_ug: { type: Number, default: 0 },
        // Minerals per 100g
        calcium_mg: { type: Number, default: 0 },
        iron_mg: { type: Number, default: 0 },
        magnesium_mg: { type: Number, default: 0 },
        phosphorus_mg: { type: Number, default: 0 },
        potassium_mg: { type: Number, default: 0 },
        sodium_mg: { type: Number, default: 0 },
        zinc_mg: { type: Number, default: 0 },
        category: { type: String },
        should_recommend: { type: Boolean, default: true },
        last_updated: { type: Date, default: Date.now },
        nutrients_version: { type: Number, default: 2 },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.IngredientConversion || mongoose.model('IngredientConversion', IngredientConversionSchema);
