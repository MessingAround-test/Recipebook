import mongoose from 'mongoose'

/**
 * One document per scrape attempt (success or failure). Lets admins see how
 * each import was extracted (jsonld / stored-rule / heuristic / ai-generated),
 * which rules resolved it, fetch fallbacks and errors. Auto-expires after
 * 90 days.
 */
const ScrapeLogSchema = new mongoose.Schema(
    {
        domain: { type: String, index: true, required: true },
        url: { type: String, required: true },
        pageSignature: { type: String },
        htmlHash: { type: String },
        extractionTier: {
            type: String,
            enum: ['jsonld', 'stored-rule', 'heuristic', 'ai-generated'],
            required: false
        },
        ruleId: { type: String },
        heuristicUsed: { type: Boolean, default: false },
        aiUsed: { type: Boolean, default: false },
        sourceFallback: { type: String, enum: ['browser', 'curl'], default: 'browser' },
        ingredientCount: { type: Number, default: 0 },
        instructionCount: { type: Number, default: 0 },
        hasSourceNotes: { type: Boolean, default: false },
        tookMs: { type: Number },
        success: { type: Boolean, required: true },
        errorMessage: { type: String },
        created_at: { type: Date, expires: '90d', default: Date.now }
    }
)

ScrapeLogSchema.index({ domain: 1, created_at: -1 })
ScrapeLogSchema.index({ success: 1, created_at: -1 })

delete mongoose.models.ScrapeLog
export default mongoose.model('ScrapeLog', ScrapeLogSchema)
