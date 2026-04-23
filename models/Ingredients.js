import mongoose from 'mongoose';

const IngredSchema = new mongoose.Schema(
    {
        id: { type: String, unique: true, dropDups: true, index: true },
        name: { type: String, required: true, index: true },
        source: { type: String, required: true },
        price: { type: Number, required: false },
        unit_price: { type: Number, required: false },
        quantity: { type: Number, required: false },
        quantity_type: { type: String, required: false },
        quantity_unit: { type: String, required: false },
        search_term: { type: String, required: true },
        search_match_score: { type: Number, required: false },
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
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, autoIndex: false }
)



// IngredSchema.index({ name: 'text'});
// mongoose.model('IngredSchema', IngredSchema).createIndexes();


export default mongoose.models.IngredSchema || mongoose.model('IngredSchema', IngredSchema)