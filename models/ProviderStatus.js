import mongoose from 'mongoose'

const ProviderStatusSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, index: true },
        disabled: { type: Boolean, default: false },
        reason: { type: String, default: "" },
        updated_by: { type: String, default: "" },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)

export default mongoose.models.ProviderStatus || mongoose.model('ProviderStatus', ProviderStatusSchema)
