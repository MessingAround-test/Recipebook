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
        note: { type: String },
        // How much attention the cook needs during this step:
        // none = walk away, low = check in occasionally, active = hands-on.
        // Edited by hand in the Timing section; unset shows nothing.
        involvement: { type: String, enum: ['none', 'low', 'active'] }
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
    // How much attention the cook needs during this timer:
    // none = walk away, low = stay in the kitchen and check in occasionally,
    // active = hands-on involvement. Defaults to the safe assumption.
    involvement: { type: String, enum: ['none', 'low', 'active'], default: 'active' },
    dependencies: [timerDependencySchema],
    parentTimerId: { type: String },
    order: { type: Number, default: 0 },
    stepIndex: { type: Number },
    notes: { type: String }
}, { _id: false })

// Optional overlay links back to the explore "dish lists" a recipe was
// imported for. Nothing else reads this — it exists only so the recipe page
// can show an "On list" badge. Removing it must never break a recipe.
const dishListRefSchema = new mongoose.Schema({
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'DishList' },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'DishListItem' },
    listName: { type: String }
}, { _id: false })

// Optional geo data for the "where is this dish from" world map.
const recipeLocationSchema = new mongoose.Schema({
    country: { type: String },
    region: { type: String },
    city: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    // Set when an origin search ran but found nothing confidently. Shown in the
    // editor so it isn't silently retried every time the recipe is opened.
    regionSearchFailed: { type: Boolean, default: false }
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
        rating: { type: Number, min: 0.5, max: 5 },
        hidden: { type: Boolean, default: false },
        feedback: { type: String, required: false },
        sourceNotes: { type: String, required: false },
        servings: { type: Number, required: false },
        sourceUrl: { type: String, required: false },
        // Explore overlay (additive, optional). See dishListRefSchema.
        dishListRefs: { type: [dishListRefSchema], required: false },
        location: { type: recipeLocationSchema, required: false }
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
)
delete mongoose.models.Recipe;
export default mongoose.model('Recipe', RecipeSchema)