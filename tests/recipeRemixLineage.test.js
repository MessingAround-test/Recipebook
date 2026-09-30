import { nextRemixName, remixSourceRef, parseRemixSourceRef } from '../lib/recipeRemix';

describe('remix lineage naming', () => {
    test('first remix appends v2', () => {
        expect(nextRemixName('Vori-vori')).toBe('Vori-vori v2');
    });

    test('existing version suffix is incremented', () => {
        expect(nextRemixName('Vori-vori v2')).toBe('Vori-vori v3');
        expect(nextRemixName('Vori-vori v9')).toBe('Vori-vori v10');
    });

    test('mixed case suffix still matches', () => {
        expect(nextRemixName('Vori-vori V3')).toBe('Vori-vori v4');
    });

    test('words that merely contain "v" do not count as versions', () => {
        expect(nextRemixName('Vindaloo')).toBe('Vindaloo v2');
        expect(nextRemixName('Lava cake')).toBe('Lava cake v2');
    });

    test('trailing dietary tag is preserved after the version suffix', () => {
        expect(nextRemixName('Vori-vori (Pescetarian)')).toBe('Vori-vori (Pescetarian) v2');
    });

    test('falls back for empty input', () => {
        expect(nextRemixName('')).toBe('Recipe v2');
        expect(nextRemixName(null)).toBe('Recipe v2');
    });
});

describe('remix source reference (sourceUrl re-used)', () => {
    test('builds and parses the remix:// reference', () => {
        const id = '64f0a1b2c3d4e5f6a7b8c9d0';
        const ref = remixSourceRef(id);
        expect(ref).toBe(`remix://${id}`);
        expect(parseRemixSourceRef(ref)).toBe(id);
    });

    test('real http source links are not remix references', () => {
        expect(parseRemixSourceRef('https://example.com/recipe')).toBeNull();
        expect(parseRemixSourceRef('')).toBeNull();
        expect(parseRemixSourceRef(null)).toBeNull();
        expect(parseRemixSourceRef('facebook://watch/x')).toBeNull();
        expect(parseRemixSourceRef('remix://proto-trick')).toBe('proto-trick');
        expect(parseRemixSourceRef('  remix://abc  ')).toBe('abc');
    });

    test('empty id round-trips to null', () => {
        expect(parseRemixSourceRef(remixSourceRef(''))).toBeNull();
    });
});
