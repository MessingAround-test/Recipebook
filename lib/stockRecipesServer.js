import Recipe from '../models/Recipe';
import { STOCK_RECIPES, missingStockKeys } from './stockRecipes';

/** Ensure `owner` ({ email, username }) has every staple recipe: creates the
 *  missing ones as normal Recipe docs they fully own and can edit. Called
 *  lazily before side suggestions are served, so the picker is never empty.
 *  Recreate-if-missing: a deleted staple comes back on the next seed, while
 *  edits (or hiding) to an existing copy are never overwritten. Returns how
 *  many recipes were created. */
export async function ensureStockRecipes(owner) {
    const existing = await Recipe.find(
        { creator_email: owner.email, stockKey: { $in: STOCK_RECIPES.map(t => t.stockKey) } },
        { stockKey: 1 }
    ).lean();
    const missingKeys = new Set(missingStockKeys(existing.map(r => r.stockKey)));
    const missing = STOCK_RECIPES.filter(t => missingKeys.has(t.stockKey));
    if (missing.length === 0) return 0;
    await Recipe.insertMany(missing.map(t => ({
        ...t,
        creator_username: owner.username,
        creator_email: owner.email
    })));
    return missing.length;
}
