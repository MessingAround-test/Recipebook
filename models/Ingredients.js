import mongoose from 'mongoose';

const IngredSchema = new mongoose.Schema(
    {
        id: {type: String, unique: true, dropDups: true },
        name: {type: String, required: true},
        source: {type: String, required: true}, 
        price: {type: Number, required: false},
        unit_price: {type: Number, required: false},
        quantity: {type: Number, required: false},
        quantity_type: {type: String, required: false},
        quantity_unit: {type: String, required: false},
        search_term: {type: String, required: true},
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, autoIndex: false }
)



// IngredSchema.index({ name: 'text'});
// mongoose.model('IngredSchema', IngredSchema).createIndexes();


module.exports = mongoose.models.IngredSchema || mongoose.model('IngredSchema', IngredSchema)