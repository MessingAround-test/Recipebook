const { sanitizeRating } = require('../lib/recipeRating.ts');

describe('sanitizeRating', () => {
    it('keeps valid integer ratings', () => {
        expect(sanitizeRating(1)).toBe(1);
        expect(sanitizeRating(3)).toBe(3);
        expect(sanitizeRating(5)).toBe(5);
    });

    it('rounds fractional ratings to the nearest integer', () => {
        expect(sanitizeRating(3.4)).toBe(3);
        expect(sanitizeRating(3.6)).toBe(4);
        expect(sanitizeRating('2.5')).toBe(3);
    });

    it('clamps ratings above 5', () => {
        expect(sanitizeRating(6)).toBe(5);
        expect(sanitizeRating(100)).toBe(5);
    });

    it('clears empty, invalid or below-range values', () => {
        expect(sanitizeRating(null)).toBeNull();
        expect(sanitizeRating(undefined)).toBeNull();
        expect(sanitizeRating('')).toBeNull();
        expect(sanitizeRating(0)).toBeNull();
        expect(sanitizeRating(-2)).toBeNull();
        expect(sanitizeRating('abc')).toBeNull();
        expect(sanitizeRating(NaN)).toBeNull();
    });
});
