// Shop Mode helpers.
//
// Shop Mode is a focused, one-section-at-a-time shopping walkthrough. This
// module holds the pure logic so it can be unit tested independently of the
// React overlay (components/ShopMode.tsx):
//
//  - flattening grouped entries into leaf items (the granularity of
//    "Got it" / "Hold off" actions)
//  - section construction from a chosen grouping dimension (or none:
//    one long list)
//  - section ranking (store walk order for category groupings, else
//    alphabetical)
//  - pass summaries: got / held-off / still-to-get counts
//  - optimistic local state updates (applyItemUpdate)
//
// Passes are uniform: marking an item "hold off" simply leaves it flagged
// (cantFind) out of the current pass; the next pass starts by clearing those
// flags so every un-got item can be marked again. Unlimited passes, one set
// of logic.
//
// Dependency-light by design: no React, no mongoose.

import { PLANNING_BUCKET_ORDER } from './pantryPlanning';
import { formatQuantityDisplay } from './fractionFormat';

export const SHOP_MODE_GROUPING_NONE = 'none';

export const SHOP_MODE_GROUPING_CHOICES = [
    SHOP_MODE_GROUPING_NONE,
    'category_simple',
    'category',
    'supplier',
    'recipe_name',
    'planning',
    'quantity_type',
    'price_category',
];

export const SHOP_MODE_STORAGE_KEY = 'shoppingList_shopModeGrouping';
export const SHOP_MODE_SESSION_KEY = 'shoppingList_shopModeSession';

export const SUPPLIER_WALK_ORDER = ['WW', 'Panetta', 'IGA', 'Aldi', 'Coles'];

/** True when the item needs no further attention: got it, or held off. */
export function isResolved(item) {
    if (!item) return false;
    return !!(item.complete || item.cantFind);
}

/** Held off for later: flagged, and not (yet) completed. */
export function isHeldOff(item) {
    if (!item) return false;
    return !!item.cantFind && !item.complete;
}

/**
 * All leaf items of an entry — group children for grouped entries, or the
 * item itself when it stands alone.
 */
export function leafItems(item) {
    if (item && item.items && item.items.length > 0) return item.items;
    return item ? [item] : [];
}

/** The value an item carries for a grouping dimension. */
export function itemGroupValue(item, groupBy) {
    return item ? (item[groupBy] || '') : '';
}

/**
 * Flatten list entries into leaf items.
 *
 * Grouped entries (several line items lumped under one name) are expanded:
 * each child becomes its own leaf because Got it / Hold off act on real
 * ShoppingListItem ids (group entries have a synthetic group id). Display
 * fields that only exist on the group (best-match supplier, planning bucket)
 * are inherited by children that lack them.
 */
export function flattenLeaves(items) {
    const leaves = [];
    for (const item of items || []) {
        if (!item) continue;
        if (item.items && item.items.length > 0) {
            for (const sub of item.items) {
                leaves.push({
                    ...sub,
                    parentName: item.name,
                    supplier: sub.supplier || item.supplier,
                    planning: sub.planning || item.planning,
                    recipe_name: sub.recipe_name || item.recipe_name,
                });
            }
        } else {
            leaves.push(item);
        }
    }
    return leaves;
}

/** Display quantity string for a leaf, mirroring IngredientCard's fallbacks. */
export function leafQuantityDisplay(item) {
    if (!item) return '';
    if (item.displayString) return item.displayString;
    const type = item.quantity_type_shorthand || item.quantity_type || 'each';
    return `${formatQuantityDisplay(item.quantity)} ${type}`;
}

/**
 * Snapshot of where a pass stands:
 *  - got: marked complete
 *  - held: held off (flagged, not complete)
 *  - outstanding: neither — still to be addressed this pass
 */
export function passSummary(items) {
    const leaves = flattenLeaves(items);
    return {
        got: leaves.filter(l => !!l.complete).length,
        held: leaves.filter(isHeldOff).length,
        outstanding: leaves.filter(l => !isResolved(l)).length,
        total: leaves.length,
    };
}

/** The value a leaf carries for a grouping dimension ('Other' when empty). */
export function groupValueForLeaf(leaf, groupBy) {
    const raw = leaf ? leaf[groupBy] : '';
    return raw && String(raw).trim() !== '' ? String(raw) : 'Other';
}

/**
 * Value used to slot a list ENTRY into a section. Grouped entries may lack
 * group-level fields (recipe_name, quantity_type etc. live on the children),
 * so fall back to the children's values.
 */
export function groupValueForEntry(item, groupBy) {
    const top = itemGroupValue(item, groupBy);
    if (top && String(top).trim() !== '') return String(top);
    for (const leaf of leafItems(item)) {
        const value = itemGroupValue(leaf, groupBy);
        if (value && String(value).trim() !== '') return String(value);
    }
    return 'Other';
}

/**
 * Order sections by a fixed walk order where relevant (store aisles,
 * suppliers, planning buckets), falling back to alphabetical.
 */
export function rankSections(sections, groupBy, walkOrder) {
    let order = [];
    if (groupBy === 'category_simple' || groupBy === 'category') {
        order = Array.isArray(walkOrder) && walkOrder.length > 0 ? walkOrder : [];
    } else if (groupBy === 'supplier') {
        order = SUPPLIER_WALK_ORDER;
    } else if (groupBy === 'planning') {
        order = PLANNING_BUCKET_ORDER;
    }

    const sorted = [...(sections || [])];
    sorted.sort((a, b) => {
        if (order.length > 0) {
            const rankA = order.indexOf(a.key);
            const rankB = order.indexOf(b.key);
            const aIdx = rankA === -1 ? order.length + 1 : rankA;
            const bIdx = rankB === -1 ? order.length + 1 : rankB;
            if (aIdx !== bIdx) return aIdx - bIdx;
        }
        return a.key.localeCompare(b.key);
    });
    return sorted;
}

/**
 * Build ordered sections over `leaves` for a grouping choice. With the
 * 'none' choice every leaf lands in one section ("All items"). Only
 * sections with at least one leaf are returned.
 */
export function buildSectionsFromLeaves(leaves, groupBy, walkOrder) {
    const sections = new Map();

    if (groupBy === SHOP_MODE_GROUPING_NONE) {
        if (leaves.length > 0) {
            sections.set('all', { key: 'all', label: 'All items', items: [...leaves], unresolved: leaves.length });
        }
    } else {
        for (const leaf of leaves) {
            const value = groupValueForLeaf(leaf, groupBy);
            if (!sections.has(value)) {
                sections.set(value, { key: value, label: value, items: [], unresolved: 0 });
            }
            sections.get(value).items.push(leaf);
            sections.get(value).unresolved += 1;
        }
    }

    return rankSections(Array.from(sections.values()), groupBy, walkOrder);
}

/**
 * Current-pass sections. Entries are kept whole (grouped entries nest like
 * the normal list view); an entry is skipped once every one of its leaves is
 * got or held off. Only sections with at least one outstanding entry exist —
 * sections with nothing left never appear in the flow.
 *
 * Returns: [{ key, label, items, unresolved }] where `unresolved` counts the
 * outstanding leaves across the section's entries.
 */
export function buildSections(items, groupBy, walkOrder) {
    const sections = new Map();

    for (const item of items || []) {
        const outstandingLeaves = leafItems(item).filter(leaf => !isResolved(leaf));
        if (outstandingLeaves.length === 0) continue;

        const value = groupBy === SHOP_MODE_GROUPING_NONE ? 'all' : groupValueForEntry(item, groupBy);
        if (!sections.has(value)) {
            sections.set(value, {
                key: value,
                label: groupBy === SHOP_MODE_GROUPING_NONE ? 'All items' : value,
                items: [],
                unresolved: 0,
            });
        }
        const section = sections.get(value);
        section.items.push(item);
        section.unresolved += outstandingLeaves.length;
    }

    return rankSections(Array.from(sections.values()), groupBy, walkOrder);
}

/**
 * Per-choice summary for the setup screen: sections/items still to get,
 * plus how many held-off items would re-appear in the next pass.
 */
export function summarizeGroupingChoice(items, groupBy, walkOrder) {
    const leaves = flattenLeaves(items);
    const outstanding = leaves.filter(leaf => !isResolved(leaf));
    const held = leaves.filter(isHeldOff);
    const sections = buildSectionsFromLeaves(outstanding, groupBy, walkOrder);
    const heldSections = buildSectionsFromLeaves(held, groupBy, walkOrder);
    return {
        groupBy,
        sectionCount: sections.length,
        itemCount: outstanding.length,
        heldSectionCount: heldSections.length,
        heldCount: held.length,
    };
}

/** Count of leaves still needing attention this pass (not complete, not held). */
export function outstandingCount(items) {
    return passSummary(items).outstanding;
}

/** How many held-off items (flagged, not yet complete) exist? */
export function comeBackCount(items) {
    return passSummary(items).held;
}

/**
 * Optimistic local state update: applies `updates` ({ complete, cantFind })
 * to the item with `itemId`, wherever it lives (top level or inside a
 * grouped entry's children), recalculating grouped `complete`. Returns a new
 * top-level array (never mutates the input); returns null when the id
 * isn't found.
 */
export function applyItemUpdate(items, itemId, updates) {
    if (!Array.isArray(items)) return null;
    let found = false;
    const next = items.map((item) => {
        if (!item) return item;
        if (item._id === itemId) {
            found = true;
            return { ...item, ...updates };
        }
        if (item.items && item.items.length > 0) {
            const subIndex = item.items.findIndex(sub => sub && sub._id === itemId);
            if (subIndex !== -1) {
                found = true;
                const newItems = item.items.map(sub =>
                    sub && sub._id === itemId ? { ...sub, ...updates } : sub
                );
                return {
                    ...item,
                    items: newItems,
                    complete: newItems.every(sub => sub && sub.complete),
                };
            }
        }
        return item;
    });
    return found ? next : null;
}
