const axios = require('axios');

async function checkWoolworthsAPI() {
    try {
        const response = await axios.get('http://localhost:3000/api/Ingredients/WW?name=eggs&force=true', {
            headers: {
                // Adjust if needed, depending on how verifyToken works locally
                edgetoken: process.env.TOKEN || 'mock-token-for-local-testing'
            }
        });

        console.log("Response:", JSON.stringify(response.data.res.slice(0, 3), null, 2));
    } catch (e) {
        console.error("Test error:", e.message);
    }
}

checkWoolworthsAPI();
