import mongoose from 'mongoose';

const IngredientConversionSchema = new mongoose.Schema(
    {
        ingredient_name: { type: String, required: true, index: true, unique: true },
        grams_per_each: { type: Number, required: true },
        last_updated: { type: Date, default: Date.now },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.IngredientConversion || mongoose.model('IngredientConversion', IngredientConversionSchema);
