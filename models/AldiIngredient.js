import mongoose from 'mongoose';

const AldiIngredient = new mongoose.Schema(
    {
        id: {type: String, unique: true, dropDups: true, index: true },
        name: {type: String, required: true, index: true},
        endpoint: {type: String, required: true}, 
        price: {type: Number, required: false},
        unit_price: {type: Number, required: false},
        quantity: {type: Number, required: false},
        quantity_type: {type: String, required: false},
        quantity_unit: {type: String, required: false}
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, autoIndex: false }
)



// IngredSchema.index({ name: 'text'});
// mongoose.model('IngredSchema', IngredSchema).createIndexes();


module.exports = mongoose.models.AldiIngredient || mongoose.model('AldiIngredient', AldiIngredient)