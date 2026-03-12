
import { convertMetricReading } from './lib/conversion.js';

const testCases = [
    "Half Pumpkin",
    "Quarter Cabbage",
    "Halved Chicken",
    "Quartered Turkey",
    "1 Half Watermelon",
    "2 Halved Lemons",
    "1/2 Half Apple" // Edge case: should be 0.25 or 0.5?
];

testCases.forEach(input => {
    const result = convertMetricReading(input);
    console.log(`Input: "${input}" -> Quantity: ${result.quantity}, Unit: ${result.quantity_unit}`);
});
