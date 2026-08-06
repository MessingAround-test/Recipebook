import mongoose from 'mongoose';

const SymptomLogSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, index: true },
    mood: { type: Number, min: 1, max: 10, default: null },
    symptoms: [{ name: { type: String, required: true }, auto: { type: Boolean, default: false } }],
    notes: { type: String, default: '' }
}, {
    timestamps: true
});

SymptomLogSchema.index({ user_id: 1, date: 1 }, { unique: true });

export default mongoose.models.SymptomLog || mongoose.model('SymptomLog', SymptomLogSchema);
