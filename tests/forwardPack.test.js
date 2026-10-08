// Forward-packing rules: nothing slots in front of the cook's first step.
const { computePhaseInsertPoints } = require('../lib/carbSideOps');
const sideSchedule = require('../lib/sideSchedule').default || require('../lib/sideSchedule');

const TOFU_STEPS = [
    { Text: 'toss', time: 5 },
    { Text: 'fry', time: 5 },
    { Text: 'sauce', time: 5 },
    { Text: 'heat through', time: 4 },
    { Text: 'garnish', time: 2 }
];

describe('carb phases forward-pack when the chain overflows the tail', () => {
    test('brown rice (25) in the 21-min tofu: boil fires with step 1, rice at step 2, fluff last', () => {
        const phases = [
            { name: 'Boil water', minutes: 5, instruction: '' },
            { name: 'Add rice, simmer', minutes: 20, instruction: '' },
            { name: 'Fluff & rest', minutes: 0, instruction: '' }
        ];
        const out = computePhaseInsertPoints(TOFU_STEPS, phases);
        // Boil clamps to "with step 1" (during), not before the cook starts
        expect(out[0].insertAfter).toBe(0);
        expect(out[0].during).toBe(true);
        // Add rice water at the soonest boundary after boil can finish
        expect(out[1].insertAfter).toBe(1);
        // Fluff rides the horizon, after the last step
        expect(out[2].insertAfter).toBe(4);
        expect(out[2].during).toBe(false);
    });

    test('tight-but-fitting phases live in the run rather than piling before step 1', () => {
        const phases = [
            { name: 'boil', minutes: 5, instruction: '' },
            { name: 'cook', minutes: 15, instruction: '' },
            { name: 'fluff', minutes: 0, instruction: '' }
        ];
        const out = computePhaseInsertPoints(TOFU_STEPS, phases);
        // 20-min rear chain in a 21-min cook: boil at minute 1, rice at minute 6 -
        // both marked during so they fire when the cook reaches step 1
        expect(out.map((p) => p.insertAfter)).toEqual([0, 1, 4]);
        expect(out[0].during).toBe(true);
        expect(out[0].intoMinutes).toBe(1);
        expect(out[1].during).toBe(true);
        expect(out[1].intoMinutes).toBe(1);
        expect(out[2].during).toBe(false); // fluff rides the horizon
    });
});

describe('recipe-side hot chains forward-pack too', () => {
    const timeline = sideSchedule.buildMainTimeline(TOFU_STEPS);
    const mkSide = (units) => ({
        recipeId: 's1', name: 'Latte', serveTemp: 'hot',
        units: units.map((minutes, i) => ({ kind: 'step', index: i, minutes }))
    });

    test('an overflowing hot side clamps to "start with step 1" - no card before the flow starts', () => {
        const plan = sideSchedule.scheduleSide(timeline, [], TOFU_STEPS, mkSide([12, 8, 6]), []);
        expect(plan.mode).toBe('horizon');
        const first = plan.units[0];
        expect(first.anchorStep).toBe(0);
        expect(first.during).toBe(true);   // fires on reaching/timer of step 1
        // later units never precede their predecessor's finish
        expect(plan.units[1].anchorStep).toBeGreaterThanOrEqual(first.anchorStep);
    });

    test('a fitting hot side still slots exactly as before', () => {
        const plan = sideSchedule.scheduleSide(timeline, [], TOFU_STEPS, mkSide([4, 3]), []);
        const [a, b] = plan.units;
        // raw starts: 14 and 18 -> step 3 at +4 / step 4 at +3
        expect(a.anchorStep).toBe(2);
        expect(a.intoMinutes).toBe(4);
        expect(b.anchorStep).toBe(3);
        expect(b.intoMinutes).toBe(3);
        expect(a.during).toBe(false);      // no timers on those steps -> manual cards
        expect(b.during).toBe(false);
    });
});
