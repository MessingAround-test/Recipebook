import mongoose from 'mongoose';

const IngredSchema = new mongoose.Schema(
    {
        name: {type: String, required: true},
        ww_data: {type: mongoose.Schema.Types.Mixed}
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)

module.exports = mongoose.models.IngredSchema || mongoose.model('IngredSchema', IngredSchema)