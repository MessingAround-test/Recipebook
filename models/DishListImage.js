import mongoose from 'mongoose'

// Byte-store for dish-list thumbnails, mirroring RecipeImage so list images
// survive even if the TasteAtlas CDN url changes or is taken down.
const DishListImageSchema = new mongoose.Schema(
    {
        itemId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        quality: { type: String, enum: ['full', 'thumb'], required: true },
        mime: { type: String, required: true },
        data: { type: Buffer, required: true },
        width: { type: Number },
        height: { type: Number },
        bytes: { type: Number }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

DishListImageSchema.index({ itemId: 1, quality: 1 }, { unique: true })

export default mongoose.models.DishListImage || mongoose.model('DishListImage', DishListImageSchema)
