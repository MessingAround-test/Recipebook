import mongoose from 'mongoose'

/**
 * AI-generated (or seeded) scrape rules for a domain. A domain may hold
 * multiple rules — sites occasionally ship several layouts — so rules are
 * evaluated in confidence order until one validates.
 *
 * format:
 *  - "jsonld": schema.org Recipe via JSON-LD (rarely stored; reserved)
 *  - "css":    cheerio selectors (selectors.*) — the common case
 */
const selectorSetSchema = new mongoose.Schema(
    {
        name: { type: String },
        ingredients: {
            container: { type: String },
            item: { type: String },
            name: { type: String },
            amount: { type: String },
            unit: { type: String },
            note: { type: String }
        },
        instructions: {
            container: { type: String },
            item: { type: String },
            text: { type: String },
            note: { type: String }
        },
        notes: {
            container: { type: String },
            item: { type: String }
        }
    },
    { _id: false }
)

const ruleSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        format: { type: String, enum: ['css', 'jsonld'], default: 'css' },
        selectors: selectorSetSchema,
        confidence: { type: Number, default: 0.5 },
        successCount: { type: Number, default: 0 },
        failCount: { type: Number, default: 0 },
        exampleHtmlHash: { type: String },
        generatedBy: { type: String, default: 'ai' },
        createdAt: { type: Date, default: Date.now },
        lastUsedAt: { type: Date }
    },
    { _id: false }
)

const SiteScrapeRuleSchema = new mongoose.Schema(
    {
        domain: { type: String, index: true, required: true },
        rules: { type: [ruleSchema], default: [] }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

delete mongoose.models.SiteScrapeRule
export default mongoose.model('SiteScrapeRule', SiteScrapeRuleSchema)
