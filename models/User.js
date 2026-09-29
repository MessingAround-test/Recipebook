import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, index: true, required: true },
    email: { type: String, unique: true, index: true, required: true },
    role: { type: String, required: true },
    approved: { type: Boolean, required: true },
    passwordHash: String,
    environment: { type: String },
    age: { type: Number },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    weight_kg: { type: Number },
    height_cm: { type: Number },
    activity_level: { type: String, enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'] },
    dietary_preference: { type: String, enum: ['none', 'vegetarian', 'vegan', 'pescetarian'], default: 'none' },
    dietary_restrictions: { type: [String], enum: ['gluten_free', 'dairy_free', 'nut_free', 'low_fodmap', 'kosher', 'halal'], default: [] },
    daily_exercise_kj: { type: Number, default: 0 },
    target_weight_kg: { type: Number },
    weekly_goal_kg: { type: Number },
    health_score_config: { type: mongoose.Schema.Types.Mixed },
    // Per-user feature access: { recipes: true, shoppingList: false, ... }.
    // No schema default: absence (undefined) marks a pre-feature legacy account,
    // while signup explicitly writes {} so new users are distinguishable.
    features: { type: mongoose.Schema.Types.Mixed },
    // null => user has not completed feature onboarding yet; undefined => legacy
    features_onboarded_at: { type: Date },
    carbHistory: [new mongoose.Schema({
        type: { type: String, required: true },
        variant: String,
        at: { type: Date, default: Date.now }
    }, { _id: false })],

  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)

// Force re-registration so schema changes (e.g. per-user features) take effect
// on hot-reload instead of reusing a stale cached model.
delete mongoose.models.User
export default mongoose.model('User', UserSchema)