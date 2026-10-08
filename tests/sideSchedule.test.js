const {
    resolveStepTimes,
    buildMainTimeline,
    buildAttentionGaps,
    locateMinute,
    scheduleSide,
    scheduleSides,
    estimateMainRemaining,
    DURING_THRESHOLD_MIN,
    STAGGER_MIN
} = require('../lib/sideSchedule');

// Main used by several cases: 10 min active prep, 90 min walk-away bake,
// 5 min active plating.
const BAKE_MAIN_STEPS = [
    { time: 10, involvement: 'active' },
    { time: 90, involvement: 'none' },
    { time: 5, involvement: 'active' }
];
const BAKE_TIMERS = [{ duration: 90, involvement: 'none', stepIndex: 1 }];
const BAKE = buildMainTimeline(BAKE_MAIN_STEPS); // total 105, step1 spans [10,100)

describe('resolveStepTimes', () => {
    test('missing times fall back to the average of known ones', () => {
        const got = resolveStepTimes([{ time: 20 }, {}, { time: 10 }]);
        expect(got).toEqual([20, 15, 10]);
    });
    test('explicit zero stays zero (instant step)', () => {
        expect(resolveStepTimes([{ time: 0 }, {}])).toEqual([0, 10]);
    });
    test('nothing known falls back to 10', () => {
        expect(resolveStepTimes([{}, {}])).toEqual([10, 10]);
    });
});

describe('buildAttentionGaps', () => {
    test('involvement none walks carve one long gap', () => {
        const gaps = buildAttentionGaps(BAKE_MAIN_STEPS, BAKE, BAKE_TIMERS);
        expect(gaps).toHaveLength(1);
        expect(gaps[0].startMin).toBe(10);
        expect(gaps[0].endMin).toBe(100);
    });
    test('no walk-away steps means no gaps', () => {
        const steps = [{ time: 10 }, { time: 20 }];
        const gaps = buildAttentionGaps(steps, buildMainTimeline(steps), []);
        expect(gaps).toHaveLength(0);
    });
    test('a walk-away timer frees its window even on a busy step', () => {
        const steps = [{ time: 30, involvement: 'active' }, { time: 10 }];
        const timers = [{ duration: 20, involvement: 'none', stepIndex: 0 }];
        const gaps = buildAttentionGaps(steps, buildMainTimeline(steps), timers);
        expect(gaps).toHaveLength(1);
        expect(gaps[0].startMin).toBe(0);
        expect(gaps[0].endMin).toBe(20);
    });
});

describe('hot sides: classic horizon anchoring', () => {
    const timeline = buildMainTimeline([{ time: 30 }, { time: 10 }, { time: 20 }]); // total 60
    const side = {
        recipeId: 's1', name: 'Garlic bread', serveTemp: 'hot',
        units: [
            { kind: 'step', index: 0, minutes: 28 },
            { kind: 'step', index: 1, minutes: 2 },
            { kind: 'step', index: 2, minutes: 0 }
        ]
    };
    test('units backwards-slot so the chain finishes with the last step', () => {
        const plan = scheduleSide(timeline, [], [], side, []);
        expect(plan.mode).toBe('horizon');
        expect(plan.units).toHaveLength(3);
        // Unit starts (from the end): 58 -> step 2 at +18; 30 -> exactly the
        // boundary of step 1; the zero-minute unit rides the last step.
        const [chop, quick, assemble] = plan.units;
        expect(chop.anchorStep).toBe(1);
        expect(chop.intoMinutes).toBe(0);
        expect(chop.during).toBe(false);
        expect(quick.anchorStep).toBe(2);
        expect(quick.intoMinutes).toBe(18);
        expect(assemble.minutes).toBe(0);
        expect(assemble.anchorStep).toBe(2);
    });
    test('small overshoots land on the step boundary', () => {
        const plan = scheduleSide(timeline, [], [], {
            recipeId: 's2', name: 'x', serveTemp: 'hot',
            units: [{ kind: 'step', index: 0, minutes: 25 }]
        }, []);
        const slot = plan.units[0];
        // Starts at 35 -> 5 min into the 10-min step: a sub-threshold overshoot
        // is "during" only when a timer truly exists; without one it degrades
        // to a manual card that still keeps its offset.
        expect(slot.anchorStep).toBe(1);
        expect(slot.intoMinutes).toBe(5);
        expect(slot.during).toBe(false);
    });
    test('a real "during" slot keeps its intoMinutes when a timer exists', () => {
        const plan = scheduleSide(timeline, [], [], {
            recipeId: 's3', name: 'x', serveTemp: 'hot',
            units: [{ kind: 'step', index: 0, minutes: 15 }]
        }, [{ duration: 10, stepIndex: 2, involvement: 'active' }]);
        expect(plan.units[0].during).toBe(true);
        expect(plan.units[0].intoMinutes).toBe(5);
    });
    test('"during" downgrades to a manual card when the step has no timer', () => {
        const plan = scheduleSide(timeline, [], [], {
            recipeId: 's4', name: 'x', serveTemp: 'hot',
            units: [{ kind: 'step', index: 0, minutes: 15 }]
        }, []);
        expect(plan.units[0].during).toBe(false);
    });
});

describe('cold sides: earliest-gap placement', () => {
    const gaps = buildAttentionGaps(BAKE_MAIN_STEPS, BAKE, BAKE_TIMERS);
    test('a fitting cold side slots into the walk-away window and holds after', () => {
        const side = {
            recipeId: 'cold1', name: 'Salad', serveTemp: 'cold',
            units: [
                { kind: 'step', index: 0, minutes: 15 },
                { kind: 'step', index: 1, minutes: 5 }
            ]
        };
        const plan = scheduleSide(BAKE, gaps, BAKE_MAIN_STEPS, side, BAKE_TIMERS);
        expect(plan.mode).toBe('gap');
        expect(plan.hold).toEqual({ minutes: 5 });
        // Chain start = 100-20 = 80 -> 70 min into the bake that starts at 10
        const [chop, toss] = plan.units;
        expect(chop.anchorStep).toBe(1);
        expect(chop.intoMinutes).toBe(70);
        expect(chop.during).toBe(true); // the bake timer anchors it
        expect(toss.anchorStep).toBe(1);
        expect(toss.intoMinutes).toBe(85);
        expect(toss.during).toBe(true);
        expect(plan.note).toContain('min break');
    });
    test('the earliest fitting gap wins, not the latest', () => {
        const steps = [
            { time: 5, involvement: 'none' },
            { time: 30, involvement: 'active' },
            { time: 60, involvement: 'none' }
        ];
        const timeline = buildMainTimeline(steps);
        const timers = [
            { duration: 5, involvement: 'none', stepIndex: 0 },
            { duration: 60, involvement: 'none', stepIndex: 2 }
        ];
        const gaps = buildAttentionGaps(steps, timeline, timers);
        const plan = scheduleSide(timeline, gaps, steps, {
            recipeId: 'c2', name: 'x', serveTemp: 'cold',
            units: [{ kind: 'step', index: 0, minutes: 10 }]
        }, timers);
        expect(plan.mode).toBe('gap');
        // Chain rides the END of the first 5-min gap? No: 5 < 10, so it
        // needs the second gap [35,95): start = 95-10 = 85.
        expect(plan.units[0].intoMinutes).toBe(85 - 35); // 50 into step 2
        expect(plan.units[0].anchorStep).toBe(2);
    });
    test('no fitting gap degrades to the horizon with a note', () => {
        const plan = scheduleSide(BAKE, gaps, BAKE_MAIN_STEPS, {
            recipeId: 'c3', name: 'Slowpickle', serveTemp: 'cold',
            units: [{ kind: 'step', index: 0, minutes: 120 }]
        }, BAKE_TIMERS);
        expect(plan.mode).toBe('horizon');
        expect(plan.hold).toBeNull();
        expect(plan.note).toMatch(/No break long enough/);
    });
    test('zero-minute assemble steps ride the chain end (gap end boundary)', () => {
        const plan = scheduleSide(BAKE, gaps, BAKE_MAIN_STEPS, {
            recipeId: 'c4', name: 'Plate bowl', serveTemp: 'cold',
            units: [
                { kind: 'step', index: 0, minutes: 10 },
                { kind: 'step', index: 1, minutes: 0 }
            ]
        }, BAKE_TIMERS);
        expect(plan.mode).toBe('gap');
        const assemble = plan.units[1];
        expect(assemble.minutes).toBe(0);
        // The chain ends at minute 100 = the plating step's start: a clean
        // boundary anchor, no "during" offset.
        expect(assemble.anchorStep).toBe(2);
        expect(assemble.intoMinutes).toBe(0);
    });
});

describe('reheatable sides: gap cooking + reheat at the horizon', () => {
    const gaps = buildAttentionGaps(BAKE_MAIN_STEPS, BAKE, BAKE_TIMERS);
    test('cook units nest early, reheat unit lands at the serve horizon', () => {
        const plan = scheduleSide(BAKE, gaps, BAKE_MAIN_STEPS, {
            recipeId: 'r1', name: 'Leftover stew', serveTemp: 'reheatable', reheatMinutes: 5,
            units: [{ kind: 'step', index: 0, minutes: 15 }]
        }, BAKE_TIMERS);
        expect(plan.mode).toBe('gap');
        const cook = plan.units[0];
        const reheat = plan.units[1];
        expect(cook.kind).toBe('step');
        expect(cook.anchorStep).toBe(1);
        expect(cook.intoMinutes).toBe(75); // chain start = 100-15 = 85 -> into 75
        expect(cook.during).toBe(true);
        expect(reheat.kind).toBe('reheat');
        expect(reheat.minutes).toBe(5);
        // Reheat ends at 105 -> backward walk of 5 min rides the last step
        expect(reheat.anchorStep).toBe(2);
    });
    test('hold minutes cover the stretch between chain end and reheat', () => {
        const plan = scheduleSide(BAKE, gaps, BAKE_MAIN_STEPS, {
            recipeId: 'r2', name: 'Stew', serveTemp: 'reheatable', reheatMinutes: 10,
            units: [{ kind: 'step', index: 0, minutes: 20 }]
        }, BAKE_TIMERS);
        expect(plan.hold).toBeNull(); // gap end (100) + nothing to hold: reheat sits at 95-105
        // hold only counts idle time AFTER the chain before the reheat: here none
    });
});

describe('multi-side collision stagger', () => {
    test('two hot sides anchoring the same during slot get staggered', () => {
        const steps = [{ time: 30 }, { time: 90 }, { time: 20 }];
        const timeline = buildMainTimeline(steps);
        const timers = [{ duration: 30, involvement: 'active', stepIndex: 1 }];
        const mk = id => ({
            recipeId: id, name: id, serveTemp: 'hot',
            units: [{ kind: 'step', index: 0, minutes: 25 }]
        });
        const plans = scheduleSides(timeline, [], steps, [mk('a'), mk('b')], timers);
        // Both would slot at 115 -> step 1 spans [30,120): into 85
        expect(plans[0].units[0].intoMinutes).toBe(85);
        expect(plans[1].units[0].intoMinutes).toBe(85 + STAGGER_MIN);
    });
});

describe('locateMinute', () => {
    test('returns the step containing the minute and the offset into it', () => {
        const tl = buildMainTimeline([{ time: 30 }, { time: 10 }]);
        expect(locateMinute(tl, 0)).toEqual({ index: 0, intoMinutes: 0 });
        expect(locateMinute(tl, 29)).toEqual({ index: 0, intoMinutes: 29 });
        expect(locateMinute(tl, 30)).toEqual({ index: 1, intoMinutes: 0 });
        expect(locateMinute(tl, 999)).toEqual({ index: 1, intoMinutes: 10 }); // clamped to total
    });
});

describe('estimateMainRemaining', () => {
    test('sums remaining steps from the flow position', () => {
        expect(estimateMainRemaining(BAKE, 0, null)).toBe(105);
        expect(estimateMainRemaining(BAKE, 1, null)).toBe(95);
    });
    test('a running main timer eats into the countdown', () => {
        // On the 90-min bake with 40 min left: 50 min elapsed -> 105-10-50=45
        expect(estimateMainRemaining(BAKE, 1, 40 * 60)).toBe(45);
    });
    test('never goes negative', () => {
        expect(estimateMainRemaining(BAKE, 2, null)).toBe(5);
        expect(estimateMainRemaining(BAKE, 9, 0)).toBeGreaterThanOrEqual(0);
    });
});

describe('thresholds', () => {
    test('keeps the carbrain-compatible defaults in lockstep', () => {
        expect(DURING_THRESHOLD_MIN).toBe(5);
        expect(STAGGER_MIN).toBeGreaterThanOrEqual(2);
        expect(STAGGER_MIN).toBeLessThanOrEqual(4);
    });
});
