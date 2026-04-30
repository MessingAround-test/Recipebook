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
    daily_exercise_kj: { type: Number, default: 0 },

  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)

export default mongoose.models.User || mongoose.model('User', UserSchema)