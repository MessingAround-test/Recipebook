import mongoose from 'mongoose';

const AIResultCacheSchema = new mongoose.Schema({
    search_term: {
        type: String,
        required: true,
        index: true
    },
    input_hash: {
        type: String,
        required: true,
        index: true
    },
    results: {
        type: [String],
        required: true
    },
    last_updated: {
        type: Date,
        default: Date.now
    }
});

// Compound index for efficient lookup
AIResultCacheSchema.index({ search_term: 1, input_hash: 1 });

export default mongoose.models.AIResultCache || mongoose.model('AIResultCache', AIResultCacheSchema);
