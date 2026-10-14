import mongoose from 'mongoose';

const PlanItemSchema = new mongoose.Schema({
    exercise_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    order: { type: Number, default: 0 },
    target_sets: { type: Number, required: true, min: 1, max: 30 },
    rep_mode: { type: String, enum: ['reps', 'failure', 'timed'], default: 'reps' },
    target_reps: { type: Number, default: null, min: 1 },
    target_duration_sec: { type: Number, default: null, min: 1, max: 7200 },
    target_weight_kg: { type: Number, default: null, min: 0 }
}, { _id: false });

const WorkoutPlanSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    items: [PlanItemSchema],
    is_archived: { type: Boolean, default: false }
}, {
    timestamps: true
});

WorkoutPlanSchema.index({ user_id: 1 });

export default mongoose.models.WorkoutPlan || mongoose.model('WorkoutPlan', WorkoutPlanSchema);
