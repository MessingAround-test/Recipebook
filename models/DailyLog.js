import mongoose from 'mongoose';

const DailyLogItemSchema = new mongoose.Schema({
    type: { type: String, enum: ['ingredient', 'recipe'], required: true },
    name: { type: String, required: true },
    recipe_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' }, // Optional: only for type: 'recipe'
    recipe_name: { type: String }, // Optional: for grouping display
    quantity: { type: Number, required: true },
    quantity_unit: { type: String, required: true },
    // Snapshotted nutrients for history consistency
    nutrients: {
        energy_kcal: { type: Number, default: 0 },
        protein_g: { type: Number, default: 0 },
        fat_g: { type: Number, default: 0 },
        carbohydrates_g: { type: Number, default: 0 },
        fiber_g: { type: Number, default: 0 },
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
        calcium_mg: { type: Number, default: 0 },
        iron_mg: { type: Number, default: 0 },
        magnesium_mg: { type: Number, default: 0 },
        phosphorus_mg: { type: Number, default: 0 },
        potassium_mg: { type: Number, default: 0 },
        sodium_mg: { type: Number, default: 0 },
        zinc_mg: { type: Number, default: 0 },
    },
    logged_at: { type: Date, default: Date.now }
});

const DailyLogSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    items: [DailyLogItemSchema]
}, { 
    timestamps: true 
});

// Ensure a unique document per user per day
DailyLogSchema.index({ user_id: 1, date: 1 }, { unique: true });

export default mongoose.models.DailyLog || mongoose.model('DailyLog', DailyLogSchema);
