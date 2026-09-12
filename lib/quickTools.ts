// Quick Tools — shared data model and pure helpers.
// Everything here is side-effect free so it can be unit tested and reused
// by both the Quick Tools page and the timer hook.

export type ToolKind = 'timer' | 'stopwatch' | 'presets' | 'unit' | 'oven'

export interface QuickTool {
    id: string
    name: string
    description: string
    kind: ToolKind
    keywords: string[]
}

export interface GuideSection {
    heading?: string
    body?: string
    bullets?: string[]
}

export interface QuickGuide {
    id: string
    title: string
    summary: string
    category: string
    keywords: string[]
    sections: GuideSection[]
}

export interface TimerPreset {
    id: string
    label: string
    seconds: number
    category: string
    keywords: string[]
}

export interface TimerSession {
    endTime: number | null
    remainingSec: number
    status: string
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const QUICK_TOOLS: QuickTool[] = [
    {
        id: 'quick-timer',
        name: 'Quick Timer',
        description: 'Set a countdown for anything — rings when it is done.',
        kind: 'timer',
        keywords: ['countdown', 'alarm', 'clock', 'cook', 'minutes', 'seconds', 'timer']
    },
    {
        id: 'stopwatch',
        name: 'Stopwatch',
        description: 'Count up from zero with laps.',
        kind: 'stopwatch',
        keywords: ['count up', 'timer', 'elapsed', 'lap', 'stopwatch', 'clock']
    },
    {
        id: 'preset-timers',
        name: 'Preset Timers',
        description: 'One-tap times for eggs, rice, pasta, resting meat and tea.',
        kind: 'presets',
        keywords: ['eggs', 'rice', 'pasta', 'meat', 'tea', 'boil', 'preset', 'quick', 'timer']
    },
    {
        id: 'unit-converter',
        name: 'Kitchen Converter',
        description: 'Convert cups, tablespoons, millilitres, grams and ounces.',
        kind: 'unit',
        keywords: ['cups', 'tablespoon', 'teaspoon', 'ml', 'grams', 'ounces', 'volume', 'weight', 'convert', 'measure']
    },
    {
        id: 'oven-converter',
        name: 'Oven Temperatures',
        description: 'Celsius, Fahrenheit, fan-forced and gas mark.',
        kind: 'oven',
        keywords: ['oven', 'celsius', 'fahrenheit', 'fan', 'gas mark', 'temperature', 'degrees', 'convert', 'bake']
    }
]

// ---------------------------------------------------------------------------
// Timer presets — one tap creates and starts a named countdown
// ---------------------------------------------------------------------------

export const TIMER_PRESETS: TimerPreset[] = [
    { id: 'egg-soft', label: 'Soft-boiled egg', seconds: 6 * 60, category: 'Eggs', keywords: ['boiled', 'egg', 'runny', 'breakfast'] },
    { id: 'egg-medium', label: 'Medium-boiled egg', seconds: 8 * 60, category: 'Eggs', keywords: ['boiled', 'egg', 'jammy', 'breakfast'] },
    { id: 'egg-hard', label: 'Hard-boiled egg', seconds: 10 * 60, category: 'Eggs', keywords: ['boiled', 'egg', 'solid', 'breakfast'] },
    { id: 'rice', label: 'Rice', seconds: 12 * 60, category: 'Grains', keywords: ['jasmine', 'basmati', 'rice', 'simmer'] },
    { id: 'pasta', label: 'Pasta (al dente)', seconds: 9 * 60, category: 'Pasta', keywords: ['pasta', 'spaghetti', 'al dente', 'boil'] },
    { id: 'rest-meat', label: 'Resting meat', seconds: 10 * 60, category: 'Meat', keywords: ['rest', 'steak', 'roast', 'meat'] },
    { id: 'green-tea', label: 'Green tea', seconds: 2 * 60, category: 'Drinks', keywords: ['tea', 'green', 'brew', 'steep'] },
    { id: 'black-tea', label: 'Black tea', seconds: 3 * 60, category: 'Drinks', keywords: ['tea', 'black', 'brew', 'steep'] },
    { id: 'coffee', label: 'Plunger coffee', seconds: 4 * 60, category: 'Drinks', keywords: ['coffee', 'french press', 'plunger', 'brew'] },
    { id: 'steam-veg', label: 'Steam vegetables', seconds: 5 * 60, category: 'Veg', keywords: ['steam', 'vegetables', 'broccoli', 'greens'] },
    { id: 'blanch-veg', label: 'Blanch vegetables', seconds: 2 * 60, category: 'Veg', keywords: ['blanch', 'vegetables', 'greens', 'parboil'] }
]

// ---------------------------------------------------------------------------
// Quick guides — short, practical reference cards
// ---------------------------------------------------------------------------

export const QUICK_GUIDES: QuickGuide[] = [
    {
        id: 'seasoning-pan',
        title: 'Seasoning a pan',
        summary: 'Build and keep a non-stick layer on carbon steel and cast iron.',
        category: 'Pans',
        keywords: ['season', 'pan', 'carbon steel', 'cast iron', 'non stick', 'rust', 'oil', 'stainless'],
        sections: [
            {
                heading: 'Know your pan first',
                bullets: [
                    'Carbon steel & cast iron — raw iron, seasoned with oil, can rust.',
                    'Stainless steel — not seasoned; use the preheat-and-oil technique.',
                    'Non-stick coated — never season or heat empty; the coating does the work.'
                ]
            },
            {
                heading: 'Seasoning carbon steel / cast iron',
                bullets: [
                    'Scrub off any rust, wash and dry completely.',
                    'Warm the pan over medium heat until fully dry.',
                    'Add a thin film of high-smoke-point oil (canola, grapeseed, flax).',
                    'Wipe it almost dry with a paper towel — thin layers cure best.',
                    'Heat until it just starts to smoke, 2–3 min, then cool.',
                    'Repeat 3–5 times for a dark, glossy, non-stick finish.'
                ]
            },
            {
                heading: 'The stainless preheat trick',
                body: 'Heat the empty pan over medium until a flick of water forms a dancing bead (Leidenfrost). Add oil, swirl, then add food. This gives a temporary non-stick surface.',
                bullets: [
                    'Not hot enough: water sizzles and evaporates immediately.',
                    'Just right: a bead rolls around the pan like mercury.'
                ]
            },
            {
                heading: 'Keeping the season',
                bullets: [
                    'Wash with warm water and a soft sponge — no harsh soap needed.',
                    'Dry on the stove over low heat, then wipe a tiny oil film.',
                    'Never soak cast iron or leave it wet.',
                    'Re-season if food sticks or the surface looks dull or patchy.'
                ]
            }
        ]
    },
    {
        id: 'pan-heat',
        title: 'Judging pan & oil heat',
        summary: 'Test heat without a thermometer before food hits the pan.',
        category: 'Pans',
        keywords: ['heat', 'temperature', 'oil', 'smoke', 'sear', 'pan', 'water test'],
        sections: [
            {
                heading: 'Water test (stainless / carbon steel)',
                bullets: [
                    'Cold: nothing happens.',
                    'Warming: water bubbles and spits.',
                    'Ready: a bead forms and glides across the surface.'
                ]
            },
            {
                heading: 'Oil cues',
                bullets: [
                    'Shimmering, rippling surface — medium-high, good for searing.',
                    'Faint wisp of smoke — at the smoke point; add food now.',
                    'Full smoke — too hot; pull off the heat, let it cool a little.',
                    'No shimmer — not hot enough; food will steam and stick.'
                ]
            },
            {
                heading: 'Hand test',
                body: 'Hold your palm about 15 cm above the dry pan. You should need to pull it away after 2–3 seconds when ready to sear.'
            },
            {
                heading: 'Tips',
                bullets: [
                    'Pat food dry — surface moisture cools the pan and causes sticking.',
                    'Do not overcrowd; food steams instead of browning.',
                    'Let the pan reheat between batches.'
                ]
            }
        ]
    },
    {
        id: 'resting-meat',
        title: 'Resting meat',
        summary: 'How long to rest and why it makes meat juicier.',
        category: 'Meat',
        keywords: ['rest', 'meat', 'steak', 'roast', 'juice', 'carryover'],
        sections: [
            {
                heading: 'Why rest',
                body: 'Heat drives juices to the centre. Resting lets them redistribute so they stay in the meat when you slice, not on the board.'
            },
            {
                heading: 'Rough times',
                bullets: [
                    'Steaks & chops — 5 min (thick cuts 8–10 min).',
                    'Whole roast chicken — 10–15 min.',
                    'Large beef roast — 15–20 min, loosely tented.',
                    'Fish fillets — 2–3 min.'
                ]
            },
            {
                heading: 'Do it right',
                bullets: [
                    'Tent loosely with foil — do not wrap tight or the crust steams.',
                    'Rest on a warm plate or board.',
                    'Remember carryover: internal temp rises 3–5°C while resting, so pull early.'
                ]
            }
        ]
    },
    {
        id: 'knife-care',
        title: 'Knife care & sharpening',
        summary: 'Honing vs sharpening, angles and keeping edges alive.',
        category: 'Knives',
        keywords: ['knife', 'sharpen', 'hone', 'steel', 'whetstone', 'edge', 'care'],
        sections: [
            {
                heading: 'Hone vs sharpen',
                bullets: [
                    'Honing (steel) — realigns a rolled edge; do it every few uses.',
                    'Sharpening (stone) — removes metal to create a new edge; every 3–6 months.',
                    'A honing steel will not fix a dull knife.'
                ]
            },
            {
                heading: 'Angles',
                bullets: [
                    'Western knives — about 20° per side.',
                    'Japanese knives — about 15° per side.',
                    'Hold the angle steady; consistency beats pressure.'
                ]
            },
            {
                heading: 'Keeping it sharp',
                bullets: [
                    'Hand wash and dry straight away — no dishwasher.',
                    'Store on a magnetic strip, in a block, or with edge guards.',
                    'Use a soft cutting board (wood or plastic), never glass.',
                    'Cut on the board, not through bone or frozen food.'
                ]
            }
        ]
    },
    {
        id: 'rice-ratios',
        title: 'Rice & water ratios',
        summary: 'Absorption-method ratios for common rices.',
        category: 'Grains',
        keywords: ['rice', 'water', 'ratio', 'jasmine', 'basmati', 'sushi', 'brown', 'grains'],
        sections: [
            {
                heading: 'Ratio (rice : water)',
                bullets: [
                    'Long-grain white — 1 : 1.5',
                    'Jasmine / basmati — 1 : 1.5',
                    'Sushi / short-grain — 1 : 1.25',
                    'Brown rice — 1 : 2'
                ]
            },
            {
                heading: 'Method',
                bullets: [
                    'Rinse until the water runs clear (skip for risotto).',
                    'Bring to a boil, then drop to the lowest simmer.',
                    'Cover and cook without stirring: white 12 min, brown 35–40 min.',
                    'Rest off the heat, covered, 10 min, then fluff with a fork.'
                ]
            }
        ]
    },
    {
        id: 'pasta-water',
        title: 'Salting pasta water',
        summary: 'Season the pasta from the inside and use the starchy water.',
        category: 'Pasta',
        keywords: ['pasta', 'salt', 'water', 'starch', 'sauce', 'boil'],
        sections: [
            {
                heading: 'How much salt',
                bullets: [
                    'About 10 g (1 heaped tsp) per litre of water.',
                    'Taste the water — it should be seasoned like a light soup.',
                    'Add salt once boiling, before the pasta.'
                ]
            },
            {
                heading: 'Cooking',
                bullets: [
                    'Use plenty of water so it returns to a boil quickly.',
                    'Stir in the first minute so pasta does not stick.',
                    'No oil needed — it makes sauce slide off.'
                ]
            },
            {
                heading: 'Save the water',
                body: 'Reserve a mug of starchy pasta water before draining. Add it to the sauce to emulsify and help it cling.'
            }
        ]
    },
    {
        id: 'blanching',
        title: 'Blanching & shocking',
        summary: 'Set colour and crunch, then stop the cooking fast.',
        category: 'Veg',
        keywords: ['blanch', 'shock', 'ice bath', 'vegetables', 'greens', 'parboil'],
        sections: [
            {
                heading: 'Steps',
                bullets: [
                    'Boil salted water and prepare a bowl of ice water.',
                    'Cook in small batches so the water keeps boiling.',
                    'Lift straight into the ice bath for the same time as cooking.',
                    'Drain and dry before reheating or dressing.'
                ]
            },
            {
                heading: 'Rough times',
                bullets: [
                    'Peas & beans — 1–2 min',
                    'Broccoli & asparagus — 2–3 min',
                    'Leafy greens — 30–60 sec',
                    'Carrots (batons) — 3–4 min'
                ]
            }
        ]
    },
    {
        id: 'deglazing',
        title: 'Deglazing & pan sauce',
        summary: 'Turn browned pan bits into a quick sauce.',
        category: 'Sauces',
        keywords: ['deglaze', 'pan sauce', 'fond', 'wine', 'stock', 'butter', 'sauce'],
        sections: [
            {
                heading: 'What is fond',
                body: 'The browned bits stuck to the pan after searing are concentrated flavour. Deglazing dissolves them into a liquid.'
            },
            {
                heading: 'Method',
                bullets: [
                    'Cook off excess fat; keep the fond.',
                    'Pour in wine, stock, cider or even water while the pan is hot.',
                    'Scrape the base with a wooden spoon until it is clean.',
                    'Reduce by half, then finish off the heat with cold butter.',
                    'Season and taste — add herbs, mustard or a splash of vinegar.'
                ]
            }
        ]
    }
]

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, '0')

// mn:ss (or h:mm:ss) — used for the stopwatch and sub-minute precision.
export function formatClock(totalSeconds: number): string {
    const sign = totalSeconds < 0 ? '-' : ''
    const s = Math.max(0, Math.floor(Math.abs(totalSeconds)))
    const hours = Math.floor(s / 3600)
    const mins = Math.floor((s % 3600) / 60)
    const secs = s % 60
    if (hours > 0) return `${sign}${hours}:${pad2(mins)}:${pad2(secs)}`
    return `${sign}${pad2(mins)}:${pad2(secs)}`
}

// Human countdown used on timer cards: 45s, 5m, 1h 5m (negative when overdue).
export function formatCountdown(remaining: number): string {
    const sign = remaining < 0 ? '-' : ''
    const abs = Math.abs(Math.round(remaining))
    if (abs < 60) return `${sign}${abs}s`
    const mins = Math.floor(abs / 60)
    if (mins < 60) return `${sign}${mins}m`
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return `${sign}${hours}h${remMins > 0 ? ` ${remMins}m` : ''}`
}

// Label for a duration in whole minutes, e.g. "12 min", "1h 5m".
export function formatDurationLabel(minutes: number): string {
    const total = Math.round(minutes)
    if (total < 60) return `${total} min`
    const hours = Math.floor(total / 60)
    const mins = total % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function parseDuration(minutes: any, seconds: any): number {
    const m = Math.max(0, Math.floor(Number(minutes) || 0))
    const s = Math.max(0, Math.floor(Number(seconds) || 0))
    return m * 60 + s
}

export function getRemaining(session: TimerSession | undefined | null, now: number = Date.now()): number {
    if (!session) return 0
    if ((session.status === 'active' || session.status === 'overdue') && session.endTime) {
        return Math.ceil((session.endTime - now) / 1000)
    }
    return session.remainingSec
}

export function getProgress(totalSeconds: number, session: TimerSession | undefined | null, now: number = Date.now()): number {
    const totalMs = totalSeconds * 1000
    if (totalMs <= 0 || !session) return 0
    let elapsedMs: number
    if ((session.status === 'active' || session.status === 'overdue') && session.endTime) {
        elapsedMs = totalMs - Math.max(0, session.endTime - now)
    } else {
        elapsedMs = totalMs - (session.remainingSec || 0) * 1000
    }
    return Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
}

export function itemMatchesQuery(haystack: string[], query: string): boolean {
    const terms = (query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return true
    const hay = haystack.join(' ').toLowerCase()
    return terms.every(t => hay.includes(t))
}

export function toolHaystack(tool: QuickTool): string[] {
    return [tool.name, tool.description, tool.kind, ...tool.keywords]
}

export function guideHaystack(guide: QuickGuide): string[] {
    return [
        guide.title,
        guide.summary,
        guide.category,
        ...guide.keywords,
        ...guide.sections.flatMap(s => [s.heading || '', s.body || '', ...(s.bullets || [])])
    ]
}

export function filterTools(tools: QuickTool[], query: string): QuickTool[] {
    return tools.filter(t => itemMatchesQuery(toolHaystack(t), query))
}

export function filterGuides(guides: QuickGuide[], query: string): QuickGuide[] {
    return guides.filter(g => itemMatchesQuery(guideHaystack(g), query))
}

// Most-used first, then alphabetical. Accepts tools (name) and guides (title).
export function sortByUsage<T extends { id: string; name?: string; title?: string }>(
    items: T[],
    usage: Record<string, number>
): T[] {
    return [...items].sort((a, b) => {
        const ua = usage[a.id] || 0
        const ub = usage[b.id] || 0
        if (ua !== ub) return ub - ua
        const na = (a.name || a.title || '').toLowerCase()
        const nb = (b.name || b.title || '').toLowerCase()
        return na.localeCompare(nb)
    })
}

export function incrementUsage(usage: Record<string, number>, id: string): Record<string, number> {
    return { ...usage, [id]: (usage[id] || 0) + 1 }
}

// ---------------------------------------------------------------------------
// Unit + oven converters
// ---------------------------------------------------------------------------

export type UnitFamily = 'volume' | 'weight'

interface UnitDef {
    id: string
    label: string
    short: string
    family: UnitFamily
    toBase: number
}

// Volume bases on millilitres, weight on grams. For water 1 ml ≈ 1 g, which is
// what the converter assumes when crossing between families.
export const CONVERTER_UNITS: UnitDef[] = [
    { id: 'ml', label: 'Millilitres', short: 'ml', family: 'volume', toBase: 1 },
    { id: 'l', label: 'Litres', short: 'L', family: 'volume', toBase: 1000 },
    { id: 'tsp', label: 'Teaspoons', short: 'tsp', family: 'volume', toBase: 4.92892 },
    { id: 'tbsp', label: 'Tablespoons', short: 'tbsp', family: 'volume', toBase: 14.7868 },
    { id: 'cup', label: 'Cups', short: 'cup', family: 'volume', toBase: 236.588 },
    { id: 'floz', label: 'Fluid ounces', short: 'fl oz', family: 'volume', toBase: 29.5735 },
    { id: 'pint', label: 'Pints', short: 'pt', family: 'volume', toBase: 473.176 },
    { id: 'quart', label: 'Quarts', short: 'qt', family: 'volume', toBase: 946.353 },
    { id: 'g', label: 'Grams', short: 'g', family: 'weight', toBase: 1 },
    { id: 'kg', label: 'Kilograms', short: 'kg', family: 'weight', toBase: 1000 },
    { id: 'oz', label: 'Ounces', short: 'oz', family: 'weight', toBase: 28.3495 },
    { id: 'lb', label: 'Pounds', short: 'lb', family: 'weight', toBase: 453.592 }
]

export function getUnit(id: string): UnitDef | undefined {
    return CONVERTER_UNITS.find(u => u.id === id)
}

// Converts a value between any two units. Crosses volume/weight assuming water.
export function convertUnit(value: number, fromId: string, toId: string): number | null {
    const from = getUnit(fromId)
    const to = getUnit(toId)
    if (!from || !to || !isFinite(value)) return null
    return (value * from.toBase) / to.toBase
}

export function roundSmart(value: number, decimals: number = 2): number {
    if (!isFinite(value)) return 0
    const factor = Math.pow(10, decimals)
    return Math.round(value * factor) / factor
}

// Common oven gas marks → conventional Celsius.
export const GAS_MARK_TABLE: { mark: string; celsius: number }[] = [
    { mark: '¼', celsius: 110 },
    { mark: '½', celsius: 120 },
    { mark: '1', celsius: 140 },
    { mark: '2', celsius: 150 },
    { mark: '3', celsius: 160 },
    { mark: '4', celsius: 180 },
    { mark: '5', celsius: 190 },
    { mark: '6', celsius: 200 },
    { mark: '7', celsius: 220 },
    { mark: '8', celsius: 230 },
    { mark: '9', celsius: 240 }
]

export function celsiusToFahrenheit(c: number): number {
    return (c * 9) / 5 + 32
}

export function fahrenheitToCelsius(f: number): number {
    return ((f - 32) * 5) / 9
}

// Fan-forced ovens typically run ~20°C cooler than conventional.
export function conventionalToFan(c: number): number {
    return c - 20
}

export function fanToConventional(c: number): number {
    return c + 20
}

export function nearestGasMark(celsius: number): { mark: string; celsius: number } {
    return GAS_MARK_TABLE.reduce((best, row) =>
        Math.abs(row.celsius - celsius) < Math.abs(best.celsius - celsius) ? row : best
    )
}
