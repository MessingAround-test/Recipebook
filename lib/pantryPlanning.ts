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

export function isRecentlyPurchased(normalizedName: string, recentNames: Set<string>): boolean {
    if (!recentNames || recentNames.size === 0 || !normalizedName) return false;
    const recents = Array.from(recentNames) as string[];
    for (let i = 0; i < recents.length; i++) {
        const recent = recents[i];
        if (!recent) continue;
        if (recent === normalizedName) return true;
        if (normalizedName.length >= 4 && containsPhrase(normalizedName, recent)) return true;
        if (recent.length >= 4 && containsPhrase(recent, normalizedName)) return true;
    }
    return false;
}

/**
 * Resolves the planning bucket for a single item.
 * Precedence:
 *   1. explicit name rule (Almost certainly have / Probably)
 *   2. bought within the recent window -> Probably
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

    const nameRules = (rules || []).filter(
        (r: any) => r && r.type === 'name' && r.active !== false && matchesNameRule(r, normalized)
    );
    const nameRule = pickBestRule(nameRules);
    if (nameRule) return nameRule.bucket;

    if (isRecentlyPurchased(normalized, recentNames)) {
        return PLANNING_BUCKETS.PROBABLY;
    }

    const categoryRules = (rules || []).filter(
        (r: any) => r && r.type === 'category' && r.active !== false && matchesCategoryRule(r, category)
    );
    const categoryRule = pickBestRule(categoryRules);
    if (categoryRule) return categoryRule.bucket;

    return PLANNING_BUCKETS.TO_CHECK;
}

// ─── DB-backed helpers ─────────────────────────────────────────────────────
// `models` is passed in ({ ShoppingList, ShoppingListItem, PantryAssumption })
// so this module stays unit-testable without a database.

export async function getRecentlyPurchasedNames(models: any, userId: any, currentListId: any): Promise<Set<string>> {
    const { ShoppingList, ShoppingListItem } = models || {};
    const names = new Set<string>();
    if (!ShoppingList || !ShoppingListItem || !userId) return names;

    const since = new Date(Date.now() - RECENT_PURCHASE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const lists = await ShoppingList.find({ createdBy: userId }).select('_id').lean();
    const ids = lists
        .map((l: any) => String(l._id))
        .filter((id: string) => id !== String(currentListId == null ? '' : currentListId));
    if (ids.length === 0) return names;

    const items = await ShoppingListItem.find({
        complete: true,
        deleted: { $ne: true },
        updated_at: { $gte: since },
        shoppingListId: { $in: ids },
    }).select('name').lean();

    items.forEach((item: any) => {
        const normalized = normalizeName(item.name);
        if (normalized) names.add(normalized);
    });
    return names;
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
        userId ? getRecentlyPurchasedNames(models, userId, currentListId) : Promise.resolve(new Set<string>()),
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
