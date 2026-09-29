/**
 * Central registry of per-user app features.
 *
 * Each feature is a switchable "part" of the app. Which features a user has is
 * stored on their User document (`features`), and gating is applied to pages,
 * navigation, homepage widgets and (where the API is dedicated) server routes.
 *
 * Adding a new feature:
 *   1. Add an entry below.
 *   2. Give it a `paths` prefix if it maps to a page (used by the global guard).
 *   3. Add `requireFeature(...)` to its dedicated API routes if applicable.
 * Existing users are backfilled as all-on (see resolveFeatures), new users start
 * with everything off and pick what they want during onboarding.
 */

export interface FeatureDef {
    key: string
    label: string
    description: string
    /** Route prefixes owned by this feature (longest-prefix match wins). */
    paths: string[]
}

export const FEATURES: FeatureDef[] = [
    {
        key: 'recipes',
        label: 'Recipes',
        description: 'Create, browse and cook from your recipe collection.',
        paths: ['/recipes', '/createRecipe', '/remixRecipe'],
    },
    {
        key: 'shoppingList',
        label: 'Shopping List',
        description: 'Build and share shopping lists from recipes and ingredients.',
        paths: ['/shoppingList'],
    },
    {
        key: 'healthTracker',
        label: 'Health Tracker',
        description: 'Track daily intake, nutrients, symptoms and trends.',
        paths: ['/dailyTracker'],
    },
    {
        key: 'weeklyPlanner',
        label: 'Weekly Planner',
        description: 'Plan your meals for the week ahead.',
        paths: ['/weeklyPlanner'],
    },
    {
        key: 'worldList',
        label: 'Explore / World List',
        description: "Work through the world's best dishes and the world map.",
        paths: ['/dishLists', '/map'],
    },
    {
        key: 'ingredients',
        label: 'Ingredients',
        description: 'Research ingredients, nutrition and hidden items.',
        paths: ['/ingredientResearch', '/ingredientResearchList', '/hiddenItems'],
    },
    {
        key: 'quickTools',
        label: 'Quick Tools',
        description: 'Timers, unit and oven converters and cooking guides.',
        paths: ['/quickTools'],
    },
    {
        key: 'dailyTasks',
        label: 'Daily Tasks',
        description: 'The daily habit checklist on your home dashboard.',
        paths: [],
    },
]

export const FEATURE_KEYS: string[] = FEATURES.map(f => f.key)

/**
 * When true, only admins may change a user's features. Intended for the future
 * billable phase. Flip to true to lock the self-service toggles off; the admin
 * per-user editor keeps working either way.
 */
export const FEATURES_ADMIN_ONLY = false

export type FeatureMap = Record<string, boolean>

/** New/unknown users start with every feature off. */
export const DEFAULT_FEATURES: FeatureMap = FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = false
    return acc
}, {} as FeatureMap)

/**
 * Merge a user's stored features over the defaults. Unknown stored keys are
 * dropped. A user with no stored features and no onboarding marker simply has
 * everything off until they complete onboarding (or an admin grants access).
 * Existing installs can run scripts/backfill-features.js to grandfather older
 * accounts as all-on and skip onboarding.
 */
export function resolveFeatures(user: any): FeatureMap {
    const resolved: FeatureMap = { ...DEFAULT_FEATURES }
    if (!user) return resolved

    const stored = user.features
    if (stored && typeof stored === 'object') {
        for (const key of FEATURE_KEYS) {
            if (typeof stored[key] === 'boolean') resolved[key] = stored[key]
        }
    }

    return resolved
}

/**
 * True when the user still needs to complete feature onboarding — i.e. they
 * have never been through the welcome screen. In admin-managed (billable) mode
 * users don't self-onboard, so this is always false there.
 */
export function needsOnboarding(user: any): boolean {
    if (!user) return false
    if (FEATURES_ADMIN_ONLY) return false
    return user.features_onboarded_at === null || user.features_onboarded_at === undefined
}

export function hasFeature(user: any, key: string): boolean {
    if (!FEATURE_KEYS.includes(key)) return true
    return resolveFeatures(user)[key] === true
}

/**
 * Sanitize arbitrary client input into a valid feature map. Only known keys with
 * boolean values are kept; everything else is ignored.
 */
export function sanitizeFeatures(input: any): FeatureMap {
    const out: FeatureMap = {}
    if (!input || typeof input !== 'object') return out
    for (const key of FEATURE_KEYS) {
        if (typeof input[key] === 'boolean') out[key] = input[key]
    }
    return out
}

/**
 * Find the feature that owns a route path. Longest matching prefix wins so
 * e.g. `/recipes/quiz` resolves to `recipes`.
 */
export function keyForPath(pathname: string | undefined | null): string | null {
    if (!pathname) return null
    let match: string | null = null
    let matchLen = -1
    for (const feature of FEATURES) {
        for (const prefix of feature.paths) {
            const isMatch = pathname === prefix || pathname.startsWith(prefix + '/')
            if (isMatch && prefix.length > matchLen) {
                match = feature.key
                matchLen = prefix.length
            }
        }
    }
    return match
}
