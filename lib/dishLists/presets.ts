// Client-safe list metadata. Kept separate from tasteAtlas.ts (which pulls in
// cheerio) so browser bundles never include a Node-only HTML parser.

export interface TasteAtlasPreset {
    key: string
    name: string
    url: string
    description: string
    dietaryFilters: string[]
    /** Defaults to 'tasteatlas'. Manual presets (no URL) set 'manual'. */
    sourceType?: 'tasteatlas' | 'manual' | 'custom'
    /** Seeded lists from this preset open Add dishes on the Country grid tab. */
    showCountryGrid?: boolean
}

export const TASTEATLAS_PRESETS: TasteAtlasPreset[] = [
    {
        key: 'best-dishes',
        name: '100 Best Dishes in the World',
        url: 'https://www.tasteatlas.com/best/dishes',
        description: 'TasteAtlas Awards — 100 best dishes in the world.',
        dietaryFilters: []
    },
    {
        key: 'best-side-dishes',
        name: 'Best Side Dishes in the World',
        url: 'https://www.tasteatlas.com/best-rated-side-dishes-in-the-world',
        description: 'TasteAtlas — best-rated side dishes in the world.',
        dietaryFilters: []
    },
    {
        key: 'vegetarian-dishes',
        name: '100 Best Vegetarian Dishes in the World',
        url: 'https://www.tasteatlas.com/best-rated-vegetarian-dishes-in-the-world',
        description: 'TasteAtlas — best-rated vegetarian dishes in the world.',
        dietaryFilters: ['vegetarian']
    },
    {
        key: 'vegan-dishes',
        name: '100 Best Vegan Dishes in the World',
        url: 'https://www.tasteatlas.com/best-rated-vegan-dishes-in-the-world',
        description: 'TasteAtlas — best-rated vegan dishes in the world.',
        dietaryFilters: ['vegan']
    },
    {
        key: 'vegetarian-every-country',
        name: 'Vegetarian Dish from Every Country',
        url: '',
        description: 'One vegetarian dish from every country — curated by hand.',
        dietaryFilters: ['vegetarian'],
        sourceType: 'manual',
        showCountryGrid: true
    }
]

export const getPreset = (key: string): TasteAtlasPreset | undefined =>
    TASTEATLAS_PRESETS.find(p => p.key === key)
