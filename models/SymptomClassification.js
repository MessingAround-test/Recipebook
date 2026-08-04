import mongoose from 'mongoose';

const SymptomClassificationSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, enum: ['positive', 'negative', 'neutral', 'none'], default: 'none' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

export default mongoose.models.SymptomClassification || mongoose.model('SymptomClassification', SymptomClassificationSchema);
