import mongoose from 'mongoose';


const ShoppingList = new mongoose.Schema(
    {
        id: { type: mongoose.ObjectId, unique: true, dropDups: true, index: true },
        name: { type: String, required: true },
        createdBy: { type: String, required: false },
        deleted: { type: Boolean, required: false },
        note: { type: String, required: false },
        complete: { type: Boolean, required: true },
        image: { type: String },
        cost: { type: Number },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, autoIndex: false }
)



export default mongoose.models.ShoppingList || mongoose.model('ShoppingList', ShoppingList)