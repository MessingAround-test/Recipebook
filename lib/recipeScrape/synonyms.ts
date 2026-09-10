/**
 * Canonical synonym dictionary used by the pre-parse stage to locate recipe
 * sections (ingredients / instructions / notes) in raw HTML.
 *
 * Matching rules:
 *  - lowercase, compared against element id, class, itemprop, data-*, aria-label
 *    and heading text
 *  - singular matches plural ("ingredient" matches "recipe-ingredients")
 *  - hyphens/underscores/spaces are treated as equal separators
 *
 * Bump SYNONYMS_VERSION whenever this list changes: stored SiteHtmlIndex
 * documents carry the version they were built with and are automatically
 * invalidated on mismatch.
 */

export const SYNONYMS_VERSION = 1

export const SYNONYMS: Record<'ingredients' | 'instructions' | 'notes', string[]> = {
    ingredients: [
        'ingredient',
        'ingredients',
        'what you need',
        "you'll need",
        'you will need',
        'shopping list',
        "what you'll need",
    ],
    instructions: [
        'instruction',
        'instructions',
        'step',
        'steps',
        'method',
        'directions',
        'direction',
        'preparation',
        'prep',
        'how to make',
        'how to',
        'procedure',
        'cooking method',
    ],
    notes: [
        'note',
        'notes',
        'recipe notes',
        "cook's notes",
        'cooks notes',
        "chef's notes",
        'chefs notes',
        'tip',
        'tips',
        'extra tips',
        'hints',
        'hint',
        'variations',
        'variation',
        'substitutions',
        'substitution',
        'storage',
        'faq',
    ],
}

/**
 * Normalizes a string for synonym comparison: lowercase, collapse
 * hyphens/underscores/dots to spaces, trim.
 */
export const normalizeForSynonymMatch = (input: string): string =>
    (input || '')
        .toLowerCase()
        .replace(/[-_.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

/**
 * Returns the highest synonym score for a raw attribute/text value.
 * Exact/word-boundary match scores 1.0, substring containment scores 0.6.
 */
export const scoreAgainstSynonyms = (
    raw: string | undefined | null,
    synonyms: string[]
): number => {
    if (!raw) return 0
    const normalized = normalizeForSynonymMatch(raw)
    if (!normalized) return 0
    let best = 0
    for (const synonym of synonyms) {
        const normSyn = normalizeForSynonymMatch(synonym)
        if (!normSyn) continue
        if (normalized === normSyn) {
            best = Math.max(best, 1)
        } else if (new RegExp(`(^| )${escapeRegExp(normSyn)}( |$)`).test(normalized)) {
            best = Math.max(best, 0.9)
        } else if (normalized.includes(normSyn)) {
            best = Math.max(best, 0.6)
        }
        if (best === 1) break
    }
    return best
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
