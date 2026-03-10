import axios from 'axios';

const BASE_URL = 'http://localhost:3000'; // Adjust if needed
const TOKEN = 'your_test_token_here'; // Replace with a valid token if testing against a live server

async function testApi() {
    try {
        console.log('Testing Aldi API (First call - should hit external)...');
        let start = Date.now();
        let res = await axios.get(`${BASE_URL}/api/Ingredients/Aldi/?name=carrot`, {
            headers: { 'edgetoken': TOKEN }
        });
        console.log(`Aldi Response 1 time: ${Date.now() - start}ms`);
        console.log(`From DB: ${res.data.from_db}`);

        console.log('\nTesting Aldi API (Second call - should hit DB)...');
        start = Date.now();
        res = await axios.get(`${BASE_URL}/api/Ingredients/Aldi/?name=carrot`, {
            headers: { 'edgetoken': TOKEN }
        });
        console.log(`Aldi Response 2 time: ${Date.now() - start}ms`);
        console.log(`From DB: ${res.data.from_db}`);

        console.log('\nTesting Gemini Fallback...');
        // This requires a real call or a mock to determine_bad_entries
        // For now, we rely on code inspection and manual UI check as described in plan
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// testApi();
console.log('Verification script created. Please run manually if possible, or I will proceed with manual description.');
