import { isAlwaysNoiseNote, isGroupOnlyNote, noteForDisplay } from '../lib/notes';

describe('note filtering', () => {
    test('"Pantry item" is always noise', () => {
        expect(isAlwaysNoiseNote('Pantry item')).toBe(true);
        expect(isAlwaysNoiseNote(' pantry item ')).toBe(true);
        expect(isAlwaysNoiseNote('use the green ones')).toBe(false);
        expect(isAlwaysNoiseNote('')).toBe(false);
    });

    test('group-only notes: from recipe + for <date/day>', () => {
        expect(isGroupOnlyNote('From recipe: Carrot cake')).toBe(true);
        expect(isGroupOnlyNote('For Monday')).toBe(true);
        expect(isGroupOnlyNote('For 2026-10-01')).toBe(true);
        expect(isGroupOnlyNote('chopped finely')).toBe(false);
        expect(isGroupOnlyNote('')).toBe(false);
    });

    test('noteForDisplay hides noise and group-only notes when not grouped', () => {
        expect(noteForDisplay('Pantry item')).toBe('');
        expect(noteForDisplay('From recipe: spud')).toBe('');
        expect(noteForDisplay('For Monday')).toBe('');
        expect(noteForDisplay('use the green ones')).toBe('use the green ones');
        expect(noteForDisplay('From recipe: spud', { isGroup: true })).toBe('From recipe: spud');
        expect(noteForDisplay(null)).toBe('');
    });
});
