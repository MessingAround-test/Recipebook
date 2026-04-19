import mongoose from 'mongoose';

const ShoppingListItem = new mongoose.Schema(
    {
        id: { type: mongoose.ObjectId, unique: true, dropDups: true, index: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        quantity_type: { type: String, required: true },
        quantity_unit: { type: String, required: false },
        category: { type: String, required: false },
        shoppingListId: { type: String, required: true },
        selectedIngredientId: { type: String, required: false },
        recipe_id: { type: String, required: false },
        recipe_name: { type: String, required: false },
        complete: { type: Boolean, required: true },
        createdBy: { type: String, required: true },
        deleted: { type: Boolean, required: false },
        note: { type: String, required: false },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, autoIndex: false }
)



// IngredSchema.index({ name: 'text'});
// mongoose.model('IngredSchema', IngredSchema).createIndexes();


delete mongoose.models.ShoppingListItem;
export default mongoose.model('ShoppingListItem', ShoppingListItem)