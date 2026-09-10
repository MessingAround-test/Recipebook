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

const prepWorkSchema = new mongoose.Schema({
    ingredient: { type: String },
    action: { type: String, required: true },
    timeEstimate: { type: Number },
    isCustom: { type: Boolean, default: false },
    optional: { type: Boolean, default: false },
    fromNote: { type: Boolean, default: false }
})

const timerDependencySchema = new mongoose.Schema({
    timerId: { type: String, required: true },
    offset: { type: Number, default: 0 }
}, { _id: false })

const cookingTimerSchema = new mongoose.Schema({
    id: { type: String },
    type: { type: String, enum: ['timer', 'checkpoint'], default: 'timer' },
    name: { type: String, required: true },
    duration: { type: Number, required: true },
    dependencies: [timerDependencySchema],
    parentTimerId: { type: String },
    order: { type: Number, default: 0 },
    stepIndex: { type: Number },
    notes: { type: String }
}, { _id: false })

const carbSideSchema = new mongoose.Schema({
    needs: { type: Boolean, default: false },
    state: { type: String, enum: ['pending', 'analyzed'], default: 'pending' },
    type: { type: String },
    customName: { type: String },
    stepText: { type: String },
    phases: [new mongoose.Schema({
        name: { type: String, required: true },
        minutes: { type: Number, default: 0 },
        instruction: { type: String, default: '' },
        insertAfter: { type: Number }
    }, { _id: false })],
    timeMinutes: { type: Number },
    insertAfter: { type: Number },
    analysis: {
        alreadyInInstructions: { type: Boolean },
        matchedStepIndex: { type: Number },
        note: { type: String }
    },
    analyzedAt: { type: Date },
    analysisModel: { type: String }
}, { _id: false })

const RecipeSchema = new mongoose.Schema(
    {
        creator_username: { type: String, index: true, required: false },
        creator_email: { type: String, required: false },
        name: { type: String, required: true },
        ingredients: [ingredsSchema],
        instructions: [instructionsSchema],
        prepWork: [prepWorkSchema],
        prepWorkChecked: { type: Boolean, default: false },
        prepWorkNotesHash: { type: String },
        cookingTimers: [cookingTimerSchema],
        timersChecked: { type: Boolean, default: false },
        hasImage: { type: Boolean, default: false },
        cost: { type: Number },
        approxCost: { type: Number, required: false },
        unitCost: { type: Number, required: false },
        time: { type: String, enum: ['short', 'medium', 'long'], required: false },
        genre: { type: String, required: false },
        mealTypes: { type: [String], required: false },
        carbType: { type: String, enum: ['Rice', 'Bread/Wraps', 'Pasta/Noodles', 'Potato', 'Quinoa', 'None/Other'], required: false },
        carbSide: carbSideSchema,
        priceCategory: { type: String, enum: ['cheap', 'medium', 'expensive'], required: false },
        timesCooked: { type: Number, default: 0 },
        hidden: { type: Boolean, default: false },
        feedback: { type: String, required: false },
        servings: { type: Number, required: false },
        sourceUrl: { type: String, required: false }
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)
delete mongoose.models.Recipe;
export default mongoose.model('Recipe', RecipeSchema)