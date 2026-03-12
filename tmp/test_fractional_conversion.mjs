
import { convertMetricReading } from '../lib/conversion.js';

const testCases = [
    "Half Pumpkin",
    "Quarter Cabbage",
    "Halved Chicken",
    "Quartered Turkey",
    "Cut Onion",
    "2 Cut Tomatoes",
    "1/2 Cut Apple"
];

testCases.forEach(input => {
    const result = convertMetricReading(input);
    console.log(`Input: "${input}" -> Quantity: ${result.quantity}, Unit: ${result.quantity_unit}`);
});
