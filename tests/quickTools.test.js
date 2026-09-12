const {
    QUICK_TOOLS,
    QUICK_GUIDES,
    TIMER_PRESETS,
    formatClock,
    formatCountdown,
    formatDurationLabel,
    parseDuration,
    getRemaining,
    getProgress,
    itemMatchesQuery,
    filterTools,
    filterGuides,
    sortByUsage,
    incrementUsage,
    convertUnit,
    celsiusToFahrenheit,
    fahrenheitToCelsius,
    conventionalToFan,
    fanToConventional,
    nearestGasMark
} = require('../lib/quickTools')

describe('quickTools — formatting', () => {
    test('formatClock pads minutes and seconds', () => {
        expect(formatClock(0)).toBe('00:00')
        expect(formatClock(65)).toBe('01:05')
        expect(formatClock(3725)).toBe('1:02:05')
        expect(formatClock(-5)).toBe('-00:05')
    })

    test('formatCountdown uses s / m / h', () => {
        expect(formatCountdown(45)).toBe('45s')
        expect(formatCountdown(300)).toBe('5m')
        expect(formatCountdown(3900)).toBe('1h 5m')
        expect(formatCountdown(3600)).toBe('1h')
        expect(formatCountdown(-12)).toBe('-12s')
    })

    test('formatDurationLabel renders minute durations', () => {
        expect(formatDurationLabel(12)).toBe('12 min')
        expect(formatDurationLabel(60)).toBe('1h')
        expect(formatDurationLabel(65)).toBe('1h 5m')
    })

    test('parseDuration combines minutes and seconds', () => {
        expect(parseDuration(2, 30)).toBe(150)
        expect(parseDuration('1', '5')).toBe(65)
        expect(parseDuration('', '')).toBe(0)
        expect(parseDuration(-3, -4)).toBe(0)
        expect(parseDuration('abc', '5')).toBe(5)
    })
})

describe('quickTools — timer maths', () => {
    const now = 1_000_000

    test('getRemaining derives from an absolute end time while running', () => {
        expect(getRemaining({ endTime: now + 50_000, remainingSec: 0, status: 'active' }, now)).toBe(50)
        expect(getRemaining({ endTime: now - 5_000, remainingSec: 0, status: 'overdue' }, now)).toBe(-5)
    })

    test('getRemaining uses stored remaining when paused/pending', () => {
        expect(getRemaining({ endTime: null, remainingSec: 42, status: 'paused' }, now)).toBe(42)
        expect(getRemaining({ endTime: null, remainingSec: 42, status: 'pending' }, now)).toBe(42)
    })

    test('getRemaining handles missing session', () => {
        expect(getRemaining(null, now)).toBe(0)
    })

    test('getProgress is 50% halfway through an active timer', () => {
        expect(getProgress(100, { endTime: now + 50_000, remainingSec: 0, status: 'active' }, now)).toBeCloseTo(50)
    })

    test('getProgress is 0 for a fresh pending timer and clamped for overdue', () => {
        expect(getProgress(100, { endTime: null, remainingSec: 100, status: 'pending' }, now)).toBe(0)
        expect(getProgress(100, { endTime: now - 50_000, remainingSec: 0, status: 'overdue' }, now)).toBe(100)
    })
})

describe('quickTools — search, filtering and usage ranking', () => {
    test('itemMatchesQuery requires every term', () => {
        expect(itemMatchesQuery(['Seasoning a pan', 'cast iron'], 'cast iron')).toBe(true)
        expect(itemMatchesQuery(['Seasoning a pan', 'cast iron'], 'cast aluminium')).toBe(false)
        expect(itemMatchesQuery(['anything'], '')).toBe(true)
    })

    test('filterTools finds the preset timer by egg keyword', () => {
        const ids = filterTools(QUICK_TOOLS, 'egg').map(t => t.id)
        expect(ids).toContain('preset-timers')
    })

    test('filterGuides finds seasoning by cast iron without a spacer', () => {
        const ids = filterGuides(QUICK_GUIDES, 'cast iron').map(g => g.id)
        expect(ids).toEqual(['seasoning-pan'])
    })

    test('sortByUsage puts the most used first then falls back to name', () => {
        const items = [
            { id: 'b', title: 'Bravo' },
            { id: 'a', title: 'Alpha' },
            { id: 'c', title: 'Charlie' }
        ]
        expect(sortByUsage(items, { c: 5, a: 2 }).map(i => i.id)).toEqual(['c', 'a', 'b'])
        expect(sortByUsage(items, {}).map(i => i.id)).toEqual(['a', 'b', 'c'])
    })

    test('incrementUsage returns a new object and increments', () => {
        const before = { a: 1 }
        const after = incrementUsage(before, 'a')
        expect(after).toEqual({ a: 2 })
        expect(before).toEqual({ a: 1 })
        expect(incrementUsage({}, 'x')).toEqual({ x: 1 })
    })
})

describe('quickTools — unit converter', () => {
    test('cups to millilitres', () => {
        expect(convertUnit(1, 'cup', 'ml')).toBeCloseTo(236.588, 2)
    })

    test('teaspoons to tablespoons', () => {
        expect(convertUnit(3, 'tsp', 'tbsp')).toBeCloseTo(1, 4)
    })

    test('grams to ounces', () => {
        expect(convertUnit(100, 'g', 'oz')).toBeCloseTo(3.5274, 3)
    })

    test('unknown unit returns null', () => {
        expect(convertUnit(1, 'nope', 'ml')).toBeNull()
    })
})

describe('quickTools — oven converter', () => {
    test('celsius <-> fahrenheit', () => {
        expect(celsiusToFahrenheit(180)).toBeCloseTo(356)
        expect(fahrenheitToCelsius(356)).toBeCloseTo(180)
    })

    test('fan conversion round-trips', () => {
        expect(conventionalToFan(180)).toBe(160)
        expect(fanToConventional(conventionalToFan(200))).toBe(200)
    })

    test('nearest gas mark', () => {
        expect(nearestGasMark(180).mark).toBe('4')
        expect(nearestGasMark(233).mark).toBe('8')
    })
})

describe('quickTools — data integrity', () => {
    test('tool and guide ids are unique', () => {
        const ids = [...QUICK_TOOLS, ...QUICK_GUIDES, ...TIMER_PRESETS].map(x => x.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    test('every tool kind has an entry and presets have positive durations', () => {
        expect(QUICK_TOOLS.length).toBeGreaterThan(0)
        QUICK_TOOLS.forEach(t => expect(t.kind).toBeTruthy())
        TIMER_PRESETS.forEach(p => expect(p.seconds).toBeGreaterThan(0))
    })

    test('guides all have at least one section', () => {
        QUICK_GUIDES.forEach(g => expect(g.sections.length).toBeGreaterThan(0))
    })
})
