import mongoose from 'mongoose'

const RecipeImageSchema = new mongoose.Schema(
    {
        recipeId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        quality: { type: String, enum: ['full', 'thumb'], required: true },
        mime: { type: String, required: true },
        data: { type: Buffer, required: true },
        width: { type: Number },
        height: { type: Number },
        bytes: { type: Number }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

RecipeImageSchema.index({ recipeId: 1, quality: 1 }, { unique: true })

delete mongoose.models.RecipeImage
export default mongoose.model('RecipeImage', RecipeImageSchema)
