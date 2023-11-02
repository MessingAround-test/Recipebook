import mongoose from 'mongoose';

const ShoppingListItem = new mongoose.Schema(
    {
        id: {type: mongoose.ObjectId, unique: true, dropDups: true , index: true},
        name:  {type: String, required: true},
        shoppingListId: {type: String, required: true},
        selectedIngredientId: {type: String, required: false}, 
        complete: {type: Boolean, required: true},
        createdBy: {type: String, required: true},
        deleted: {type: Boolean, required: false},
        note: {type: String, required: false},
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, autoIndex: false }
)



// IngredSchema.index({ name: 'text'});
// mongoose.model('IngredSchema', IngredSchema).createIndexes();


module.exports = mongoose.models.ShoppingListItem || mongoose.model('ShoppingListItem', ShoppingListItem)