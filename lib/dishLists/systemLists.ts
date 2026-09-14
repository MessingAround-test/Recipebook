import DishList from '../../models/DishList'
import { TASTEATLAS_PRESETS } from './presets'

// Starter lists that should always exist. `best-dishes` is the canonical
// "100 Best Dishes in the World" default.
const SEED_KEYS = ['best-dishes', 'best-side-dishes']

/**
 * Idempotently creates the default system lists. Matches by sourceUrl so it is
 * safe to call on every request and never duplicates existing lists.
 */
export async function ensureSystemLists(createdBy?: string) {
    const created: any[] = []
    for (const key of SEED_KEYS) {
        const preset = TASTEATLAS_PRESETS.find(p => p.key === key)
        if (!preset) continue
        const existing = await DishList.findOne({ sourceUrl: preset.url }).lean()
        if (existing) continue
        const list = await DishList.create({
            name: preset.name,
            description: preset.description,
            sourceType: 'tasteatlas',
            sourceUrl: preset.url,
            dietaryFilters: preset.dietaryFilters,
            isSystem: true,
            createdBy
        })
        created.push(list)
    }
    return created
}
