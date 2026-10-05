const {
    SHOP_MODE_GROUPING_CHOICES,
    SHOP_MODE_GROUPING_NONE,
    SHOP_MODE_SESSION_KEY,
    SHOP_MODE_STORAGE_KEY,
    SUPPLIER_WALK_ORDER,
    isResolved,
    isHeldOff,
    flattenLeaves,
    leafQuantityDisplay,
    outstandingCount,
    comeBackCount,
    passSummary,
    buildSections,
    buildSectionsFromLeaves,
    rankSections,
    summarizeGroupingChoice,
    applyItemUpdate,
} = require('../lib/shopMode');

const cat = (name, value) => ({ _id: name, name, complete: false, category: value || name, category_simple: value || name });
const got = (name, value) => ({ ...cat(name, value), complete: true });
const held = (name, value) => ({ ...cat(name, value), cantFind: true });

describe('isResolved / isHeldOff', () => {
    test('complete or held-off counts as resolved', () => {
        expect(isResolved(got('Milk'))).toBe(true);
        expect(isResolved(held('Chia seeds'))).toBe(true);
        expect(isResolved(cat('Milk'))).toBe(false);
        expect(isResolved(null)).toBe(false);
    });

    test('held-off is only outstanding while not complete', () => {
        expect(isHeldOff(held('Chia seeds'))).toBe(true);
        expect(isHeldOff({ ...held('Chia seeds'), complete: true })).toBe(false);
        expect(isHeldOff(cat('Milk'))).toBe(false);
    });
});

describe('flattenLeaves', () => {
    test('expands grouped entries into children with inherited group fields', () => {
        const items = [
            {
                _id: 'group-flour',
                name: 'Plain flour',
                isGroup: true,
                supplier: 'WW',
                planning: 'Probably',
                category: 'Canned Goods',
                items: [
                    { _id: 'a', name: 'Plain flour', complete: false, note: 'From recipe: Cake' },
                    { _id: 'b', name: 'Plain flour', complete: true, note: 'From recipe: Bread' },
                ],
            },
            { _id: 'c', name: 'Milk', complete: false, category: 'Dairy and Eggs' },
        ];
        const leaves = flattenLeaves(items);
        expect(leaves.map(l => l._id)).toEqual(['a', 'b', 'c']);
        expect(leaves[0].supplier).toBe('WW');
        expect(leaves[0].planning).toBe('Probably');
        expect(leaves[0].parentName).toBe('Plain flour');
        expect(leaves[2].category).toBe('Dairy and Eggs');
    });

    test('keeps existing child supplier and planning over inherited ones', () => {
        const items = [{
            _id: 'g', name: 'Eggs', items: [
                { _id: 'a', name: 'Eggs', supplier: 'Aldi', planning: 'To check' },
            ],
        }];
        const leaves = flattenLeaves(items);
        expect(leaves[0].supplier).toBe('Aldi');
        expect(leaves[0].planning).toBe('To check');
    });

    test('handles null and empty input', () => {
        expect(flattenLeaves(null)).toEqual([]);
        expect(flattenLeaves([])).toEqual([]);
    });
});

describe('buildSections', () => {
    test('groups outstanding leaves by the chosen dimension and skips resolved ones', () => {
        const items = [
            cat('Apples', 'Fresh Produce'),
            cat('Bananas', 'Fresh Produce'),
            got('Milk', 'Dairy and Eggs'),
        ];
        const sections = buildSections(items, 'category_simple', []);
        expect(sections.map(s => s.key)).toEqual(['Fresh Produce']);
        expect(sections[0].items.map(i => i.name)).toEqual(['Apples', 'Bananas']);
    });

    describe('nested grouped entries stay whole in sections', () => {
        test('grouped entries are kept as entries, counted by outstanding children', () => {
            const items = [{
                _id: 'group-flour',
                name: 'Plain flour',
                items: [
                    { _id: 'a', name: 'Plain flour', complete: false },
                    { _id: 'b', name: 'Plain flour', complete: true },
                ],
            }];
            const sections = buildSections(items, 'category_simple', []);
            expect(sections).toHaveLength(1);
            expect(sections[0].items).toHaveLength(1);
            expect(sections[0].items[0]._id).toBe('group-flour');
            expect(sections[0].unresolved).toBe(1);
        });

        test('grouped entries fall back to their children for grouping values', () => {
            const items = [{
                _id: 'group-eggs',
                name: 'Eggs',
                items: [
                    { _id: 'a', name: 'Eggs', complete: false, recipe_name: 'Pancakes' },
                ],
            }];
            const sections = buildSections(items, 'recipe_name', []);
            expect(sections.map(s => s.key)).toEqual(['Pancakes']);
        });
    });

    test('held-off items are excluded from the current-pass sections', () => {
        const items = [cat('Apples', 'Fresh Produce'), held('Chia seeds', 'Health and Wellness')];
        const sections = buildSections(items, 'category_simple', []);
        expect(sections.map(s => s.key)).toEqual(['Fresh Produce']);
    });

    test('empty values land in an Other section', () => {
        const items = [{ _id: 'x', name: 'Mystery', complete: false }];
        const sections = buildSections(items, 'category_simple', []);
        expect(sections).toHaveLength(1);
        expect(sections[0].key).toBe('Other');
    });
});

describe('no grouping (one long list)', () => {
    test('a single section holds every outstanding leaf', () => {
        const items = [
            cat('Apples', 'Fresh Produce'),
            cat('Milk', 'Dairy and Eggs'),
            got('Butter', 'Dairy and Eggs'),
        ];
        const sections = buildSections(items, SHOP_MODE_GROUPING_NONE, []);
        expect(sections).toHaveLength(1);
        expect(sections[0].key).toBe('all');
        expect(sections[0].items.map(i => i.name)).toEqual(['Apples', 'Milk']);
    });

    test('no grouping with held items still resolves to a single section on clear', () => {
        const items = [held('Chia seeds', 'Fresh Produce'), cat('Apples', 'Fresh Produce')];
        const sections = buildSections(items, SHOP_MODE_GROUPING_NONE, []);
        expect(sections).toHaveLength(1);
        expect(sections[0].items).toHaveLength(1);
    });
});

describe('rankSections', () => {
    test('category sections follow the store walk order', () => {
        const sections = [
            { key: 'Beverages', label: 'Beverages', items: [] },
            { key: 'Fresh Produce', label: 'Fresh Produce', items: [] },
            { key: 'Meat and Seafood', label: 'Meat and Seafood', items: [] },
        ];
        const ranked = rankSections(sections, 'category_simple', ['Fresh Produce', 'Meat and Seafood', 'Dairy and Eggs', 'Beverages']);
        expect(ranked.map(s => s.key)).toEqual(['Fresh Produce', 'Meat and Seafood', 'Beverages']);
    });

    test('unknown categories sort last, alphabetically', () => {
        const sections = [
            { key: 'Zebras', label: 'Zebras', items: [] },
            { key: 'Aurora', label: 'Aurora', items: [] },
            { key: 'Fresh Produce', label: 'Fresh Produce', items: [] },
        ];
        const ranked = rankSections(sections, 'category_simple', ['Fresh Produce']);
        expect(ranked.map(s => s.key)).toEqual(['Fresh Produce', 'Aurora', 'Zebras']);
    });

    test('suppliers follow the store order', () => {
        const sections = [{ key: 'Coles', label: 'Coles', items: [] }, { key: 'WW', label: 'WW', items: [] }];
        const ranked = rankSections(sections, 'supplier', []);
        expect(ranked.map(s => s.key)).toEqual(['WW', 'Coles']);
    });

    test('non-walk groupings order alphabetically', () => {
        const sections = [{ key: 'Cake', label: 'Cake', items: [] }, { key: 'Anzac', label: 'Anzac', items: [] }];
        const ranked = rankSections(sections, 'recipe_name', []);
        expect(ranked.map(s => s.key)).toEqual(['Anzac', 'Cake']);
    });
});

describe('passSummary / counts', () => {
    test('got / held / outstanding split covers grouped leaves', () => {
        const items = [
            cat('Apples'),
            got('Milk'),
            { name: 'Flour', items: [cat('Flour'), held('Flour'), got('Flour')] },
        ];
        expect(passSummary(items)).toEqual({ got: 2, held: 1, outstanding: 2, total: 5 });
        expect(outstandingCount(items)).toBe(2);
        expect(comeBackCount(items)).toBe(1);
    });

    test('empty list', () => {
        expect(passSummary([])).toEqual({ got: 0, held: 0, outstanding: 0, total: 0 });
    });
});

describe('summarizeGroupingChoice', () => {
    test('section, item and held counts for the setup chips', () => {
        const items = [
            cat('Apples', 'Fresh Produce'),
            cat('Milk', 'Dairy and Eggs'),
            got('Butter', 'Dairy and Eggs'),
            held('Chia seeds', 'Health and Wellness'),
        ];
        expect(summarizeGroupingChoice(items, 'category_simple', [])).toEqual({
            groupBy: 'category_simple',
            sectionCount: 2,
            itemCount: 2,
            heldSectionCount: 1,
            heldCount: 1,
        });
    });

    test('no grouping summaries one section of everything outstanding', () => {
        const items = [cat('Apples', 'Fresh Produce'), cat('Milk', 'Dairy and Eggs'), held('Chia seeds', 'Health and Wellness')];
        expect(summarizeGroupingChoice(items, SHOP_MODE_GROUPING_NONE, [])).toEqual({
            groupBy: SHOP_MODE_GROUPING_NONE,
            sectionCount: 1,
            itemCount: 2,
            heldSectionCount: 1,
            heldCount: 1,
        });
    });
});

describe('buildSectionsFromLeaves', () => {
    test('builds sections from an explicit leaf list', () => {
        const sections = buildSectionsFromLeaves(
            [cat('Apples', 'Fresh Produce'), cat('Milk', 'Dairy and Eggs')],
            'category_simple',
            ['Dairy and Eggs', 'Fresh Produce']
        );
        expect(sections.map(s => s.key)).toEqual(['Dairy and Eggs', 'Fresh Produce']);
    });
});

describe('applyItemUpdate', () => {
    test('updates a top-level item immutably', () => {
        const items = [cat('Apples'), cat('Milk')];
        const next = applyItemUpdate(items, 'Apples', { complete: true, cantFind: false });
        expect(next !== items).toBe(true);
        expect(next[0].complete).toBe(true);
        expect(next[0].cantFind).toBe(false);
        expect(items[0].complete).toBe(false);
    });

    test('updates a sub-item within a grouped entry and recomputes group complete', () => {
        const items = [{
            _id: 'group-flour', name: 'Flour', complete: false,
            items: [{ _id: 'a', name: 'Flour', complete: false }, { _id: 'b', name: 'Flour', complete: false }],
        }];
        const next = applyItemUpdate(items, 'b', { complete: true });
        expect(next[0].items[1].complete).toBe(true);
        expect(next[0].items[0].complete).toBe(false);
        expect(next[0].complete).toBe(false);

        const next2 = applyItemUpdate(next, 'a', { complete: true });
        expect(next2[0].complete).toBe(true);
    });

    test('updates a sub-item held off without touching group complete', () => {
        const items = [{
            _id: 'group-flour', name: 'Flour', complete: false,
            items: [{ _id: 'a', name: 'Flour', complete: false }, { _id: 'b', name: 'Flour', complete: true }],
        }];
        const next = applyItemUpdate(items, 'a', { cantFind: true });
        expect(next[0].items[0].cantFind).toBe(true);
        expect(next[0].complete).toBe(false);
    });

    test('returns null when the id is unknown', () => {
        const items = [cat('Apples')];
        expect(applyItemUpdate(items, 'nope', { complete: true })).toBeNull();
        expect(applyItemUpdate(null, 'x', {})).toBeNull();
    });
});

describe('constants', () => {
    test('grouping choices include no-grouping and exclude complete', () => {
        expect(SHOP_MODE_GROUPING_CHOICES).toContain(SHOP_MODE_GROUPING_NONE);
        expect(SHOP_MODE_GROUPING_CHOICES).not.toContain('complete');
        expect(typeof SHOP_MODE_STORAGE_KEY).toBe('string');
        expect(typeof SHOP_MODE_SESSION_KEY).toBe('string');
        expect(SUPPLIER_WALK_ORDER.length).toBeGreaterThan(0);
    });
});
