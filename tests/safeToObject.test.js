const { safeToObject } = require('./lib/utils.ts');

const mockMongooseDoc = {
    name: 'Test',
    toObject: function () {
        return { name: this.name, isPlain: true };
    }
};

const plainObj = { name: 'Plain' };

console.log('Testing Mongoose-like object:');
console.log(safeToObject(mockMongooseDoc));

console.log('\nTesting Plain object:');
console.log(safeToObject(plainObj));

if (safeToObject(mockMongooseDoc).isPlain && safeToObject(plainObj).name === 'Plain') {
    console.log('\nSUCCESS: safeToObject works as expected.');
} else {
    console.log('\nFAILURE: safeToObject did not work correctly.');
    process.exit(1);
}
