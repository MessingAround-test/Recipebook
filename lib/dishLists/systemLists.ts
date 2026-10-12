import DishList from '../../models/DishList'
import { TASTEATLAS_PRESETS } from './presets'

// Starter lists that should always exist. `best-dishes` is the canonical
// "100 Best Dishes in the World" default.
const SEED_KEYS = ['best-dishes', 'best-side-dishes', 'vegetarian-every-country']

/**
 * Idempotently creates the default system lists. Matches by sourceKey (new
 * lists) or sourceUrl (legacy docs), so it is safe to call on every request
 * and never duplicates existing lists.
 */
export async function ensureSystemLists(createdBy?: string) {
    const created: any[] = []
    for (const key of SEED_KEYS) {
        const preset = TASTEATLAS_PRESETS.find(p => p.key === key)
        if (!preset) continue
        const or: Record<string, string>[] = [{ sourceKey: key }]
        if (preset.url) or.push({ sourceUrl: preset.url })
        const existing = await DishList.findOne({ $or: or }).lean()
        if (existing) continue
        const list = await DishList.create({
            name: preset.name,
            description: preset.description,
            sourceType: preset.sourceType || 'tasteatlas',
            sourceKey: key,
            sourceUrl: preset.url || undefined,
            dietaryFilters: preset.dietaryFilters,
            countryGrid: preset.showCountryGrid === true,
            isSystem: true,
            createdBy
        })
        created.push(list)
    }
    return created
}
