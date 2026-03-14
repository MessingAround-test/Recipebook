import mongoose from 'mongoose';

const ExtractionUsageSchema = new mongoose.Schema(
    {
        hour: { type: Date, required: true }, // Start of the hour
        type: { type: String, enum: ['CACHE', 'EXTRACTION'], required: true },
        count: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Unique index for aggregation performance and ensuring one row per type/hour
ExtractionUsageSchema.index({ hour: 1, type: 1 }, { unique: true });

export default mongoose.models.ExtractionUsage || mongoose.model('ExtractionUsage', ExtractionUsageSchema);
