import mongoose from 'mongoose'

// Per-pairing feedback: did a given side go well with a given main dish?
// Default liked: true (picking it is an implicit yes; failing the dish is the
// explicit signal). Recommendations rank these first.
const SidePairingSchema = new mongoose.Schema(
    {
        userId: { type: String, index: true, required: true },
        mainRecipeId: { type: String, required: true, index: true },
        sideRecipeId: { type: String, required: true },
        liked: { type: Boolean, default: true },
        timesUsed: { type: Number, default: 1 },
        note: { type: String }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

SidePairingSchema.index(
    { userId: 1, mainRecipeId: 1, sideRecipeId: 1 },
    { unique: true }
)

delete mongoose.models.SidePairing
export default mongoose.models.SidePairing || mongoose.model('SidePairing', SidePairingSchema)
