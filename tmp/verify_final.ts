
import { filter } from '../lib/filtering.ts';
import * as conversion from '../lib/conversion.js';

const testCases = [
    {
        name: "Woolworths Butternut Pumpkin Cut (Extract from name)",
        input: "Woolworths Butternut Pumpkin Cut",
        expectedQty: 0.35,
        expectedUnit: "each"
    },
    {
        name: "Coles Carrots 1kg (Standard conversion)",
        input: "Coles Carrots 1kg",
        expectedQty: 1000,
        expectedUnit: "gram"
    },
    {
        name: "Fresh Bunch Coriander (Bunch unit)",
        input: "Fresh Bunch Coriander",
        expectedQty: 1,
        expectedUnit: "bunch"
    }
];

testCases.forEach(tc => {
    const result = conversion.convertMetricReading(tc.input);
    const success = result.quantity === tc.expectedQty && result.quantity_unit === tc.expectedUnit;
    console.log(`${success ? '✅' : '❌'} ${tc.name}: Got ${result.quantity} ${result.quantity_unit}, Expected ${tc.expectedQty} ${tc.expectedUnit}`);
});
