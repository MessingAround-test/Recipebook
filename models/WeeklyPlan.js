import mongoose from 'mongoose';

const EverydayItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    quantity_unit: { type: String },
    recipe_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: false },
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
    }
});

const PlannedRecipeSchema = new mongoose.Schema({
    recipe_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: false },
    recipe_name: { type: String, required: true },
    servings: { type: Number, required: true },
    day: { type: String, required: true }, // e.g. 'Monday' or specific date
    mealType: { type: String, enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'], required: true },
    isLeftover: { type: Boolean, default: false },
    isVague: { type: Boolean, default: false } // For "vague lunches"
});

const WeeklyPlanSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startDate: { type: String, required: true, index: true }, // YYYY-MM-DD representing the start of the week (e.g. Monday)
    defaultServings: { type: Number, default: 2 },
    plannedRecipes: [PlannedRecipeSchema],
    everydayItems: [EverydayItemSchema]
}, { 
    timestamps: true 
});

// Ensure a unique document per user per week
WeeklyPlanSchema.index({ user_id: 1, startDate: 1 }, { unique: true });

export default mongoose.models.WeeklyPlan || mongoose.model('WeeklyPlan', WeeklyPlanSchema);
