import DishListItemCooked from '../../models/DishListItemCooked'
import Recipe from '../../models/Recipe'

/** All recipe ids linked to a dish item (supports both the scalar
 *  back-compat `recipeId` and the full `recipeIds` list). */
export function linkedRecipeIds(item) {
    if (Array.isArray(item?.recipeIds) && item.recipeIds.length > 0) {
        return item.recipeIds.map(String)
    }
    return item?.recipeId ? [String(item.recipeId)] : []
}

/**
 * Pure mapping of "this user's cooked recipes" onto the dish items that link to
 * them. Used to keep the recipe -> dish tick-off convenience per user.
 *
 * @param items the dish-list items to decorate
 * @param cookedRecipeIds ids of recipes the user has cooked (timesCooked > 0)
 * @returns a Set of cooked item id strings
 */
export function recipeDerivedCookedIds(items = [], cookedRecipeIds = []) {
    const cookedRecipes = new Set(cookedRecipeIds.map(String))
    const cookedItems = new Set()
    if (cookedRecipes.size === 0) return cookedItems

    for (const item of items) {
        if (linkedRecipeIds(item).some(id => cookedRecipes.has(id))) {
            cookedItems.add(String(item._id))
        }
    }
    return cookedItems
}

/**
 * Resolves which of `items` the given user has cooked, combining their explicit
 * marks with the dish's own linked recipes they've cooked at least once.
 *
 * @param items dish-list items (lean docs are fine)
 * @param userId the current user's id
 * @param userEmail the current user's email (for the recipe derivation)
 * @returns a Set of cooked item id strings
 */
export async function cookedItemIdsForUser(items = [], userId = null, userEmail = null) {
    const cooked = new Set()
    if (items.length === 0) return cooked

    const itemIds = items.map(item => item._id)

    if (userId) {
        const explicit = await DishListItemCooked.find({ userId, itemId: { $in: itemIds } })
            .select('itemId')
            .lean()
        for (const row of explicit) cooked.add(String(row.itemId))
    }

    const recipeIds = Array.from(new Set(items.flatMap(linkedRecipeIds)))
    if (recipeIds.length > 0 && userEmail) {
        const recipes = await Recipe.find({
            _id: { $in: recipeIds },
            creator_email: userEmail,
            timesCooked: { $gt: 0 }
        }).select('_id').lean()
        const derived = recipeDerivedCookedIds(items, recipes.map(r => r._id))
        for (const id of derived) cooked.add(id)
    }

    return cooked
}
