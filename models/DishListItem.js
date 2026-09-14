import mongoose from 'mongoose'

// Where a dish is from / can be placed on a map. Country comes from the
// scraped list; region/city are optional (edited by hand). lat/lng are
// populated later by the geocoder when the world map is built.
const locationSchema = new mongoose.Schema(
    {
        country: { type: String, required: false },
        region: { type: String, required: false },
        city: { type: String, required: false },
        regionId: { type: String, required: false },
        lat: { type: Number, required: false },
        lng: { type: Number, required: false },
        // Set when we tried to resolve a region/city but found nothing
        // confidently. Surfaced only in the dish editor, never on the map.
        regionSearchFailed: { type: Boolean, default: false }
    },
    { _id: false }
)

const DishListItemSchema = new mongoose.Schema(
    {
        listId: { type: mongoose.Schema.Types.ObjectId, ref: 'DishList', required: true, index: true },
        // Stable identity within a list: the TasteAtlas slug (or a derived
        // slug for manually pasted URLs) so re-scraping is idempotent.
        slug: { type: String, required: true },
        rank: { type: Number, required: false },
        name: { type: String, required: true },
        category: { type: String, required: false },
        rating: { type: Number, required: false },
        location: { type: locationSchema, default: {} },
        description: { type: String, required: false },
        // Original CDN url kept only as a reference; the bytes live in
        // DishListImage so the list never hot-links TasteAtlas.
        imageOriginalUrl: { type: String, required: false },
        hasImage: { type: Boolean, default: false },
        // TasteAtlas dish page + optional authentic-recipe page
        sourceUrl: { type: String, required: false },
        recipeSourceUrl: { type: String, required: false },
        // Tick-off state. `cooked` is manual; the API also auto-derives it
        // from the linked recipe's timesCooked >= 1.
        cooked: { type: Boolean, default: false },
        cookedAt: { type: Date, required: false },
        notes: { type: String, required: false },
        // A dish can have several recipes (e.g. different takes/versions).
        // `recipeId` is kept as the most-recently linked one for compatibility.
        recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: false },
        recipeIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Recipe', default: [] },
        importStatus: { type: String, enum: ['none', 'linked'], default: 'none' },
        enrichedAt: { type: Date, required: false }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

DishListItemSchema.index({ listId: 1, slug: 1 }, { unique: true })

export default mongoose.models.DishListItem || mongoose.model('DishListItem', DishListItemSchema)
