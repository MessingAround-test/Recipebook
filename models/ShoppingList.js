import mongoose from 'mongoose';


const ShoppingList = new mongoose.Schema(
    {
        id: {type: mongoose.ObjectId, unique: true, dropDups: true, index: true },
        name: {type: String, required: true},
        createdBy: {type: String, required: true},
        deleted: {type: Boolean, required: false},
        note: {type: String, required: false},
        complete: {type: Boolean, required: true},
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, autoIndex: false }
)



// IngredSchema.index({ name: 'text'});
// mongoose.model('IngredSchema', IngredSchema).createIndexes();


module.exports = mongoose.models.ShoppingList || mongoose.model('ShoppingList', ShoppingList)