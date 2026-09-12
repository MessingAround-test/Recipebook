const { convertForDisplay, formatWeightImperial, isImperialDisplay, getUnitSystem } = require('../lib/unitDisplay')

describe('convertForDisplay unit system (metric default)', () => {
    it('defaults to metric when no setting is stored', () => {
        expect(getUnitSystem()).toBe('metric')
        expect(isImperialDisplay()).toBe(false)
    })

    it('metric (default) converts lb/oz to g (kg at >= 1 kg)', () => {
        const lb = convertForDisplay(1.5, 'pound', 'metric')
        expect(lb.shorthand).toBe('g')
        expect(lb.quantity).toBeCloseTo(680, 0)
        const bigLb = convertForDisplay(3, 'pound', 'metric')
        expect(bigLb.shorthand).toBe('kg')
        expect(bigLb.quantity).toBeCloseTo(1.36, 2)
        const oz = convertForDisplay(4, 'ounce', 'metric')
        expect(oz.shorthand).toBe('g')
        expect(oz.quantity).toBeCloseTo(113, 0)
    })
    it('metric leaves metric and count units untouched', () => {
        expect(convertForDisplay(500, 'g', 'metric')).toEqual({ quantity: 500, shorthand: 'g' })
        expect(convertForDisplay(2, 'kg', 'metric')).toEqual({ quantity: 2, shorthand: 'kg' })
        expect(convertForDisplay(250, 'ml', 'metric')).toEqual({ quantity: 250, shorthand: 'ml' })
        expect(convertForDisplay(2, 'clove', 'metric')).toEqual({ quantity: 2, shorthand: 'clove' })
        expect(convertForDisplay(3, 'tbsp', 'metric')).toEqual({ quantity: 3, shorthand: 'tbsp' })
    })

    it('metric shows cups, tbsp, tsp, fl oz etc. as-is without converting', () => {
        expect(convertForDisplay(2, 'cup', 'metric')).toEqual({ quantity: 2, shorthand: 'cup' })
        expect(convertForDisplay(3, 'tablespoons', 'metric')).toEqual({ quantity: 3, shorthand: 'tbsp' })
        expect(convertForDisplay(1, 'tsp', 'metric')).toEqual({ quantity: 1, shorthand: 'tsp' })
        expect(convertForDisplay(2, 'fl oz', 'metric')).toEqual({ quantity: 2, shorthand: 'fl oz' })
        expect(convertForDisplay(1, 'pint', 'metric')).toEqual({ quantity: 1, shorthand: 'pt' })
        expect(convertForDisplay(1, 'quart', 'metric')).toEqual({ quantity: 1, shorthand: 'qt' })
        expect(convertForDisplay(1, 'gallon', 'metric')).toEqual({ quantity: 1, shorthand: 'gal' })
    })

    it('imperial converts g/kg to oz/lb, switching at >= half pound', () => {
        expect(convertForDisplay(100, 'g', 'imperial').shorthand).toBe('oz')
        expect(convertForDisplay(1000, 'g', 'imperial').shorthand).toBe('lb')
        const lb = convertForDisplay(1000, 'g', 'imperial')
        expect(lb.quantity).toBeCloseTo(2.25, 2)
        expect(convertForDisplay(0.5, 'kg', 'imperial').shorthand).toBe('lb')
    })

    it('imperial converts ml/L to fl oz / cup / qt by size', () => {
        expect(convertForDisplay(50, 'ml', 'imperial').shorthand).toBe('fl oz')
        expect(convertForDisplay(568, 'ml', 'imperial').shorthand).toBe('cup')
        expect(convertForDisplay(1500, 'ml', 'imperial').shorthand).toBe('qt')
        const l = convertForDisplay(2, 'liter', 'imperial')
        expect(l.shorthand).toBe('qt')
        expect(l.quantity).toBeCloseTo(1.75, 2)
    })

    it('imperial only shows cups within ±5% of a clean 1/8-cup step (min 1/8 cup)', () => {
        // exact 1/8-cup step: 1/2 cup = 142.07 ml
        expect(convertForDisplay(142.07, 'ml', 'imperial')).toEqual({ quantity: 0.5, shorthand: 'cup' })
        // within 5% of 1 cup: 284.131 ± 14.2
        expect(convertForDisplay(280, 'ml', 'imperial').shorthand).toBe('cup')
        expect(convertForDisplay(290, 'ml', 'imperial').shorthand).toBe('cup')
        // min: 1/8 cup ≈ 35.5 ml is the smallest cup measure shown
        expect(convertForDisplay(36, 'ml', 'imperial')).toEqual({ quantity: 0.125, shorthand: 'cup' })
        expect(convertForDisplay(30, 'ml', 'imperial').shorthand).toBe('fl oz')
        // outside 5% of the nearest 1/8 step: 200 ml is ~0.70 cup (nearest 3/4 = 213 ml, ~6.4% off)
        expect(convertForDisplay(200, 'ml', 'imperial').shorthand).toBe('fl oz')
        // below minimum and off-step
        expect(convertForDisplay(45, 'ml', 'imperial').shorthand).toBe('fl oz')
    })

    it('imperial leaves imperial and count units untouched', () => {
        expect(convertForDisplay(1.5, 'pound', 'imperial')).toEqual({ quantity: 1.5, shorthand: 'lb' })
        expect(convertForDisplay(8, 'ounce', 'imperial')).toEqual({ quantity: 8, shorthand: 'oz' })
        expect(convertForDisplay(2, 'clove', 'imperial')).toEqual({ quantity: 2, shorthand: 'clove' })
        expect(convertForDisplay(1, 'pinch', 'imperial')).toEqual({ quantity: 1, shorthand: 'pinch' })
    })

    it('resolves synonyms before converting', () => {
        expect(convertForDisplay(500, 'grams', 'imperial').shorthand).toBe('lb')
        expect(convertForDisplay(1, 'kgs', 'imperial').shorthand).toBe('lb')
        expect(convertForDisplay(1, 'lbs', 'metric').shorthand).toBe('g')
        expect(convertForDisplay(3, 'pounds', 'metric').shorthand).toBe('kg')
    })

    it('handles null/invalid input safely', () => {
        expect(convertForDisplay(null, 'g', 'imperial')).toEqual({ quantity: 0, shorthand: 'g' })
        expect(convertForDisplay(NaN, 'g', 'imperial')).toEqual({ quantity: NaN, shorthand: 'g' })
        expect(convertForDisplay(3, null, 'imperial')).toEqual({ quantity: 3, shorthand: 'x' })
        expect(convertForDisplay(null, 'lb', 'metric')).toEqual({ quantity: 0, shorthand: 'lb' })
    })
})

describe('formatWeightImperial', () => {
    it('formats grams as oz below 1 lb', () => {
        expect(formatWeightImperial(200)).toBe('~7 oz')
    })
    it('formats as lb above 1 lb', () => {
        expect(formatWeightImperial(1000)).toBe('~2.2 lb')
        expect(formatWeightImperial(453.592)).toBe('~1 lb')
    })
    it('handles invalid input', () => {
        expect(formatWeightImperial(NaN)).toBe('—')
    })
})
