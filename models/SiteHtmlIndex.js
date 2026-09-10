import mongoose from 'mongoose'

/**
 * Cache of the pre-parse stage for a given URL page: candidate sections
 * located via the synonym dictionary, plus the trimmed HTML fragments used
 * for AI rule generation. One document per (domain, normalized path).
 *
 * htmlHash detects layout drift; synonymsVersion invalidates entries when
 * the synonym dictionary changes.
 */
const candidateSchema = new mongoose.Schema(
    {
        cssPath: { type: String, required: true },
        score: { type: Number, default: 0 },
        charCount: { type: Number, default: 0 },
        snippetHash: { type: String }
    },
    { _id: false }
)

const SiteHtmlIndexSchema = new mongoose.Schema(
    {
        domain: { type: String, index: true, required: true },
        pageSignature: { type: String, index: true, required: true },
        htmlHash: { type: String, required: true },
        synonymsVersion: { type: Number, required: true },
        candidates: {
            ingredients: [candidateSchema],
            instructions: [candidateSchema],
            notes: [candidateSchema]
        },
        fragments: { type: mongoose.Schema.Types.Mixed, default: {} },
        preParseMs: { type: Number },
        lastUsedAt: { type: Date, default: Date.now }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

SiteHtmlIndexSchema.index({ pageSignature: 1, htmlHash: 1, synonymsVersion: 1 })

delete mongoose.models.SiteHtmlIndex
export default mongoose.model('SiteHtmlIndex', SiteHtmlIndexSchema)
