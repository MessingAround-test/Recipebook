const FRACTIONS = [
    { decimal: 1 / 8, str: '1/8' },
    { decimal: 1 / 4, str: '1/4' },
    { decimal: 1 / 3, str: '1/3' },
    { decimal: 3 / 8, str: '3/8' },
    { decimal: 1 / 2, str: '1/2' },
    { decimal: 5 / 8, str: '5/8' },
    { decimal: 2 / 3, str: '2/3' },
    { decimal: 3 / 4, str: '3/4' },
    { decimal: 7 / 8, str: '7/8' },
]

const TOLERANCE = 0.02

function closestFraction(value) {
    for (const f of FRACTIONS) {
        if (Math.abs(value - f.decimal) < TOLERANCE) {
            return f.str
        }
    }
    return null
}

export function decimalToFraction(number) {
    if (number == null || isNaN(number)) return String(number ?? '')

    const num = Number(number)
    const whole = Math.floor(num)
    const frac = num - whole

    if (frac < TOLERANCE) {
        return String(whole || num.toFixed(2))
    }

    const fractionStr = closestFraction(frac)
    if (!fractionStr) {
        return num.toFixed(2)
    }

    if (whole > 0) {
        return `${whole} ${fractionStr}`
    }
    return fractionStr
}

export function formatQuantityDisplay(quantity) {
    if (quantity == null) return ''
    if (typeof window !== 'undefined' && localStorage.getItem('showFractions') === 'false') {
        return String(quantity)
    }
    return decimalToFraction(quantity)
}
