const {
    resolvePlanningBucket,
    normalizeName,
    containsPhrase,
    matchesNameRule,
    isRecentlyPurchased,
    stampPlanningFields,
    PLANNING_BUCKETS,
    PLANNING_BUCKET_ORDER,
} = require('../lib/pantryPlanning');

describe('normalizeName / containsPhrase', () => {
    test('normalises case, surrounding and repeated whitespace', () => {
        expect(normalizeName('  Basmati   RICE ')).toBe('basmati rice');
        expect(normalizeName(null)).toBe('');
    });

    test('matches whole words only', () => {
        expect(containsPhrase('basmati rice', 'rice')).toBe(true);
        expect(containsPhrase('fried noodles', 'noodles')).toBe(true);
        expect(containsPhrase('ricecakes', 'rice')).toBe(false);
        expect(containsPhrase('stock cubes', 'stock cube')).toBe(false);
    });
});

describe('matchesNameRule', () => {
    test('contains respects exclusions', () => {
        const pepper = { type: 'name', match: 'contains', value: 'pepper', exclude: ['bell', 'capsicum'] };
        expect(matchesNameRule(pepper, 'black pepper')).toBe(true);
        expect(matchesNameRule(pepper, 'bell pepper')).toBe(false);
        expect(matchesNameRule(pepper, 'red capsicum')).toBe(false);
    });

    test('exact requires a full match', () => {
        const rule = { type: 'name', match: 'exact', value: 'rice' };
        expect(matchesNameRule(rule, 'rice')).toBe(true);
        expect(matchesNameRule(rule, 'basmati rice')).toBe(false);
    });
});

describe('resolvePlanningBucket', () => {
    test('name staples land in Probably', () => {
        expect(resolvePlanningBucket('water')).toBe(PLANNING_BUCKETS.PROBABLY);
        expect(resolvePlanningBucket('basmati rice')).toBe(PLANNING_BUCKETS.PROBABLY);
        expect(resolvePlanningBucket('egg noodles')).toBe(PLANNING_BUCKETS.PROBABLY);
        expect(resolvePlanningBucket('coffee beans')).toBe(PLANNING_BUCKETS.PROBABLY);
        expect(resolvePlanningBucket('plain flour')).toBe(PLANNING_BUCKETS.PROBABLY);
    });

    test('always-have basics land in Almost certainly have', () => {
        expect(resolvePlanningBucket('salt')).toBe(PLANNING_BUCKETS.ALMOST);
        expect(resolvePlanningBucket('sea salt')).toBe(PLANNING_BUCKETS.ALMOST);
        expect(resolvePlanningBucket('black pepper')).toBe(PLANNING_BUCKETS.ALMOST);
        expect(resolvePlanningBucket('white sugar')).toBe(PLANNING_BUCKETS.ALMOST);
        expect(resolvePlanningBucket('extra virgin olive oil')).toBe(PLANNING_BUCKETS.ALMOST);
        expect(resolvePlanningBucket('soy sauce')).toBe(PLANNING_BUCKETS.ALMOST);
        expect(resolvePlanningBucket('white vinegar')).toBe(PLANNING_BUCKETS.ALMOST);
        expect(resolvePlanningBucket('chicken stock cubes')).toBe(PLANNING_BUCKETS.ALMOST);
    });

    test('specificity beats priority: rice vinegar is Almost, not Probably', () => {
        // 'vinegar' (priority 100) wins over 'rice' (priority 50)
        expect(resolvePlanningBucket('rice vinegar')).toBe(PLANNING_BUCKETS.ALMOST);
    });

    test('excluded fresh produce falls through', () => {
        expect(resolvePlanningBucket('watermelon')).toBe(PLANNING_BUCKETS.TO_CHECK);
        expect(resolvePlanningBucket('bell pepper')).toBe(PLANNING_BUCKETS.TO_CHECK);
        expect(resolvePlanningBucket('sugar snap peas')).toBe(PLANNING_BUCKETS.TO_CHECK);
    });

    test('category rules place Sauces & Baking in Maybe', () => {
        expect(resolvePlanningBucket('tomato ketchup', { category: 'Condiments and Sauces' })).toBe(PLANNING_BUCKETS.MAYBE);
        expect(resolvePlanningBucket('baking powder', { category: 'Baking Supplies' })).toBe(PLANNING_BUCKETS.MAYBE);
    });

    test('fresh produce and everything else is To check', () => {
        expect(resolvePlanningBucket('bananas', { category: 'Fresh Produce' })).toBe(PLANNING_BUCKETS.TO_CHECK);
        expect(resolvePlanningBucket('milk', { category: 'Dairy and Eggs' })).toBe(PLANNING_BUCKETS.TO_CHECK);
        expect(resolvePlanningBucket('mystery item')).toBe(PLANNING_BUCKETS.TO_CHECK);
    });

    test('recent purchase upgrades an otherwise To check item to Probably', () => {
        const recent = new Set(['tahini']);
        expect(resolvePlanningBucket('tahini', { recentNames: recent })).toBe(PLANNING_BUCKETS.PROBABLY);
        expect(resolvePlanningBucket('tahini paste', { recentNames: recent })).toBe(PLANNING_BUCKETS.PROBABLY);
    });

    test('recent purchase does not override an explicit name rule', () => {
        const recent = new Set(['bananas']);
        // name rules win, but bananas have no rule so recent applies
        expect(resolvePlanningBucket('bananas', { recentNames: recent })).toBe(PLANNING_BUCKETS.PROBABLY);
        // an always-have rule is not downgraded
        expect(resolvePlanningBucket('salt', { recentNames: recent })).toBe(PLANNING_BUCKETS.ALMOST);
    });

    test('extension list flows through custom rules', () => {
        const rules = [{ type: 'name', match: 'contains', value: 'tahini', exclude: [], bucket: PLANNING_BUCKETS.PROBABLY, priority: 50, active: true }];
        expect(resolvePlanningBucket('tahini', { rules })).toBe(PLANNING_BUCKETS.PROBABLY);
        expect(resolvePlanningBucket('honey', { rules })).toBe(PLANNING_BUCKETS.TO_CHECK);
    });
});

describe('isRecentlyPurchased', () => {
    test('matches exact and contains against stored recent names', () => {
        const recent = new Set(['chicken breast']);
        expect(isRecentlyPurchased('chicken breast', recent)).toBe(true);
        expect(isRecentlyPurchased('chicken breast fillets', recent)).toBe(true);
        expect(isRecentlyPurchased('beef mince', recent)).toBe(false);
    });
});

describe('stampPlanningFields', () => {
    test('stamps every item and leaves the originals untouched', () => {
        const items = [{ name: 'rice' }, { name: 'bananas', category: 'Fresh Produce' }];
        const out = stampPlanningFields(items, { rules: undefined, recentNames: new Set() });
        expect(out[0].planning).toBe(PLANNING_BUCKETS.PROBABLY);
        expect(out[1].planning).toBe(PLANNING_BUCKETS.TO_CHECK);
        expect(items[0].planning).toBeUndefined();
    });
});

describe('bucket order', () => {
    test('is ordered from most to least confident', () => {
        expect(PLANNING_BUCKET_ORDER[0]).toBe(PLANNING_BUCKETS.ALMOST);
        expect(PLANNING_BUCKET_ORDER[PLANNING_BUCKET_ORDER.length - 1]).toBe(PLANNING_BUCKETS.TO_CHECK);
    });
});
