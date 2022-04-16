import mongoose from 'mongoose'

const ingredsSchema = new mongoose.Schema(
    {
        Name: {type: String, index: true, required: true},
        AmountType: {type: String, required: true},
        Amount: {type: Number, required: true},
        note: {type: String}
    }
)

const instructionsSchema = new mongoose.Schema(
    {
        // InstructionN: {type: Number, required: true},
        Text: {type: String, required: true},
        time: {type: Number},
        note: {type: String}
    }
)


const RecipeSchema = new mongoose.Schema(
    {
        creator_username: { type: String, index: true, required: true },
        creator_email: { type: String, required: true },
        ingredients : [ingredsSchema],
        instructions: [instructionsSchema],
        image: {type: String}
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)

module.exports = mongoose.models.Recipe || mongoose.model('Recipe', RecipeSchema)