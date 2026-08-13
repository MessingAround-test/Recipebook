import mongoose from 'mongoose'

const HiddenItemSchema = new mongoose.Schema(
    {
        pattern: { type: String, required: true, unique: true, index: true },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)

export default mongoose.models.HiddenItem || mongoose.model('HiddenItem', HiddenItemSchema)
