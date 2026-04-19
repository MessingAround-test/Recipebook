import mongoose from 'mongoose'

const ingredsSchema = new mongoose.Schema(
    {
        Name: { type: String, index: true, required: true },
        AmountType: { type: String, required: true },
        Amount: { type: Number, required: true },
        note: { type: String }
    }
)

const instructionsSchema = new mongoose.Schema(
    {
        // InstructionN: {type: Number, required: true},
        Text: { type: String, required: true },
        time: { type: Number },
        note: { type: String }
    }
)


const RecipeSchema = new mongoose.Schema(
    {
        creator_username: { type: String, index: true, required: false },
        creator_email: { type: String, required: false },
        name: { type: String, required: true },
        ingredients: [ingredsSchema],
        instructions: [instructionsSchema],
        image: { type: String },
        cost: { type: Number },
        approxCost: { type: Number, required: false }, // Store the initial calculated cost
        time: { type: String, enum: ['short', 'medium', 'long'], required: false },
        genre: { type: String, required: false },
        priceCategory: { type: String, enum: ['cheap', 'medium', 'expensive'], required: false },
        timesCooked: { type: Number, default: 0 },
        feedback: { type: String, required: false }
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)
delete mongoose.models.Recipe;
export default mongoose.model('Recipe', RecipeSchema)