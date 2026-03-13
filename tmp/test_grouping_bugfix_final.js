// Self-contained test script to verify REFINED grouping logic with field fallbacks

const quantity_unit_conversions = {
    "each": { "synonyms": ["each", "eachs", "x", "pack"], "type": "each", "shorthand": "ea" },
    "gram": { "synonyms": ["gram", "grams", "g", "gs"], "type": "weight", "shorthand": "g" },
    "kilogram": { "synonyms": ["kilogram", "kilograms", "kg", "kgs"], "type": "weight", "shorthand": "kg" }
};

function resolveUnitKey(unit) {
    if (!unit) return 'each';
    const lowerUnit = unit.toLowerCase().trim();
    for (const key in quantity_unit_conversions) {
        if (key === lowerUnit || quantity_unit_conversions[key].synonyms.includes(lowerUnit)) {
            return key;
        }
    }
    return lowerUnit;
}

function normalizeToGramsMock(unit, quantity, gramsPerEach) {
    const canonicalUnit = resolveUnitKey(unit);
    const conversions = {
        'gram': 1,
        'kilogram': 1000
    };

    if (conversions[canonicalUnit]) {
        return { value: quantity * conversions[canonicalUnit], source: 'explicit' };
    }

    if (canonicalUnit === 'each' && gramsPerEach > 0) {
        return { value: quantity * gramsPerEach, source: 'ai' };
    }

    return { value: null, source: null };
}

function groupAndSum(items, gramsPerEach) {
    let totalGrams = 0;
    let totalEach = 0;

    for (const item of items) {
        // Field fallback simulation (item.quantity_unit || item.quantity_type || 'each')
        const unit = item.quantity_unit || item.quantity_type || 'each';
        const normalized = normalizeToGramsMock(unit, item.quantity, gramsPerEach);
        console.log(`Item: ${item.quantity}${unit} -> Normalized: ${normalized.value}g`);

        if (normalized.value !== null) {
            totalGrams += normalized.value;
            if (gramsPerEach > 0) {
                totalEach += normalized.value / gramsPerEach;
            } else {
                const canonical = resolveUnitKey(unit);
                if (canonical === 'each') totalEach += item.quantity;
            }
        } else {
            const canonical = resolveUnitKey(unit);
            if (canonical === 'each') {
                totalEach += item.quantity;
                if (gramsPerEach > 0) totalGrams += item.quantity * gramsPerEach;
            }
        }
    }

    return { totalGrams, totalEach };
}

// Test Case: Field fallback bug (using quantity_type)
console.log("--- Test Case: Field Fallback (using quantity_type='g') ---");
const gramsPerEachCarrot = 60;
const items1 = [
    { name: 'carrot', quantity: 100, quantity_type: 'g' } // quantity_unit is missing
];
const result1 = groupAndSum(items1, gramsPerEachCarrot);
console.log(`Input: 100 with quantity_type='g'`);
console.log(`Expected: 100g or 1.7ea`);
console.log(`Actual:   ${result1.totalGrams.toFixed(0)}g or ${result1.totalEach.toFixed(1)}ea`);

// Test Case: Mix
console.log("\n--- Test Case: Mixed units with partial fields ---");
const items2 = [
    { name: 'carrot', quantity: 1, quantity_type: 'each' },
    { name: 'carrot', quantity: 500, quantity_unit: 'gram' }
];
const result2 = groupAndSum(items2, 60);
console.log(`Expected: 560g or 9.3ea`);
console.log(`Actual:   ${result2.totalGrams.toFixed(0)}g or ${result2.totalEach.toFixed(1)}ea`);
