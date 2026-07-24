export const DEFAULT_WOOLWORTHS_ORDER = [
    'Fresh Produce',
    'Bakery',
    'Meat and Seafood',
    'Deli and Prepared Foods',
    'Dairy and Eggs',
    'Cereal and Breakfast Foods',
    'Beverages',
    'Snacks',
    'Canned Goods',
    'Condiments and Sauces',
    'International Foods',
    'Pasta and Grains',
    'Baking Supplies',
    'Health and Wellness',
    'Personal Care',
    'Household and Cleaning',
    'Home and Garden',
    'Frozen Foods',
];

const STORAGE_KEY = 'shoppingList_woolworthsOrder';

export function getStoredOrder() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {}
    return [...DEFAULT_WOOLWORTHS_ORDER];
}

export function saveOrder(order) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

export function resetOrder() {
    localStorage.removeItem(STORAGE_KEY);
}

function getCategoryRank(category, order) {
    const idx = order.indexOf(category);
    return idx === -1 ? order.length : idx;
}

export function compareByWoolworthsOrder(a, b, order) {
    const rankA = getCategoryRank(a.category, order);
    const rankB = getCategoryRank(b.category, order);
    if (rankA !== rankB) return rankA - rankB;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

function getCategoryFromGroupKey(key) {
    const parts = key.split('|');
    for (const part of parts) {
        if (part.startsWith('category=')) {
            return part.slice('category='.length);
        }
    }
    return null;
}

export function compareGroupsByWoolworthsOrder(a, b, order) {
    const aIsComplete = a.includes("complete=true");
    const bIsComplete = b.includes("complete=true");
    if (aIsComplete && !bIsComplete) return 1;
    if (!aIsComplete && bIsComplete) return -1;

    const catA = getCategoryFromGroupKey(a);
    const catB = getCategoryFromGroupKey(b);

    if (catA && catB) {
        const rankA = getCategoryRank(catA, order);
        const rankB = getCategoryRank(catB, order);
        if (rankA !== rankB) return rankA - rankB;
    } else if (catA) return -1;
    else if (catB) return 1;

    return a.localeCompare(b);
}
