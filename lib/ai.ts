export const GROQ_MODELS = {
    PRIMARY: 'llama-3.3-70b-versatile',
    FALLBACK: 'llama-3.1-8b-instant',
    AUDIO: 'whisper-large-v3'
};

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
