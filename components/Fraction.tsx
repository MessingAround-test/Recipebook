import React from 'react'

/**
 * Typeset fraction rendering: numerator raised, diagonal fraction slash
 * (U+2044), denominator lowered — so "1 3/4" never reads as "13/4".
 * Presentation-only over plain-text quantity strings, so slices like
 * "1 cup + 1 3/4 tbsp" or "0.5" pass through untouched except for the
 * fraction portions.
 */

const FRACTION_RE = /(?:\b(\d+)\s+)?(\b\d+)\s*\/\s*(\d+)\b/g

export function FractionParts({ whole, num, den }: { whole?: string; num: string; den: string }) {
    return (
        <span className="fraction">
            {whole && <span className="fraction-integer">{whole}</span>}
            <span className="fraction-body">
                <span className="fraction-num">{num}</span>
                <span className="fraction-line" />
                <span className="fraction-den">{den}</span>
            </span>
        </span>
    )
}

export function renderFractions(text: string): React.ReactNode {
    if (!text || typeof text !== 'string' || !text.includes('/')) return text
    const out: React.ReactNode[] = []
    let last = 0
    let key = 0
    FRACTION_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = FRACTION_RE.exec(text)) !== null) {
        if (m[0].length === 0) { FRACTION_RE.lastIndex++; continue }
        out.push(text.slice(last, m.index))
        out.push(<FractionParts key={`frac-${key++}`} whole={m[1]} num={m[2]} den={m[3]} />)
        last = m.index + m[0].length
    }
    if (out.length === 0) return text
    out.push(text.slice(last))
    return out
}

export default function Fraction({ text }: { text: string }) {
    return <span>{renderFractions(text)}</span>
}
