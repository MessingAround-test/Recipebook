import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema(
    {
        description: {type: String, required: true},
        amount: {type: Number, required: true}, 
        category: {type: String, required: true},
        frequency: {type: Number, required: true},
        frequency_type: {type: String, required: true},
        start_date: {type: Date, required: false},
        finish_date: {type: Date, required: false},
        user_id: {type: String, required: true}
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, autoIndex: false }
)

// IngredSchema.index({ name: 'text'});
// mongoose.model('IngredSchema', IngredSchema).createIndexes();

module.exports = mongoose.models.TransactionSchema || mongoose.model('TransactionSchema', TransactionSchema)