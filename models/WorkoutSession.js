import mongoose from 'mongoose';

const LoggedSetSchema = new mongoose.Schema({
    set_number: { type: Number, required: true },
    planned_reps: { type: Number, default: null, min: 1 },
    planned_weight_kg: { type: Number, default: null, min: 0 },
    planned_duration_sec: { type: Number, default: null, min: 1 },
    actual_reps: { type: Number, default: null, min: 1 },
    actual_weight_kg: { type: Number, default: null, min: 0 },
    actual_duration_sec: { type: Number, default: null, min: 1 },
    is_failure: { type: Boolean, default: false },
    completed_at: { type: String, default: null }
}, { _id: false });

const SessionExerciseSchema = new mongoose.Schema({
    exercise_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    name_snapshot: { type: String, required: true },
    muscle_group: { type: String, default: '' },
    order: { type: Number, default: 0 },
    target_sets: { type: Number, required: true, min: 1, max: 30 },
    rep_mode: { type: String, enum: ['reps', 'failure', 'timed'], default: 'reps' },
    target_reps: { type: Number, default: null, min: 1 },
    target_duration_sec: { type: Number, default: null, min: 1, max: 7200 },
    target_weight_kg: { type: Number, default: null, min: 0 },
    sets: [LoggedSetSchema]
}, { _id: false });

const WorkoutSessionSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutPlan', default: null },
    plan_name_snapshot: { type: String, default: '' },
    date: { type: String, required: true, index: true },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
    started_at: { type: Date, default: Date.now },
    completed_at: { type: Date, default: null },
    // null = no auto break timer; number = seconds of rest between logged sets.
    rest_seconds: { type: Number, default: null, min: 0, max: 1800 },
    order_mode: { type: String, enum: ['sequential', 'circuit'], default: 'sequential' },
    estimated_kcal: { type: Number, default: null },
    exercises: [SessionExerciseSchema]
}, {
    timestamps: true
});

WorkoutSessionSchema.index({ user_id: 1, date: -1 });
WorkoutSessionSchema.index({ user_id: 1, status: 1, date: -1 });

export default mongoose.models.WorkoutSession || mongoose.model('WorkoutSession', WorkoutSessionSchema);
