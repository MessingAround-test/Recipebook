import mongoose from 'mongoose';

const ApiKeyUsageSchema = new mongoose.Schema(
    {
        keyIndex: { type: Number, required: true }, // 1, 2, 3
        modelType: { type: String, enum: ['PRIMARY', 'FALLBACK'], required: true },
        hour: { type: Date, required: true }, // Start of the hour (e.g., 2024-03-14T10:00:00.000Z)
        callCount: { type: Number, default: 0 },
        overloadCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Unique index to ensure one row per key/model per hour
ApiKeyUsageSchema.index({ keyIndex: 1, modelType: 1, hour: 1 }, { unique: true });

export default mongoose.models.ApiKeyUsage || mongoose.model('ApiKeyUsage', ApiKeyUsageSchema);
