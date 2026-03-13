import mongoose from 'mongoose';

const SearchLogSchema = new mongoose.Schema(
    {
        search_term: { type: String, required: true, index: true },
        quantity_type: { type: String, required: false },
        source: { type: String, required: true, index: true },
        success: { type: Boolean, required: true },
        error_message: { type: String, required: false },
        last_fetched: { type: Date, default: Date.now },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// We want to keep a history of searches, so we remove the unique index on search_term + source
// SearchLogSchema.index({ search_term: 1, source: 1 }, { unique: true });

export default mongoose.models.SearchLog || mongoose.model('SearchLog', SearchLogSchema);
