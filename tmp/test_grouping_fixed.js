// Self-contained test script to verify grouping logic

function normalizeToGramsMock(unit, quantity, gramsPerEach) {
    // Simple mock of the conversion logic
    const conversions = {
        'gram': 1,
        'g': 1,
        'kilogram': 1000,
        'kg': 1000,
        'ml': 1,
        'l': 1000
    };

    if (conversions[unit]) {
        return { value: quantity * conversions[unit], source: 'explicit' };
    }

    if ((unit === 'each' || !unit) && gramsPerEach > 0) {
        return { value: quantity * gramsPerEach, source: 'ai' };
    }

    return { value: null, source: null };
}

function groupAndSum(items, gramsPerEach) {
    let totalGrams = 0;
    let totalEach = 0;

    for (const item of items) {
        const normalized = normalizeToGramsMock(item.unit, item.quantity, gramsPerEach);
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
console.log(`Result: ${result1.totalGrams.toFixed(0)}g or ${result1.totalEach.toFixed(1)} carrots`);

// Test Case 2: Multi-unit (200g + 0.5kg)
const items2 = [
    { name: 'milk', quantity: 200, unit: 'gram' },
    { name: 'milk', quantity: 0.5, unit: 'kilogram' }
];
console.log("\n--- Test Case 2: Milk ---");
const result2 = groupAndSum(items2, 0);
console.log(`Result: ${result2.totalGrams}g`);

// Test Case 3: Each only
const items3 = [
    { name: 'egg', quantity: 6, unit: 'each' },
    { name: 'egg', quantity: 1, unit: 'each' }
];
console.log("\n--- Test Case 3: Egg ---");
const result3 = groupAndSum(items3, 50); // 50g per egg
console.log(`Result: ${result3.totalGrams.toFixed(0)}g or ${result3.totalEach.toFixed(1)} eggs`);
