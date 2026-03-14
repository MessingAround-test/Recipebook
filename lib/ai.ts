import { GoogleGenerativeAI } from "@google/generative-ai";
import dbConnect from "./dbConnect";
import ApiKeyStatus from "../models/ApiKeyStatus";
import ApiKeyUsage from "../models/ApiKeyUsage";

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

/**
 * Ensures all Groq API keys (1-3) have a status record in the database.
 */
async function ensureApiKeyStatuses() {
    await dbConnect();
    for (let i = 1; i <= 3; i++) {
        const exists = await ApiKeyStatus.findOne({ keyIndex: i });
        if (!exists) {
            await ApiKeyStatus.create({
                keyIndex: i,
                primaryStatus: 'AVAILABLE',
                fallbackStatus: 'AVAILABLE',
                primaryLastOverloaded: new Date(0), // Far past
                fallbackLastOverloaded: new Date(0)
            });
        }
    }
}

/**
 * Updates the status of a specific model for a key.
 */
async function updateKeyStatus(index: number, modelType: 'PRIMARY' | 'FALLBACK', status: 'AVAILABLE' | 'OVERLOADED') {
    await dbConnect();
    const update: any = {};
    if (modelType === 'PRIMARY') {
        update.primaryStatus = status;
        if (status === 'OVERLOADED') update.primaryLastOverloaded = new Date();
    } else {
        update.fallbackStatus = status;
        if (status === 'OVERLOADED') update.fallbackLastOverloaded = new Date();
    }
    await ApiKeyStatus.findOneAndUpdate({ keyIndex: index }, update);
}

/**
 * Logs usage and overloads for a specific key and model per hour.
 */
async function logUsage(index: number, modelType: 'PRIMARY' | 'FALLBACK', isOverload: boolean = false) {
    try {
        await dbConnect();
        const now = new Date();
        const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

        await ApiKeyUsage.findOneAndUpdate(
            { keyIndex: index, modelType, hour: startOfHour },
            { 
                $inc: { 
                    callCount: 1, 
                    overloadCount: isOverload ? 1 : 0 
                } 
            },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('Error logging API usage:', err);
    }
}

export async function callGroqWithFallback(body: any) {
    await ensureApiKeyStatuses();
    
    // Get all statuses and sort by the oldest "last overloaded" time
    const statuses = await ApiKeyStatus.find().sort({
        // Use the older of the two overloaded dates to determine priority
        primaryLastOverloaded: 1,
        fallbackLastOverloaded: 1
    });

    const primaryModel = GROQ_MODELS.PRIMARY;
    const fallbackModel = GROQ_MODELS.FALLBACK;

    // Iterate through keys in sorted order
    for (const keyStatus of statuses) {
        const index = keyStatus.keyIndex;
        const apiKey = process.env[`GROQ_API_KEY_${index}`] || (index === 1 ? process.env.GROQ_API_KEY : null);
        
        if (!apiKey) {
            console.warn(`GROQ_API_KEY_${index} is not defined, skipping.`);
            continue;
        }

        // 1. Try Primary Model on this key
        if (keyStatus.primaryStatus === 'AVAILABLE' || statuses.every(s => s.primaryStatus === 'OVERLOADED')) {
            let retryCount = 0;
            const maxRetries = 1;

            while (retryCount <= maxRetries) {
                try {
                    console.log(`Attempting Groq [Key ${index}] with primary model: ${primaryModel}${retryCount > 0 ? ' (Retry)' : ''}`);
                    await logUsage(index, 'PRIMARY', false);

                    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ ...body, model: primaryModel }),
                    });

                    if (response.status === 429) {
                        console.warn(`Groq Key ${index} Primary rate limited.`);
                        await updateKeyStatus(index, 'PRIMARY', 'OVERLOADED');
                        await logUsage(index, 'PRIMARY', true);
                        break; // Move to fallback on same key
                    } else if (response.status === 400) {
                        const errorData = await response.json().catch(() => ({}));
                        if (errorData.error?.code === 'json_validate_failed' && retryCount < maxRetries) {
                            console.warn(`Groq Key ${index} Primary JSON validation failed, retrying once...`);
                            retryCount++;
                            continue;
                        }
                        // Non-retryable 400 or out of retries
                        console.error(`Groq Key ${index} Primary Error (400 - Final):`, errorData);
                        if (errorData.error?.code === 'json_validate_failed') {
                            throw new Error('JSON_VALIDATION_FAILED');
                        }
                        break; // Stop retrying this model
                    } else if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error(`Groq Key ${index} Primary Error (${response.status}):`, errorData);
                        break;
                    } else {
                        if (keyStatus.primaryStatus === 'OVERLOADED') await updateKeyStatus(index, 'PRIMARY', 'AVAILABLE');
                        return response;
                    }
                } catch (err: any) {
                    if (err.message === 'JSON_VALIDATION_FAILED') throw err;
                    console.error(`Fetch error for Key ${index} Primary:`, err);
                    break;
                }
            }
        }

        // 2. Try Fallback Model on this key
        if (keyStatus.fallbackStatus === 'AVAILABLE' || statuses.every(s => s.fallbackStatus === 'OVERLOADED')) {
            let retryCount = 0;
            const maxRetries = 1;

            while (retryCount <= maxRetries) {
                try {
                    console.log(`Attempting Groq [Key ${index}] with fallback model: ${fallbackModel}${retryCount > 0 ? ' (Retry)' : ''}`);
                    await logUsage(index, 'FALLBACK', false);

                    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ ...body, model: fallbackModel }),
                    });

                    if (response.status === 429) {
                        console.warn(`Groq Key ${index} Fallback rate limited.`);
                        await updateKeyStatus(index, 'FALLBACK', 'OVERLOADED');
                        await logUsage(index, 'FALLBACK', true);
                        break; // Move to next key
                    } else if (response.status === 400) {
                        const errorData = await response.json().catch(() => ({}));
                        if (errorData.error?.code === 'json_validate_failed' && retryCount < maxRetries) {
                            console.warn(`Groq Key ${index} Fallback JSON validation failed, retrying once...`);
                            retryCount++;
                            continue;
                        }
                        console.error(`Groq Key ${index} Fallback Error (400 - Final):`, errorData);
                        if (errorData.error?.code === 'json_validate_failed') {
                            throw new Error('JSON_VALIDATION_FAILED');
                        }
                        break;
                    } else if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error(`Groq Key ${index} Fallback Error (${response.status}):`, errorData);
                        break;
                    } else {
                        if (keyStatus.fallbackStatus === 'OVERLOADED') await updateKeyStatus(index, 'FALLBACK', 'AVAILABLE');
                        return response;
                    }
                } catch (err: any) {
                    if (err.message === 'JSON_VALIDATION_FAILED') throw err;
                    console.error(`Fetch error for Key ${index} Fallback:`, err);
                    break;
                }
            }
        }
    }

    throw new Error('All Groq API keys and models are exhausted or rate limited.');
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

