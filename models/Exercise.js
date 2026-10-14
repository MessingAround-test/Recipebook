import mongoose from 'mongoose';

const ExerciseSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    muscle_group: { type: String, default: 'other', trim: true },
    is_custom: { type: Boolean, default: false }
}, {
    timestamps: true
});

ExerciseSchema.index({ user_id: 1, name: 1 });

export default mongoose.models.Exercise || mongoose.model('Exercise', ExerciseSchema);
