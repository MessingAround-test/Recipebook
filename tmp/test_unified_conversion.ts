
import { filter } from '../lib/filtering.ts';
import * as conversion from '../lib/conversion.js';

// No mocking needed for basic extraction tests
const testCases = [
    {
        name: "Woolworths Butternut Pumpkin Cut (Extract from name)",
        input: "Woolworths Butternut Pumpkin Cut",
        expectedQuantity: 0.35,
        testType: "conversion"
    },
    {
        name: "Bunch test - Coriander Bunch",
        input: "Coriander Bunch",
        expectedQuantity: 1,
        expectedUnit: "bunch",
        testType: "conversion"
    },
    {
        name: "Head test - Head of Lettuce",
        input: "Head of Lettuce",
        expectedQuantity: 1,
        expectedUnit: "head",
        testType: "conversion"
    },
    {
        name: "Mixed number - 1 1/2kg Carrots",
        input: "1 1/2kg Carrots",
        expectedQuantity: 1.5,
        expectedUnit: "kilogram",
        testType: "conversion"
    }
];

console.log("Running Unified Conversion Tests...\n");

testCases.forEach((tc, i) => {
    if (tc.testType === "conversion") {
        console.log(`Test ${i + 1}: ${tc.name}`);
        const result = conversion.convertMetricReading(tc.input);
        console.log(`  Input: "${tc.input}"`);
        console.log(`  Extracted: ${result.quantity} ${result.quantity_unit}`);

        const qtyMatch = result.quantity === tc.expectedQuantity;
        const unitMatch = !tc.expectedUnit || result.quantity_unit === tc.expectedUnit;

        if (qtyMatch && unitMatch) {
            console.log("  ✅ SUCCESS");
        } else {
            console.log(`  ❌ FAILURE: Expected ${tc.expectedQuantity} ${tc.expectedUnit || ''}, got ${result.quantity} ${result.quantity_unit}`);
        }
        console.log("");
    }
});

console.log("Tests Complete.");
