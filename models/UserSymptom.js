import mongoose from 'mongoose';

const UserSymptomSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    usage_count: { type: Number, default: 1 }
}, {
    timestamps: true
});

UserSymptomSchema.index({ user_id: 1, name: 1 }, { unique: true });
UserSymptomSchema.index({ user_id: 1, name: 'text' });

export default mongoose.models.UserSymptom || mongoose.model('UserSymptom', UserSymptomSchema);
