// Pantry "Planning" grouping: estimates whether we probably already have an
// ingredient in the pantry, based on explicit rules (DB-backed) and whether
// it was bought recently on one of the user's own shopping lists.
//
// This module is intentionally dependency-free (no mongoose import) so it can
// be unit tested and, if needed, imported by client code for constants.

export const PLANNING_BUCKETS = {
    ALMOST: 'Almost certainly have',
    PROBABLY: 'Probably',
    MAYBE: 'Maybe',
    TO_CHECK: 'To check',
};

// Confidence order, best first. Used for sorting the grouped list.
export const PLANNING_BUCKET_ORDER = [
    PLANNING_BUCKETS.ALMOST,
    PLANNING_BUCKETS.PROBABLY,
    PLANNING_BUCKETS.MAYBE,
    PLANNING_BUCKETS.TO_CHECK,
];

// How recently an item must have been bought to count as "still in the pantry".
export const RECENT_PURCHASE_WINDOW_DAYS = 28;

// Some categories have sharper expiry than the default window. Fresh produce
// bought in the last week lands in "Maybe"; older than that it falls through
// to "To check". Keyed by lowercased broad category.
export const CATEGORY_RECENT_WINDOWS = {
    'fresh produce': { days: 7, bucket: PLANNING_BUCKETS.MAYBE },
};

/**
 * Categories whose confidence is capped when the item was bought in a prior
 * week. Snacks are treated as "Probably" (not "Almost certainly have") even
 * when a name rule like "salt" or "vinegar" would otherwise promote them —
 * snack cravings move and odds are we don't still have them. Keyed by
 * lowercased broad category.
 */
export const CATEGORY_RECENT_BUCKETS = {
    'snacks': PLANNING_BUCKETS.PROBABLY,
};

/** Recent-window rule for a broad category, or null to use the default. */
export function recentWindowForCategory(category: any): { days: number; bucket: string } | null {
    const key = normalizeName(category);
    return key && CATEGORY_RECENT_WINDOWS[key] ? CATEGORY_RECENT_WINDOWS[key] : null;
}

/** Bucket cap for a recently-bought category, or null when uncapped. */
export function recentBucketForCategory(category: any): string | null {
    const key = normalizeName(category);
    return key && CATEGORY_RECENT_BUCKETS[key] ? CATEGORY_RECENT_BUCKETS[key] : null;
}

// Default rules. Seeded into the PantryAssumption collection on first use and
// freely editable/extendsible via the admin screen.
//   - "Almost certainly have": seasonings and cooking basics most kitchens keep.
//   - "Probably": long-life staples the user listed (water, rice, noodles...).
//   - "Maybe": worked out from broad categories in the resolver below.
// Matching is word-boundary based, so "basmati rice" matches "rice" but
// "bell pepper" can be excluded from the "pepper" rule.
export const SEED_PANTRY_ASSUMPTIONS = [
    // ── Almost certainly have (name) ────────────────────────────────────────
    { type: 'name', match: 'contains', value: 'salt', exclude: [], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },
    { type: 'name', match: 'contains', value: 'pepper', exclude: ['bell', 'capsicum', 'chilli', 'chili', 'jalapeno', 'jalapeño', 'habanero', 'serrano', 'poblano'], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },
    { type: 'name', match: 'contains', value: 'sugar', exclude: ['snap', 'peas'], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },
    { type: 'name', match: 'contains', value: 'olive oil', exclude: [], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },
    { type: 'name', match: 'contains', value: 'cooking oil', exclude: [], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },
    { type: 'name', match: 'contains', value: 'vegetable oil', exclude: [], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },
    { type: 'name', match: 'contains', value: 'soy sauce', exclude: [], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },
    { type: 'name', match: 'contains', value: 'vinegar', exclude: [], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },
    { type: 'name', match: 'contains', value: 'stock cube', exclude: [], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },
    { type: 'name', match: 'contains', value: 'stock cubes', exclude: [], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },
    { type: 'name', match: 'contains', value: 'bouillon', exclude: [], bucket: PLANNING_BUCKETS.ALMOST, priority: 100 },

    // ── Probably (name) ─────────────────────────────────────────────────────
    { type: 'name', match: 'contains', value: 'water', exclude: ['watermelon'], bucket: PLANNING_BUCKETS.PROBABLY, priority: 50 },
    { type: 'name', match: 'contains', value: 'rice', exclude: [], bucket: PLANNING_BUCKETS.PROBABLY, priority: 50 },
    { type: 'name', match: 'contains', value: 'noodles', exclude: [], bucket: PLANNING_BUCKETS.PROBABLY, priority: 50 },
    { type: 'name', match: 'contains', value: 'pasta', exclude: [], bucket: PLANNING_BUCKETS.PROBABLY, priority: 50 },
    { type: 'name', match: 'contains', value: 'coffee beans', exclude: [], bucket: PLANNING_BUCKETS.PROBABLY, priority: 50 },
    { type: 'name', match: 'contains', value: 'coffee', exclude: ['cake', 'cakes', 'table'], bucket: PLANNING_BUCKETS.PROBABLY, priority: 50 },
    { type: 'name', match: 'contains', value: 'flour', exclude: [], bucket: PLANNING_BUCKETS.PROBABLY, priority: 50 },

    // ── Maybe (broad category) ──────────────────────────────────────────────
    { type: 'category', match: 'exact', value: 'Condiments and Sauces', exclude: [], bucket: PLANNING_BUCKETS.MAYBE, priority: 10 },
    { type: 'category', match: 'exact', value: 'Baking Supplies', exclude: [], bucket: PLANNING_BUCKETS.MAYBE, priority: 10 },
];

export function normalizeName(value: any): string {
    return String(value == null ? '' : value).toLowerCase().trim().replace(/\s+/g, ' ');
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary phrase match. "basmati rice" contains "rice"; "bell pepper"
 * does not contain the standalone word "pepper" (it does), so exclusions on a
 * rule are what rule that case out. "stock cube" will NOT match "stock cubes"
 * because of the trailing word character.
 */
export function containsPhrase(haystack: string, needle: string): boolean {
    if (!haystack || !needle) return false;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`);
    return re.test(haystack);
}

export function matchesNameRule(rule: any, normalizedName: string): boolean {
    const value = normalizeName(rule && rule.value);
    if (!value) return false;
    const excludes = (rule.exclude || []).map(normalizeName).filter(Boolean);
    if (excludes.some((ex: string) => containsPhrase(normalizedName, ex))) return false;
    if (rule.match === 'exact') return normalizedName === value;
    return containsPhrase(normalizedName, value);
}

export function matchesCategoryRule(rule: any, category: any): boolean {
    const value = normalizeName(rule && rule.value);
    const cat = normalizeName(category);
    if (!value || !cat) return false;
    if (rule.match === 'exact') return cat === value;
    return containsPhrase(cat, value);
}

/** Highest priority wins; ties go to the longer (more specific) value. */
function pickBestRule(rules: any[]) {
    return [...rules].sort((a, b) => {
        const pa = Number(a.priority) || 0;
        const pb = Number(b.priority) || 0;
        if (pb !== pa) return pb - pa;
        return normalizeName(b.value).length - normalizeName(a.value).length;
    })[0] || null;
}

export function isRecentlyPurchased(normalizedName: string, recentNames: any, withinDays?: number): boolean {
    const days = typeof withinDays === 'number' ? withinDays : RECENT_PURCHASE_WINDOW_DAYS;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recents = toRecentEntries(recentNames);
    if (recents.length === 0 || !normalizedName) return false;
    for (let i = 0; i < recents.length; i++) {
        const recent = recents[i];
        if (!recent.name || recent.at < cutoff) continue;
        if (recent.name === normalizedName) return true;
        if (normalizedName.length >= 4 && containsPhrase(normalizedName, recent.name)) return true;
        if (recent.name.length >= 4 && containsPhrase(recent.name, normalizedName)) return true;
    }
    return false;
}

/**
 * Normalises the "recent purchases" input into [{ name, at }] entries.
 * Accepts either a Map<name, timestamp-ms> or a Set<string> (treated as
 * "bought just now") for backwards compatibility and easy testing.
 */
function toRecentEntries(recentNames: any): { name: string; at: number }[] {
    if (!recentNames) return [];
    if (typeof recentNames.entries === 'function') {
        const out: { name: string; at: number }[] = [];
        const iter = recentNames.entries();
        let next = iter.next();
        while (!next.done) {
            const [name, at] = next.value;
            out.push({ name, at: typeof at === 'number' ? at : Date.now() });
            next = iter.next();
        }
        return out;
    }
    if (typeof recentNames.forEach === 'function') {
        const out: { name: string; at: number }[] = [];
        recentNames.forEach((value: any, name: string) => out.push({ name, at: Date.now() }));
        return out;
    }
    return [];
}

/**
 * Resolves the planning bucket for a single item.
 * Precedence:
 *   0. category cap for recently-bought categories (e.g. Snacks -> Probably),
 *      which overrides the name rules below
 *   1. explicit name rule (Almost certainly have / Probably)
 *   2. bought within the recent window -> Probably (or the category's bucket,
 *      e.g. Fresh Produce within the last week -> Maybe)
 *   3. explicit category rule (Maybe)
 *   4. To check
 */
export function resolvePlanningBucket(name: any, opts: any = {}) {
    const {
        category = null,
        rules = SEED_PANTRY_ASSUMPTIONS,
        recentNames = null,
    } = opts;

    const normalized = normalizeName(name);
    const recentlyBought = isRecentlyPurchased(normalized, recentNames, RECENT_PURCHASE_WINDOW_DAYS);

    // Recently-bought categories with a confidence cap (e.g. snacks) can't be
    // "Almost certainly have", even if a name rule would place them there.
    const cap = recentlyBought ? recentBucketForCategory(category) : null;

    const nameRules = (rules || []).filter(
        (r: any) => r && r.type === 'name' && r.active !== false && matchesNameRule(r, normalized)
    );
    const nameRule = pickBestRule(nameRules);
    if (nameRule && !cap) return nameRule.bucket;

    // Category-aware recency: fresh produce is only "still around" for a week.
    const window = recentWindowForCategory(category);
    const withinDays = window ? window.days : RECENT_PURCHASE_WINDOW_DAYS;
    if (isRecentlyPurchased(normalized, recentNames, withinDays)) {
        return window ? window.bucket : PLANNING_BUCKETS.PROBABLY;
    }

    if (nameRule) return nameRule.bucket;

    const categoryRules = (rules || []).filter(
        (r: any) => r && r.type === 'category' && r.active !== false && matchesCategoryRule(r, category)
    );
    const categoryRule = pickBestRule(categoryRules);
    if (categoryRule) return categoryRule.bucket;

    if (cap) return cap;

    return PLANNING_BUCKETS.TO_CHECK;
}

// ─── DB-backed helpers ─────────────────────────────────────────────────────
// `models` is passed in ({ ShoppingList, ShoppingListItem, PantryAssumption })
// so this module stays unit-testable without a database.

export async function getRecentlyPurchasedNames(models: any, userId: any, currentListId: any): Promise<Map<string, number>> {
    const { ShoppingList, ShoppingListItem } = models || {};
    const purchases = new Map<string, number>();
    if (!ShoppingList || !ShoppingListItem || !userId) return purchases;

    const since = new Date(Date.now() - RECENT_PURCHASE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const lists = await ShoppingList.find({ createdBy: userId }).select('_id').lean();
    const ids = lists
        .map((l: any) => String(l._id))
        .filter((id: string) => id !== String(currentListId == null ? '' : currentListId));
    if (ids.length === 0) return purchases;

    const items = await ShoppingListItem.find({
        complete: true,
        deleted: { $ne: true },
        updated_at: { $gte: since },
        shoppingListId: { $in: ids },
    }).select('name updated_at').lean();

    items.forEach((item: any) => {
        const normalized = normalizeName(item.name);
        if (!normalized) return;
        const at = item.updated_at ? new Date(item.updated_at).getTime() : Date.now();
        const prev = purchases.get(normalized);
        if (prev === undefined || at > prev) purchases.set(normalized, at);
    });
    return purchases;
}

export async function loadPantryAssumptions(models: any): Promise<any[]> {
    const { PantryAssumption } = models || {};
    if (!PantryAssumption) return SEED_PANTRY_ASSUMPTIONS;
    if (typeof PantryAssumption.seedIfNeeded === 'function') {
        try { await PantryAssumption.seedIfNeeded(); } catch (e) { /* concurrent seed race */ }
    }
    const rules = await PantryAssumption.find({ active: { $ne: false } }).lean();
    return rules.map((r: any) => ({ ...r, exclude: r.exclude || [] }));
}

export async function buildPlanningContext(models: any, userId: any, currentListId: any) {
    const [dbRules, recentNames] = await Promise.all([
        loadPantryAssumptions(models),
        userId ? getRecentlyPurchasedNames(models, userId, currentListId) : Promise.resolve(new Map<string, number>()),
    ]);
    return {
        rules: dbRules && dbRules.length > 0 ? dbRules : SEED_PANTRY_ASSUMPTIONS,
        recentNames,
    };
}

/** Stamps a `planning` bucket onto each item/group. */
export function stampPlanningFields(items: any[], context: any): any[] {
    if (!Array.isArray(items)) return items;
    return items.map((item: any) => ({
        ...item,
        planning: resolvePlanningBucket(item && item.name, {
            category: item && item.category,
            rules: context && context.rules,
            recentNames: context && context.recentNames,
        }),
    }));
}
