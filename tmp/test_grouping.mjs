import { normalizeToGrams } from '../lib/conversion.js';

// Mocking the behavior of the API logic
function groupAndSum(items, gramsPerEach) {
    let totalGrams = 0;
    let totalEach = 0;

    for (const item of items) {
        const normalized = normalizeToGrams(item.unit || 'each', item.quantity, gramsPerEach);
        console.log(`Item: ${item.quantity}${item.unit || 'each'} -> Normalized: ${normalized.value}g`);

        if (normalized.value !== null) {
            totalGrams += normalized.value;
            if (gramsPerEach > 0) {
                totalEach += normalized.value / gramsPerEach;
            } else if (item.unit === 'each' || !item.unit) {
                totalEach += item.quantity;
            }
        }
    }

    return { totalGrams, totalEach };
}

// Test Case 1: Carrot (1 each + 500g)
// Assume 1 carrot = 60g
const gramsPerEachCarrot = 60;
const items1 = [
    { name: 'carrot', quantity: 1, unit: 'each' },
    { name: 'carrot', quantity: 500, unit: 'gram' }
];

console.log("--- Test Case 1: Carrot ---");
const result1 = groupAndSum(items1, gramsPerEachCarrot);
console.log(`Total: ${result1.totalGrams}g or ${result1.totalEach.toFixed(1)} carrots`);

// Test Case 2: Multi-unit (200g + 0.5kg)
const items2 = [
    { name: 'milk', quantity: 200, unit: 'gram' },
    { name: 'milk', quantity: 0.5, unit: 'kilogram' }
];
console.log("\n--- Test Case 2: Milk ---");
const result2 = groupAndSum(items2, 0); // No each conversion
console.log(`Total: ${result2.totalGrams}g`);

// Test Case 3: Each only
const items3 = [
    { name: 'egg', quantity: 6, unit: 'each' },
    { name: 'egg', quantity: 1, unit: 'package' } // package is 'each' ratio 1 usually
];
console.log("\n--- Test Case 3: Egg ---");
const result3 = groupAndSum(items3, 50); // 50g per egg
console.log(`Total: ${result3.totalGrams}g or ${result3.totalEach.toFixed(1)} eggs`);
