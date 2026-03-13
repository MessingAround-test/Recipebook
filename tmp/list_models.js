
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key found in GOOGLE_API_KEY or GEMINI_API_KEY");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // We can't directly list models from genAI object in all versions, 
        // but we can try fetching from the REST API or use the listModels method if it exists in this SDK version.
        // In @google/generative-ai, listModels is not on the genAI object usually, 
        // it's a separate fetch or part of the vertex AI SDK.
        
        // Let's try to just check if imagen-3.0-alpha-generate-001 or something else exists.
        // Actually, let's try a direct fetch to list models.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
