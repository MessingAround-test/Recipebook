import mongoose from 'mongoose'

const DishListSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        description: { type: String, required: false },
        // Where the list came from. `tasteatlas` lists are the ribbon/awards
        // pages; `manual` lists are user-built; `custom` is a pasted URL set.
        sourceType: { type: String, enum: ['tasteatlas', 'manual', 'custom'], default: 'manual' },
        sourceUrl: { type: String, required: false },
        // Dietary criteria the user chose when building/searching the list,
        // e.g. ['vegetarian', 'pescetarian']. Used to shape recipe searches.
        dietaryFilters: { type: [String], default: [] },
        createdBy: { type: String, required: false },
        isSystem: { type: Boolean, default: false }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

export default mongoose.models.DishList || mongoose.model('DishList', DishListSchema)
