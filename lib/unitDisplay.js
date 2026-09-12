// Display-time unit conversion between metric and imperial for on-screen
// quantities. Purely presentational - never mutates recipe data, API
// payloads or DB records. Default system is metric (extracted lb/oz/cups
// are shown as g/kg/ml unless the user opts into imperial).
import { quantity_unit_conversions, resolveUnitKey } from './conversion'

export function getUnitSystem() {
    if (typeof window === 'undefined') return 'metric'
    return localStorage.getItem('unitSystem') === 'imperial' ? 'imperial' : 'metric'
}

export function isImperialDisplay() {
    return getUnitSystem() === 'imperial'
}

// A converted value is only shown as a clean fractional unit (lb/oz/cup/qt)
// when it sits within +/-5% of an exact 1/8 step of that unit. Otherwise the
// precise value is kept and displayed in the plain base unit (g/ml/fl oz)
// rather than a made-up-looking fraction.
const SNAP_TOLERANCE = 0.05

// Returns the exact 1/8-step value within tolerance, or null.
function cleanStep(value, tolerance = SNAP_TOLERANCE) {
    const eighths = Math.round(value * 8) / 8
    if (eighths <= 0) return null
    return Math.abs(value - eighths) <= tolerance * eighths ? eighths : null
}

// For values >= 10: whole number within tolerance, else one-decimal.
function cleanLargeStep(value) {
    const whole = Math.round(value)
    if (whole > 0 && Math.abs(value - whole) <= SNAP_TOLERANCE * whole) return whole
    return Math.round(value * 10) / 10
}

// Metric targets: whole g/ml (one decimal below 10), switching to kg/L at 1000+.
function toMetric(baseValue, base) {
    if (baseValue >= 1000) {
        return { quantity: parseFloat((baseValue / 1000).toFixed(2)), shorthand: base === 'g' ? 'kg' : 'L' }
    }
    const v = baseValue < 10 ? Math.round(baseValue * 10) / 10 : Math.round(baseValue)
    return { quantity: v, shorthand: base }
}

const ML_PER_CUP = 284.131
const ML_PER_QT = 1136.52
const MIN_CUP_ML = ML_PER_CUP / 8          // 1/8 cup ≈ 35.5 ml

// ml -> cup only when within ±5% of a clean 1/8-cup multiple (min 1/8 cup);
// otherwise fall back to fl oz (also tolerance-snapped).
function toImperialVolume(ml) {
    if (ml >= MIN_CUP_ML) {
        const step = cleanStep(ml / ML_PER_CUP)
        if (step) return { quantity: step, shorthand: 'cup' }
    }
    const floz = ml / 28.4131
    return { quantity: floz >= 10 ? cleanLargeStep(floz) : cleanStep(floz) ?? Math.round(floz * 100) / 100, shorthand: 'fl oz' }
}

/**
 * Converts a quantity+unit to the user's preferred unit system for display.
 * system 'imperial': g/kg -> oz/lb, ml/L -> fl oz/cup/qt.
 * system 'metric' (default): lb/oz -> g/kg, fl oz/cup/pt/qt/gal -> ml/L.
 * Units already in the target system and count-based units (each, clove,
 * tbsp, tsp...) pass through untouched.
 * @returns {{ quantity: number, shorthand: string }}
 */
export function convertForDisplay(quantity, unit, system = getUnitSystem()) {
    const num = Number(quantity)
    const unitStr = unit != null ? String(unit) : 'each'
    if (quantity == null || !isFinite(num)) {
        return { quantity: num, shorthand: unitStr }
    }

    const key = resolveUnitKey(unitStr)
    const def = quantity_unit_conversions[key]
    if (!def) return { quantity: num, shorthand: unitStr }

    if (system === 'imperial') {
        if (key === 'gram' || key === 'kilogram') {
            const grams = num * def.ratio
            if (grams >= 453.592 / 2) {
                const step = cleanStep(grams / 453.592)
                if (step) return { quantity: step, shorthand: 'lb' }
            }
            const oz = grams / 28.3495
            return { quantity: oz >= 10 ? cleanLargeStep(oz) : cleanStep(oz) ?? Math.round(oz * 100) / 100, shorthand: 'oz' }
        }
        if (key === 'milliliter' || key === 'liter') {
            const ml = num * def.ratio
            if (ml >= ML_PER_QT) {
                const step = cleanStep(ml / ML_PER_QT)
                if (step) return { quantity: step, shorthand: 'qt' }
            }
            return toImperialVolume(ml)
        }
        return { quantity: num, shorthand: def.shorthand || unitStr }
    }

    // metric (default): convert only imperial weights (lb/oz) to g/kg.
    // Kitchen volume units (cup, tbsp, tsp, fl oz, pint, quart, gallon) are
    // shown as-is - cooks measure those with utensils, not scales.
    if (key === 'pound') return toMetric(num * 453.592, 'g')
    if (key === 'ounce') return toMetric(num * 28.3495, 'g')

    return { quantity: num, shorthand: def.shorthand || unitStr }
}

/**
 * Imperial counterpart of formatWeight (lib/conversion.js) for the recipe
 * total-weight chip: ~X lb / ~X oz instead of ~X g / ~X kg.
 */
export function formatWeightImperial(grams) {
    if (typeof grams !== 'number' || !isFinite(grams)) return '—'
    const lbs = grams / 453.592
    if (lbs >= 1) {
        const val = Math.round(lbs * 100) / 100
        return `~${String(val).replace(/\.?0+$/, '')} lb`
    }
    return `~${Math.round(grams / 28.3495)} oz`
}
