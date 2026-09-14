import { callGroqChat } from '../ai'

export interface DishBlurbInput {
    name: string
    category?: string
    country?: string
    criteria?: string[]
}

/**
 * Builds the Groq prompt for a short dish blurb. Exported separately so the
 * prompt can be unit-tested without hitting the network.
 */
export const buildBlurbMessages = (input: DishBlurbInput) => {
    const context = [
        input.category ? `Category: ${input.category}` : '',
        input.country ? `Origin country: ${input.country}` : '',
        input.criteria && input.criteria.length ? `Dietary context: ${input.criteria.join(', ')}` : ''
    ].filter(Boolean).join('\n')

    return [
        {
            role: 'system',
            content: 'You write concise, appetising food descriptions. Reply with JSON only, shaped {"blurb": "..."}. The blurb must be 1-2 sentences (max 240 characters), factual where possible, and must never invent specific restaurants or awards.'
        },
        {
            role: 'user',
            content: `Write a short blurb for the dish "${input.name}".\n${context}`
        }
    ]
}

const sanitizeBlurb = (value: string): string =>
    value.replace(/\s+/g, ' ').trim().slice(0, 400)

/** Generates a short dish blurb with Groq. Returns null on any failure. */
export const generateDishBlurb = async (input: DishBlurbInput): Promise<string | null> => {
    if (!input?.name) return null
    try {
        const content = await callGroqChat(buildBlurbMessages(input), true)
        const parsed = JSON.parse(content)
        const blurb = typeof parsed?.blurb === 'string' ? sanitizeBlurb(parsed.blurb) : ''
        return blurb || null
    } catch (err: any) {
        console.error('[dishLists] Blurb generation failed:', err?.message || err)
        return null
    }
}
