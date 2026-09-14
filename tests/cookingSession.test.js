const {
    SESSION_PREFIX,
    isCookingActive,
    parseCookingSessions,
    getRemainingSec,
    formatBubbleTime,
    getUrgentTimer,
    getBubbleStartPosition,
    isMobileViewport,
    clearCookingSession
} = require('../lib/cookingSession')

const session = (overrides = {}) => ({
    v: 6,
    cooking: true,
    recipeName: 'Risotto',
    currentFlow: 0,
    doneFlow: [],
    timers: {},
    customTimers: [],
    timerMeta: {},
    startedAt: 1000,
    ...overrides
})

describe('cookingSession — activity detection', () => {
    test('explicit flag wins both ways', () => {
        expect(isCookingActive({ cooking: true })).toBe(true)
        expect(isCookingActive({ cooking: false, currentFlow: 3, doneFlow: [0] })).toBe(false)
    })

    test('legacy sessions infer activity from progress', () => {
        expect(isCookingActive({ currentFlow: 2 })).toBe(true)
        expect(isCookingActive({ doneFlow: [0] })).toBe(true)
        expect(isCookingActive({ customTimers: [{ id: 'a' }] })).toBe(true)
        expect(isCookingActive({ timers: { a: { status: 'paused' } } })).toBe(true)
        expect(isCookingActive({ timers: { a: { status: 'completed' } } })).toBe(false)
        expect(isCookingActive({})).toBe(false)
        expect(isCookingActive(null)).toBe(false)
    })
})

describe('cookingSession — parsing', () => {
    test('keeps only active timer-session entries and sorts by startedAt', () => {
        const entries = [
            [`${SESSION_PREFIX}aaa`, JSON.stringify(session({ startedAt: 2000, recipeName: 'B' }))],
            [`${SESSION_PREFIX}bbb`, JSON.stringify(session({ startedAt: 1000, recipeName: 'A' }))],
            [`${SESSION_PREFIX}ccc`, JSON.stringify(session({ cooking: false }))],
            ['unrelated-key', JSON.stringify(session())],
            [`${SESSION_PREFIX}ddd`, '{not json'],
            [`${SESSION_PREFIX}eee`, session({ startedAt: 500, recipeName: 'C' })]
        ]
        const out = parseCookingSessions(entries)
        expect(out.map(s => s.recipeId)).toEqual(['eee', 'bbb', 'aaa'])
        expect(out.map(s => s.recipeName)).toEqual(['C', 'A', 'B'])
    })

    test('falls back to a generic name when none stored', () => {
        const out = parseCookingSessions([[`${SESSION_PREFIX}x`, { cooking: true }]])
        expect(out[0].recipeName).toBe('Cooking')
        expect(out[0].currentFlow).toBe(0)
        expect(out[0].timers).toEqual({})
    })
})

describe('cookingSession — urgent timer', () => {
    const now = 10_000

    test('overdue beats a running timer with more time left', () => {
        const s = {
            recipeId: 'r',
            timers: {
                run: { status: 'active', endTime: now + 60_000, remaining: 60 },
                late: { status: 'overdue', endTime: now - 5_000, remaining: 5 }
            },
            timerMeta: { run: { name: 'Simmer' }, late: { name: 'Bake' } }
        }
        const urgent = getUrgentTimer(s, now)
        expect(urgent.id).toBe('late')
        expect(urgent.overdue).toBe(true)
        expect(urgent.name).toBe('Bake')
    })

    test('soonest running timer wins among actives', () => {
        const s = {
            recipeId: 'r',
            timers: {
                a: { status: 'active', endTime: now + 120_000, remaining: 120 },
                b: { status: 'active', endTime: now + 30_000, remaining: 30 }
            },
            timerMeta: {}
        }
        expect(getUrgentTimer(s, now).id).toBe('b')
        expect(getUrgentTimer(s, now).remainingSec).toBe(30)
    })

    test('paused ranks behind running and reports remaining', () => {
        const s = {
            recipeId: 'r',
            timers: {
                p: { status: 'paused', endTime: null, remaining: 5 },
                run: { status: 'active', endTime: now + 900_000, remaining: 900 }
            },
            timerMeta: {}
        }
        const urgent = getUrgentTimer(s, now)
        expect(urgent.id).toBe('run')
    })

    test('returns null when nothing is alive or session is empty', () => {
        expect(getUrgentTimer({ recipeId: 'r', timers: {}, timerMeta: {} }, now)).toBeNull()
        expect(getUrgentTimer(null, now)).toBeNull()
    })
})

describe('cookingSession — remaining + positions', () => {
    test('remaining is ceiled for running timers and stored when paused', () => {
        const now = 1000
        expect(getRemainingSec({ status: 'active', endTime: now + 1500, remaining: 2 }, now)).toBe(2)
        expect(getRemainingSec({ status: 'paused', endTime: null, remaining: 42 }, now)).toBe(42)
        expect(getRemainingSec(null, now)).toBe(0)
    })

    test('bubble time shows only the largest unit', () => {
        expect(formatBubbleTime(45)).toBe('45s')
        expect(formatBubbleTime(59.4)).toBe('59s')
        expect(formatBubbleTime(60)).toBe('1m')
        expect(formatBubbleTime(90)).toBe('1m')
        expect(formatBubbleTime(59 * 60 + 59)).toBe('59m')
        expect(formatBubbleTime(3600)).toBe('1h')
        expect(formatBubbleTime(12 * 3600 + 58 * 60)).toBe('12h')
        expect(formatBubbleTime(0)).toBe('0s')
        expect(formatBubbleTime(-500)).toBe('0s')
    })

    test('mobile stacks above the bottom taskbar; desktop from the corner', () => {
        expect(isMobileViewport(375)).toBe(true)
        expect(isMobileViewport(1280)).toBe(false)

        const one = getBubbleStartPosition(1, 0, { width: 375, safeAreaBottom: 0 })
        expect(one.right).toBe(12)
        expect(one.bottom).toBe(84)

        const two = getBubbleStartPosition(2, 1, { width: 375, safeAreaBottom: 0 })
        expect(two.bottom).toBe(84 + 68)

        const desktop = getBubbleStartPosition(1, 0, { width: 1280 })
        expect(desktop.right).toBe(20)
        expect(desktop.bottom).toBe(20)

        const desktop2 = getBubbleStartPosition(2, 1, { width: 1280 })
        expect(desktop2.bottom).toBe(20 + 68)
    })

    test('clearCookingSession removes only the target key', () => {
        const store = new Map([[`${SESSION_PREFIX}r1`, 'x'], [`${SESSION_PREFIX}r2`, 'y']])
        const fake = {
            removeItem: (k) => store.delete(k)
        }
        clearCookingSession('r1', fake)
        expect(store.has(`${SESSION_PREFIX}r1`)).toBe(false)
        expect(store.has(`${SESSION_PREFIX}r2`)).toBe(true)
    })
})
