import React from 'react'
import { formatQuantityDisplay } from '../lib/fractionFormat'
import { convertForDisplay } from '../lib/unitDisplay'
import { renderFractions } from './Fraction'

/**
 * Readability helpers for instruction steps:
 * - sentence splitting into per-line blocks
 * - comma-clause bullets
 * - bolding of quantities / times / temperatures
 * - underlined ingredient mentions that can open a popup
 * All display-only; steps data is never rewritten.
 */

export const LONG_STEP_CHARS = 400
export const PILL_MAX = 4

export function isLongStep(text: string | undefined): boolean {
    return !!text && text.length > LONG_STEP_CHARS
}

type IngredientLike = { name?: string; [k: string]: any }
type Span = { kind: 'ing'; start: number; end: number; ingred: any } | { kind: 'kw'; start: number; end: number }

const UNIT_WORDS = 'tablespoons?|tbsp|dessertspoons?|teaspoons?|tsp|cups?|grams?|gr|kg|millilitres?|milliliters?|ml|litres?|liters?|pinch(?:es)?|cloves?|slices?|sheets?|sticks?|pieces|rashes|rashers|tins?|cans?|pouch(?:es)?|pack(?:ets|s)?|bunch(?:es)?|handfuls?|sprigs?|wedges?|segments|leaves|dobs?|dollops?|splash(?:es)?|drizzle'

const QTY_RE = new RegExp(
    '\\b\\d+(?:[.,]\\d+)?(?:\\s+\\d+\\s*\\/\\s*\\d+)?(?:\\s*\\/\\s*\\d+)?\\s*(?:' + UNIT_WORDS + ')\\b',
    'gi'
)
const TIME_RE = /\b\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?\s*(?:min\w*|hours?|hrs?|seconds?|secs?)\b/gi
const TEMP_RE = /\b\d+(?:[.,]\d+)?\s*°\s*[CF]\b/gi
const NUM_RE = /\b\d+(?:\s+\d+\s*\/\s*\d+)?(?:\s*\/\s*\d+)?\b/g

const ALL_KEYWORD_RES: RegExp[] = [QTY_RE, TIME_RE, TEMP_RE, NUM_RE]

// sentence bounds within one line: "5 mins." followed by space/capital,
// not decimals ("1.5") or lowercase continuations
function splitLineIntoSentences(line: string): string[] {
    const bounds: number[] = []
    for (let i = 0; i < line.length; i++) {
        if (line[i] !== '.') continue
        const next = line[i + 1]
        if (next === undefined) { bounds.push(i + 1); continue }
        if ((next === ' ' || next === '\n') && line[i + 2]) {
            const after = line[i + 2]
            if (/[A-Z(]/.test(after)) bounds.push(i + 1)
        }
    }
    if (bounds.length === 0) return [line]
    const sent: string[] = []
    let prev = 0
    bounds.push(line.length)
    for (const b of bounds) {
        const seg = line.slice(prev, b).trim()
        if (!seg) { prev = b; continue }
        sent.push(seg)
        prev = b
    }
    return sent
}

// Steps come both as prose ("Do this. Then do that.") and as hard-wrapped
// lines without punctuation. Each line is its own unit; lowercase fragments
// continue the previous line (they're mid-sentence wraps). Keeps cooking-mode
// cards as scannable stacked rows instead of a centered blob.
export function splitSentences(text: string): string[] {
    const parts: string[] = []
    for (const line of text.split(/\n+/)) {
        for (const seg of splitLineIntoSentences(line.trim()).filter(s => s)) {
            const prev = parts.length > 0 ? parts[parts.length - 1] : ''
            // tiny tail ("Serves 4.") and lowercase continuations join the
            // previous unit — unless that makes it an unreadable wall
            if (parts.length > 0 && (seg.length < 25 || /^[a-z]/.test(seg)) && (prev.length + seg.length <= 220)) {
                parts[parts.length - 1] += ' ' + seg
            } else {
                parts.push(seg)
            }
        }
    }
    return parts
}

function escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Same whole/prefix word logic as the recipe page's chip scorer (wordMatches),
// so what matches here always matches what the pills show underneath.
export function wordMatches(a: string, b: string): boolean {
    if (a === b) return true
    if (a.length < 3 || b.length < 3) return false
    return a.startsWith(b) || b.startsWith(a)
}

// Same word list as the recipe page's chip scorer, so both agree on what to
// ignore when matching.
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'over', 'until', 'all', 'into', 'each', 'both', 'than', 'then', 'also', 'just', 'about', 'from', 'up', 'down', 'out', 'off', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'any', 'every', 'some', 'few', 'more', 'most', 'other', 'only', 'very', 'now'])

// Generic culinary context words that live inside ingredient names but should
// never count as an ingredient mention on their own ("sauce", "juice", …).
// Hard-coded by design — add to this list as new false positives appear.
// Exact-phrase hits like "tomato sauce" still match fine; only the standalone
// word ("drizzle the sauce", "spoon over the juices") is ignored here.
// Nouns for prepared things the ingredient list would name in full.
const GENERIC_INGREDIENT_WORDS = new Set([
    'sauce', 'sauces', 'juice', 'juices', 'stock', 'stocks', 'broth', 'broths',
    'gravy', 'dressing', 'dressings', 'marinade', 'marinades', 'glaze', 'glazes',
    'topping', 'toppings', 'filling', 'fillings', 'garnish', 'garnishes',
    'icing', 'frosting', 'batter', 'batters', 'dough', 'doughs', 'paste',
    'pastes', 'crumbs', 'crumble', 'relish', 'relishes', 'chutney', 'chutneys',
    'salsa', 'salsas', 'pesto', 'seasoning', 'seasonings', 'mixture', 'mixtures',
    'blend', 'blends', 'rub', 'marinara', 'bechamel', 'roux', 'mornay',
    'syrup', 'syrups', 'aioli', 'hollandaise', 'compote', 'sabayon', 'crème',
])

function isGenericIngredientWord(w: string): boolean {
    return GENERIC_INGREDIENT_WORDS.has(w) || GENERIC_INGREDIENT_WORDS.has(w.replace(/(es|s)$/, ''))
}
export { isGenericIngredientWord }

type IngSpan = { start: number; end: number; ingred: any }

// Underline matching = the exact phrase when it appears, plus (falling back)
// per-word prefix matching identical to the chip scorer — so a step saying
// just "onion" underlines that word even when the ingredient is "brown onion".
export function findIngredientSpans(text: string, ingredients: IngredientLike[]): IngSpan[] {
    if (!text || !ingredients || ingredients.length === 0) return []
    const spans: IngSpan[] = []
    const seen = new Set<string>()
    // longest names first so "brown onion" beats "onion"
    const sorted = [...ingredients]
        .filter((i: any) => i && typeof i.name === 'string' && i.name.trim().length >= 3)
        .sort((a: any, b: any) => b.name.length - a.name.length)
    for (const ing of sorted) {
        const key = (ing.name as string).toLowerCase().trim()
        if (seen.has(key)) continue
        seen.add(key)
        const escaped = escapeRegex(key).replace(/\s+/g, '\\s+')
        const re = new RegExp('\\b' + escaped + '(?:s|es)?\\b', 'gi')
        re.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null) {
            spans.push({ start: m.index, end: m.index + m[0].length, ingred: ing })
            if (m[0].length === 0) re.lastIndex++
        }
    }

    // token pass: per-word prefix matching, mirroring the chip scorer, for
    // names not present verbatim ("onion" for "brown onion")
    const tokens: { w: string; start: number; end: number; ingred?: any }[] = []
    const tokenRe = /[A-Za-z][A-Za-z-]*/g
    let tm: RegExpExecArray | null
    while ((tm = tokenRe.exec(text)) !== null) {
        const w = tm[0].toLowerCase()
        // generic context words ("the sauce", "the juices") are never an
        // ingredient mention on their own
        if (w.length < 3 || STOP_WORDS.has(w) || isGenericIngredientWord(w)) continue
        tokens.push({ w, start: tm.index, end: tm.index + tm[0].length })
    }
    for (const tok of tokens) {
        // already inside an exact-phrase span
        if (spans.some(s => tok.start >= s.start && tok.end <= s.end)) continue
        // best-scoring ingredient for this word (longest full name wins ties);
        // only non-generic name words score, so "soy sauce" can't pin a bare
        // word other than something like the "soy" itself
        let best: any
        let bestScore = 0
        for (const ing of sorted) {
            const key = (ing.name as string).toLowerCase().trim()
            if (!seen.has(key)) continue
            const score = key.split(/\s+/).filter(nw => !isGenericIngredientWord(nw) && wordMatches(nw, tok.w)).length
            if (score > bestScore) { best = ing; bestScore = score }
        }
        if (best) tok.ingred = best
    }
    // merge consecutive same-ingredient tokens into one span
    for (let i = 0; i < tokens.length; i++) {
        if (!tokens[i].ingred) continue
        let j = i
        while (j + 1 < tokens.length && tokens[j + 1].ingred === tokens[i].ingred && tokens[j + 1].start <= tokens[j].end + 2) j++
        spans.push({ start: tokens[i].start, end: tokens[j].end, ingred: tokens[i].ingred })
        if (j > i) i = j
    }

    spans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
    // drop overlaps, keeping the earlier/longer span
    const kept: IngSpan[] = []
    for (const s of spans) if (kept.length === 0 || s.start >= kept[kept.length - 1].end) kept.push(s)
    return kept
}

// Which steps reference each ingredient (for the "also used in step N" hint)
export function getIngredientStepMap(instructions: any[], ingredients: any[]): Record<string, number[]> {
    const map: Record<string, number[]> = {}
    ;(instructions || []).forEach((step: any, i: number) => {
        for (const span of findIngredientSpans(step?.Text || '', ingredients)) {
            const key = (span.ingred.name as string).toLowerCase().trim()
            if (!map[key] || !map[key].includes(i)) {
                if (!map[key]) map[key] = []
                map[key].push(i)
            }
        }
    })
    return map
}

export function formatQuantity(ingred: any): string {
    if (ingred?.quantity == null) return ''
    // Step-text quantities are static prose values - converted to the user's
    // unit system (metric default) for display, but never scaled.
    const { quantity, shorthand } = convertForDisplay(ingred.quantity, ingred.quantity_type_shorthand || ingred.quantity_type || 'each')
    return `${formatQuantityDisplay(quantity)} ${shorthand}`
}

type TextNode = React.ReactNode

function boldKeywords(text: string, keyBase: string): TextNode[] {
    const marks: Span[] = []
    for (const re of ALL_KEYWORD_RES) {
        re.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null) {
            if (m[0].length === 0) { re.lastIndex++; continue }
            marks.push({ kind: 'kw', start: m.index, end: m.index + m[0].length })
        }
    }
    marks.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
    const clean: Span[] = []
    for (const s of marks) if (clean.length === 0 || s.start >= clean[clean.length - 1].end) clean.push(s)
    if (clean.length === 0) return [text]

    const out: TextNode[] = []
    let pos = 0
    clean.forEach((m, i) => {
        if (m.start > pos) out.push(text.slice(pos, m.start))
        out.push(<strong key={`${keyBase}-k${i}`}>{renderFractions(text.slice(m.start, m.end))}</strong>)
        pos = m.end
    })
    if (pos < text.length) out.push(text.slice(pos))
    return out
}

function renderSegment(text: string, opts: RenderOptions, keyBase: string): TextNode[] {
    const spans = opts.ingredients ? findIngredientSpans(text, opts.ingredients) : []
    if (spans.length === 0) return boldKeywords(text, keyBase)

    const out: TextNode[] = []
    let pos = 0
    spans.forEach((m, i) => {
        if (m.start > pos) out.push(...boldKeywords(text.slice(pos, m.start), `${keyBase}-p${i}`))
        out.push(
            <button
                key={`${keyBase}-i${i}`}
                type="button"
                className="step-ingredient-link"
                onClick={(e) => opts.onIngredientClick?.(m.ingred, e.currentTarget)}
            >
                {text.slice(m.start, m.end)}
            </button>
        )
        pos = m.end
    })
    if (pos < text.length) out.push(...boldKeywords(text.slice(pos), `${keyBase}-t`))
    return out
}

function maybeCommaBullets(text: string, opts: RenderOptions, keyBase: string): TextNode {
    // 2+ commas AND substantial clauses -> bullet list for the tail clauses
    const commaCount = (text.match(/,\s/g) || []).length
    if (commaCount < 2) return renderSegment(text, opts, keyBase)
    const segs = text.split(/,\s+/)
    if (segs.length < 3) return renderSegment(text, opts, keyBase)
    const tail = segs.slice(1)
    if (tail.some(s => s.replace(/[^a-z]/gi, '').length < 12)) return renderSegment(text, opts, keyBase)

    return (
        <span key={keyBase}>
            {renderSegment(segs[0] + ',', opts, keyBase + '-f')}
            <ul className="list-disc list-outside ml-5 mt-1 space-y-0.5 marker:text-muted-foreground/50">
                {tail.map((seg, i) => (
                    <li key={i}>{renderSegment(seg, opts, `${keyBase}-b${i}`)}</li>
                ))}
            </ul>
        </span>
    )
}

interface RenderOptions {
    ingredients?: any[]
    onIngredientClick?: (ingred: any, anchor: HTMLElement) => void
}

export function renderStepText(text: string | undefined, opts: RenderOptions = {}): React.ReactNode {
    if (!text) return null
    const sents = splitSentences(text)
    if (sents.length < 2) return maybeCommaBullets(text.trim(), opts, 's0')
    return (
        <>
            {sents.map((s, i) => (
                <div key={`sent-${i}`} className="mb-2.5 last:mb-0">
                    {maybeCommaBullets(s, opts, `s${i}`)}
                </div>
            ))}
        </>
    )
}
