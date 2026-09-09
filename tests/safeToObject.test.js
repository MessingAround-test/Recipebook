const { safeToObject } = require('../lib/utils.ts');

const mockMongooseDoc = {
    name: 'Test',
    toObject: function () {
        return { name: this.name, isPlain: true };
    }
};

describe('safeToObject', () => {
    it('converts a Mongoose-like document via toObject()', () => {
        expect(safeToObject(mockMongooseDoc)).toEqual({ name: 'Test', isPlain: true });
    });

    it('returns a plain object unchanged', () => {
        const plainObj = { name: 'Plain' };
        expect(safeToObject(plainObj)).toBe(plainObj);
    });

    it('returns null/undefined unchanged', () => {
        expect(safeToObject(null)).toBeNull();
        expect(safeToObject(undefined)).toBeUndefined();
    });
});
