import mongoose from 'mongoose'

// Per-user tick-off state for a dish-list item. The dish itself is shared (a
// system list is the same for everyone), but "I cooked this" is personal, so the
// mark lives here keyed by (item, user) instead of on DishListItem.
const DishListItemCookedSchema = new mongoose.Schema(
    {
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'DishListItem', required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        cookedAt: { type: Date, default: Date.now }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

DishListItemCookedSchema.index({ itemId: 1, userId: 1 }, { unique: true })

export default mongoose.models.DishListItemCooked || mongoose.model('DishListItemCooked', DishListItemCookedSchema)
