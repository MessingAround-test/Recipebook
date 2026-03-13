import { GoogleGenerativeAI } from "@google/generative-ai";

export const GROQ_MODELS = {
    PRIMARY: 'llama-3.3-70b-versatile',
    FALLBACK: 'llama-3.1-8b-instant',
    AUDIO: 'whisper-large-v3'
};

export const IMAGEN_MODELS = {
    PRIMARY: 'imagen-4.0-generate-001',
    FALLBACK_FAST: 'imagen-4.0-fast-generate-001',
    FALLBACK_ULTRA: 'imagen-4.0-ultra-generate-001'
};

export async function generateGeminiImage(prompt: string): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is not defined');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    async function attemptImageGeneration(modelName: string): Promise<string> {
        console.log(`Attempting image generation with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        const candidates = response.candidates;
        if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts[0].inlineData) {
            const imageData = candidates[0].content.parts[0].inlineData.data;
            const mimeType = candidates[0].content.parts[0].inlineData.mimeType;
            return `data:${mimeType};base64,${imageData}`;
        }
        throw new Error("No image data returned from Gemini");
    }

    try {
        return await attemptImageGeneration(IMAGEN_MODELS.PRIMARY);
    } catch (error: any) {
        // Handle rate limit (429) fallback
        if (error.message?.includes('429') || error.status === 429) {
            console.warn(`Primary Imagen model rate limited. Retrying with fallback: ${IMAGEN_MODELS.FALLBACK_FAST}`);
            try {
                return await attemptImageGeneration(IMAGEN_MODELS.FALLBACK_FAST);
            } catch (fallbackError: any) {
                console.warn(`Fallback fast model failed. Retrying with ultra: ${IMAGEN_MODELS.FALLBACK_ULTRA}`);
                return await attemptImageGeneration(IMAGEN_MODELS.FALLBACK_ULTRA);
            }
        }
        
        console.error("Gemini Image Generation Error:", error.message);
        throw error;
    }
}

export async function callGroqWithFallback(body: any) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('GROQ_API_KEY is not defined');
    }

    const primaryModel = GROQ_MODELS.PRIMARY;
    const fallbackModel = GROQ_MODELS.FALLBACK;

    try {
        // Attempt with primary model
        console.log(`Attempting Groq request with primary model: ${primaryModel}`);
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...body,
                model: primaryModel
            }),
        });

        if (response.status === 429) {
            console.warn(`Groq primary model (${primaryModel}) rate limited (429). Retrying with fallback: ${fallbackModel}`);
            return await retryWithFallback(body, fallbackModel, apiKey);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Groq API error (${response.status}): ${JSON.stringify(errorData)}`);
        }

        return response;
    } catch (error: any) {
        // If it's already a 429 error from the fetch itself (headers/meta)
        if (error.message?.includes('429')) {
            console.warn(`Caught 429 error. Retrying with fallback: ${fallbackModel}`);
            return await retryWithFallback(body, fallbackModel, apiKey);
        }
        throw error;
    }
}

async function retryWithFallback(body: any, fallbackModel: string, apiKey: string) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ...body,
            model: fallbackModel
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Groq Fallback API error (${response.status}): ${JSON.stringify(errorData)}`);
    }

    return response;
}

export async function callGroqChat(messages: any[], jsonMode: boolean = false) {
    const body: any = {
        messages: messages,
    };

    if (jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    const response = await callGroqWithFallback(body);
    const data = await response.json();
    return data.choices[0].message.content;
}

