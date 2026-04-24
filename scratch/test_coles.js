const axios = require('axios');

async function testColes() {
    try {
        console.log("Fetching Coles homepage...");
        const res = await axios.get('https://www.coles.com.au/', {
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
            }
        });
        const match = res.data.match(/"buildId":"([^"]+)"/);
        const buildId = match ? match[1] : "NOT FOUND";
        console.log("Found Build ID:", buildId);

        if (buildId !== "NOT FOUND") {
            const searchUrl = `https://www.coles.com.au/_next/data/${buildId}/en/search/products.json?q=milk`;
            console.log("Testing search URL:", searchUrl);
            const searchRes = await axios.get(searchUrl, {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                    'x-nextjs-data': '1'
                }
            });
            console.log("Search Result Success:", searchRes.status === 200);
            console.log("Results count:", searchRes.data?.pageProps?.searchResults?.results?.length || 0);
        }
    } catch (err) {
        console.error("Error:", err.message);
        if (err.response) {
            console.error("Status:", err.response.status);
        }
    }
}

testColes();
