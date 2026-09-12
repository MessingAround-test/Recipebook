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

// Snap a converted value so fractions render cleanly (decimalToFraction uses
// a 0.02 tolerance, so raw conversion noise like 1.1023 lb would fall back to
// an ugly "1.10" decimal - snapping to eighths keeps "1 1/8 lb" style output).
function snapForDisplay(num) {
    if (num >= 10) return Math.round(num * 2) / 2
    const eighths = Math.round(num * 8) / 8
    return eighths === 0 && num > 0 ? 0.125 : eighths
}

// Metric targets: whole g/ml, switching to kg/L at 1000+
function toMetric(baseValue, base) {
    if (baseValue >= 1000) {
        return { quantity: parseFloat((baseValue / 1000).toFixed(2)), shorthand: base === 'g' ? 'kg' : 'L' }
    }
    const v = baseValue < 10 ? Math.round(baseValue * 10) / 10 : Math.round(baseValue)
    return { quantity: v, shorthand: base }
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
                return { quantity: snapForDisplay(grams / 453.592), shorthand: 'lb' }
            }
            return { quantity: snapForDisplay(grams / 28.3495), shorthand: 'oz' }
        }
        if (key === 'milliliter' || key === 'liter') {
            const ml = num * def.ratio
            if (ml >= 1136.52) {
                return { quantity: snapForDisplay(ml / 1136.52), shorthand: 'qt' }
            }
            if (ml >= 284.131 / 2) {
                return { quantity: snapForDisplay(ml / 284.131), shorthand: 'cup' }
            }
            return { quantity: snapForDisplay(ml / 28.4131), shorthand: 'fl oz' }
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
