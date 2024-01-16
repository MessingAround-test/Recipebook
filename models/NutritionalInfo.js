import mongoose from 'mongoose';

const NutritionalInfo = new mongoose.Schema(
    {
        id: {type: mongoose.ObjectId, unique: true, dropDups: true , index: true},
        name: {type: String, required: true, index: true},
        extra_info: {type: String, required: false},
        source: {type: String, required: true}, 
        quantity: {type: Number, required: false},
        quantity_type: {type: String, required: false},
        quantity_unit: {type: String, required: false},
        nutrition_info: {type: Object, required: false}
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, autoIndex: false }
)



// IngredSchema.index({ name: 'text'});
// mongoose.model('IngredSchema', IngredSchema).createIndexes();


module.exports = mongoose.models.NutritionalInfo || mongoose.model('NutritionalInfo', NutritionalInfo)