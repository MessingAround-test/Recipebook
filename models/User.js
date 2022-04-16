import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, index: true, required: true},
    email: { type: String, unique: true, index: true, required: true },
    password: String,
    role: { type: String, required: true },
    approved: { type: Boolean, required: true },
    passwordHash: String,
    environment: {type: String},

  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)

module.exports = mongoose.models.User || mongoose.model('User', UserSchema)