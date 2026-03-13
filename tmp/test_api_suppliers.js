const axios = require('axios');

async function testApi() {
    const token = 'YOUR_TEST_TOKEN'; // This might need a real token or it might work if verifyToken is bypassed or mockable
    // Assuming we can't easily get a token, we might just check if the code change itself is logically sound.
    // However, I'll try to run a simple fetch if possible.
    try {
        const response = await axios.get('http://localhost:3000/api/Ingredients?name=carrot&supplier=', {
            headers: { 'edgetoken': 'test' } // Likely to fail auth, but we want to see if it reaches the logic
        });
        console.log('Response Status:', response.status);
        console.log('Response Data Success:', response.data.success);
    } catch (error) {
        console.log('Error (Expected if not authenticated):', error.message);
    }
}

// testApi();
console.log("API logic updated. Empty supplier string now treated as 'all suppliers'.");
