import mongoose from 'mongoose'
import { SEED_CARB_TYPES } from '../lib/carbSideOps'

const carbTimingSchema = new mongoose.Schema({
    cookMinutes: { type: Number, default: 15 },
    prepMinutes: { type: Number, default: 5 }
}, { _id: false })

const carbPhaseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    minutes: { type: Number, default: 0, min: 0 },
    instruction: { type: String, default: '' }
}, { _id: false })

/** Cups per person, used to fill {qty:<field>} tokens in phase instructions
 *  (eg rice White: 1/4 cup rice + 1/2 cup water per serve). */
const perServeSchema = new mongoose.Schema({}, { _id: false, strict: false })

const CarbTypeSchema = new mongoose.Schema(
    {
        name: { type: String, unique: true, index: true, required: true },
        aliases: { type: [String], default: [] },
        timing: carbTimingSchema,
        phases: [carbPhaseSchema],
        perServe: perServeSchema,
        variants: [new mongoose.Schema({
            name: { type: String, required: true },
            cookMinutes: { type: Number, default: 15 },
            prepMinutes: { type: Number, default: 5 },
            perServe: perServeSchema,
            phases: [carbPhaseSchema]
        }, { _id: false })],
        defaultStepText: { type: String },
        createdBy: { type: String },
        order: { type: Number, default: 50 },
        active: { type: Boolean, default: true },
        isSystem: { type: Boolean, default: false }
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)

CarbTypeSchema.statics.seedIfNeeded = async function () {
    let seeded = false
    try {
        // Lazy upgrade path: catalog entries seeded before phases existed
        // (a timing-only shape) get the system phases backfilled. Admin
        // entries and already-phase'd system entries are left untouched.
        for (const seed of SEED_CARB_TYPES) {
            const doc = await this.findOne({ name: seed.name }).lean()
            if (!doc) {
                await this.create({
                    ...seed,
                    variants: seed.variants ? seed.variants.map(v => ({ ...v })) : undefined,
                    timing: seed.timing ? { ...seed.timing } : undefined
                })
                seeded = true
                continue
            }
            const wantsVariantPhases = (seed.variants || []).length > 0
            const variantsMissingPhases = docsMissingVariantPhases(doc, seed)
            if (wantsVariantPhases && variantsMissingPhases) {
                await this.updateOne({ _id: doc._id }, { $set: { variants: seed.variants.map(v => ({ ...v })) } })
            } else if (!wantsVariantPhases && (!Array.isArray(doc.phases) || doc.phases.length === 0) && (seed.phases || []).length > 0) {
                await this.updateOne({ _id: doc._id }, { $set: { phases: seed.phases.map(p => ({ ...p })) } })
            }
        }

        const count = await this.countDocuments({})
        if (count === 0) {
            await this.insertMany(
                SEED_CARB_TYPES.map(entry => ({
                    ...entry,
                    variants: entry.variants ? entry.variants.map(v => ({ ...v })) : undefined,
                    timing: entry.timing ? { ...entry.timing } : undefined
                })),
                { ordered: false }
            )
            seeded = true
        }
    } catch (e) {
        // Concurrent seed races are harmless — another worker got there first
        console.warn('CarbType seed skipped:', e.message)
    }
    return seeded
}

/** True when any seeded variant is missing its phase list. */
function docsMissingVariantPhases(doc, seed) {
    for (const seedVariant of seed.variants || []) {
        const existing = (doc.variants || []).find(v => v.name === seedVariant.name)
        if (!existing || !Array.isArray(existing.phases) || existing.phases.length === 0) return true
    }
    return false
}

export default mongoose.models.CarbType || mongoose.model('CarbType', CarbTypeSchema)
