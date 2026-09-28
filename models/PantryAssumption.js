import mongoose from 'mongoose';
import { SEED_PANTRY_ASSUMPTIONS, PLANNING_BUCKETS, PLANNING_BUCKET_ORDER } from '../lib/pantryPlanning';

const VALID_BUCKETS = PLANNING_BUCKET_ORDER;

const PantryAssumptionSchema = new mongoose.Schema(
    {
        // 'name' = match against the ingredient name, 'category' = match the
        // item's broad category.
        type: { type: String, enum: ['name', 'category'], required: true },
        match: { type: String, enum: ['exact', 'contains'], default: 'contains' },
        value: { type: String, required: true, index: true },
        // Optional words that cancel a 'contains' match (e.g. 'bell' on pepper).
        exclude: { type: [String], default: [] },
        bucket: { type: String, enum: VALID_BUCKETS, required: true },
        priority: { type: Number, default: 50 },
        active: { type: Boolean, default: true },
        isSystem: { type: Boolean, default: false },
        createdBy: { type: String },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

PantryAssumptionSchema.index({ type: 1, value: 1 }, { unique: true });

/**
 * Seeds the default rules on first use. Uses $setOnInsert so admin edits to a
 * seeded rule are never overwritten, and new defaults are added over time.
 */
PantryAssumptionSchema.statics.seedIfNeeded = async function () {
    try {
        for (const seed of SEED_PANTRY_ASSUMPTIONS) {
            await this.updateOne(
                { type: seed.type, value: seed.value },
                { $setOnInsert: { ...seed, isSystem: true } },
                { upsert: true }
            );
        }
    } catch (e) {
        // Concurrent upsert races (E11000) are harmless on a unique key.
        if (e && e.code !== 11000) console.warn('PantryAssumption seed skipped:', e.message);
    }
};

export { PLANNING_BUCKETS };
export default mongoose.models.PantryAssumption || mongoose.model('PantryAssumption', PantryAssumptionSchema);
