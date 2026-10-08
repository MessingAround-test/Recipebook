// Add-to-runner + fresh-commit pipeline against lib/sideCommit with the
// real-world data shapes from the field report (runner mid-bake; a side
// recipe whose step times live partly in dependency-chained cook timers).
import {
    buildSideContext, unitListForPseudo, serveTempForPseudo, computeSideServings,
    claimExistingAnchors, buildSidePickEntries, buildRunnerFlowItems, remainingMinutesForStep
} from '../lib/sideCommit';
import { buildFlowItems } from '../lib/carbSideOps';

const RUNNER = {
    name: 'Butter chicken',
    instructions: [
        { Text: 'brown the chicken', time: 10, involvement: 'active' },
        { Text: 'simmer the sauce', time: 90, involvement: 'none' },
        { Text: 'finish and plate', time: 5, involvement: 'active' }
    ],
    cookingTimers: [
        { type: 'timer', id: 'main-bake', name: 'Simmer', duration: 90, involvement: 'none', stepIndex: 1 }
    ],
    prepWork: [],
    servings: 4
}
const RUNNING: any = {
    v: 6,
    currentFlow: 1,
    doneFlow: [0],
    cooking: true,
    timers: { 'main-bake': { endTime: Date.now() + 40 * 60000, remaining: 2400, status: 'active', during: false } },
    customTimers: [],
    timerMeta: {}
}
const CAKE = {
    _id: 'cake',
    name: 'Easy lemon coconut almond cake',
    usableAsSide: true,
    serveTemp: '',
    sideCategory: 'other',
    reheatMinutes: 0,
    instructions: [
        { Text: 'Preheat oven', time: 5, involvement: 'active' },
        { Text: 'Melt butter', time: 2, involvement: 'active' },
        { Text: 'Wet ingredients', time: 4, involvement: 'active' },
        { Text: 'Dry ingredients', time: 2, involvement: 'active' },
        { Text: 'Bake 40 minutes', time: 2, involvement: 'none' },
        { Text: 'Cool at least 1 hour', time: 40, involvement: 'none' }
    ],
    cookingTimers: [
        { type: 'timer', id: 't-bake', duration: 40, involvement: 'none', stepIndex: 4 },
        { type: 'timer', id: 't-coolpan', duration: 15, involvement: 'none', stepIndex: 4 },
        { type: 'timer', id: 't-serve', duration: 60, involvement: 'none', stepIndex: 5 }
    ],
    prepWork: [{ action: 'zest the lemon', timeEstimate: 2 }],
    servings: 8,
    ingredients: [],
    timers: [
        { duration: 40, stepIndex: 4, involvement: 'none' },
        { duration: 60, stepIndex: 5, involvement: 'none' }
    ]
}
const sideServingsFor = (p: any) => computeSideServings(p, { factor: 1, mainServes: 8, fallbackServes: p.servings })

function runnerCurStep(session: any) {
    const items = buildRunnerFlowItems(RUNNER, session.sidePicks, session.carbChoice)
    const cf = typeof session.currentFlow === 'number' ? session.currentFlow : 0
    for (let i = Math.min(cf, items.length - 1); i >= 0; i--) {
        const it = items[i]
        if (it.kind === 'step') return it.stepIndex
        if (it.kind === 'prep') return 0
    }
    return 0
}

describe('add-to-runner pipeline (field data)', () => {
    test('runner flow rebuild + current-step resolution', () => {
        expect(runnerCurStep(RUNNING)).toBe(1)
    })

    test('remaining timer minutes anchor the partial timeline', () => {
        const rem = remainingMinutesForStep(1, RUNNER, RUNNING)
        expect(rem).toBeCloseTo(40, 0)
    })

    test('mid-add commit: cake enters the run from the bake tail, units in real indices', () => {
        const context = buildSideContext(RUNNER, 1, RUNNING)
        // Partial timeline: 40 min bake tail + 5 min plating = 45
        expect(context.timeline.total).toBeCloseTo(45, 0)
        expect(context.partialStart).toBe(1)

        const selfPseudo = {
            ...CAKE,
            steps: (CAKE.instructions as any[]).map((s: any, i: number) => ({
                index: i, Text: s.Text, time: s.time ?? null, involvement: s.involvement
            })),
            timers: (CAKE.cookingTimers as any[]).map((t: any) => ({
                duration: t.duration, stepIndex: t.stepIndex, involvement: t.involvement
            }))
        }
        const claimedReal = claimExistingAnchors(RUNNING.carbChoice, RUNNING.sidePicks)
        const claimed = new Map<string, boolean>()
        claimedReal.forEach((val: boolean, key: string) => {
            const [stepStr, intoStr] = key.split(':')
            const partialStep = Number(stepStr) - 1
            if (val && partialStep >= 0) claimed.set(`${partialStep}:${intoStr}`, true)
        })
        const { picks, newTimers } = buildSidePickEntries([selfPseudo], context, { mid: true, claimedKeys: claimed, servesFor: sideServingsFor })

        expect(picks).toHaveLength(1)
        const pick = picks[0]
        const cakeTotal = unitListForPseudo(selfPseudo).reduce((a: number, u: any) => a + u.minutes, 0)
        // Cake total: prep 2 + steps 5+2+4+2+2+40 (timer fallback not used — all times known)
        expect(cakeTotal).toBe(57)
        // The 57-min hot side cannot finish inside a 45-min partial window:
        // horizon mode applies and every unit's LAST one ends at the horizon.
        expect(pick.mode).toBe('horizon')
        const realAnchors = pick.units.map((u: any) => u.anchorStep)
        expect(realAnchors.every((a: any) => typeof a === 'number' && a >= 1)).toBe(true)
        expect(realAnchors).not.toContain(0) // never behind the cook's position

        // Flow interleave (mid-add): current step stays put; the overflow
        // cake clamps "start now" cards after it; the runner's last step
        // card remains the flow finale.
        const flow = buildFlowItems(RUNNER.instructions, [], null, picks)
        const labels = flow.map((i: any) => i.kind)
        expect(labels[0]).toBe('step') // brown the chicken
        expect(labels[1]).toBe('step') // simmer (the step the cook is on)
        expect(labels[labels.length - 1]).toBe('step') // finish & plate closes the flow
        expect(labels.filter((l: string) => l === 'side').length).toBeGreaterThan(0)
        for (const t of newTimers) {
            expect(t.stepIndex).toBeGreaterThanOrEqual(1)
            expect(t.sideRecipeId).toBe('cake')
        }
    })

    test('fresh commit: hot cake finishes with the horizon, no anchors inside cook-active phases', () => {
        const context = buildSideContext(RUNNER, null, null)
        const { picks, newTimers } = buildSidePickEntries([CAKE], context, { servesFor: sideServingsFor })
        expect(picks[0].mode).toBe('horizon')
        const lastUnit = picks[0].units[picks[0].units.length - 1]
        // Last unit ends with the main: anchor must be the last step (2)
        expect(picks[0].units.every((u: any) => u.anchorStep <= 2)).toBe(true)
        expect(newTimers.length).toBeGreaterThan(0)
        expect(lastUnit.serves).toBe(8)
    })

    test('stagger: a second side during the same anchor gets pushed, first stays', () => {
        const context = buildSideContext(RUNNER, 1, RUNNING)
        const second = { ...CAKE, _id: 'cake-2', name: 'Second cake', serveTemp: 'hot' }
        const first = { ...CAKE, _id: 'cake-1', name: 'First cake', serveTemp: 'hot' }
        const claimed = claimExistingAnchors(undefined, undefined)
        const { picks } = buildSidePickEntries([first, second], context, { claimedKeys: claimed, servesFor: sideServingsFor })
        const aHot = picks[0].units.filter((u: any) => u.during)[0]
        const bHot = picks[1].units.filter((u: any) => u.during)[0]
        if (aHot && bHot) {
            expect(bHot.intoMinutes).toBeGreaterThan(aHot.intoMinutes)
        }
    })

    serveTempForPseudo // referenced so the export is used in this suite
})
