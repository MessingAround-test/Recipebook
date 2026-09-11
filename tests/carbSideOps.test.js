const { parseAiJson } = require('../lib/aiRecipeOps');
const {
    computeCarbInsertPoint,
    computePhaseInsertPoints,
    parseCarbDetectResult,
    resolveCarbSlot,
    resolveCarbTiming,
    resolveVariant,
    fillCarbPhaseText,
    findCarbType,
    findCarbMentionInInstructions,
    recommendCarbOption,
    SEED_CARB_TYPES
} = require('../lib/carbSideOps');

const whiteRice = { name: 'Rice', variants: [{ name: 'White', cookMinutes: 15, prepMinutes: 5 }, { name: 'Brown', cookMinutes: 20, prepMinutes: 5 }] };

describe('computeCarbInsertPoint', () => {
    // Recipe: 4 x 10min steps = 40 min total
    const steps = [
        { Text: 'step 1', time: 10 },
        { Text: 'step 2', time: 10 },
        { Text: 'step 3', time: 10 },
        { Text: 'step 4', time: 10 }
    ];

    test('white rice (20 min total) slots in 2 steps before end', () => {
        // last 2 steps = 20 min => insert before step index 2
        expect(computeCarbInsertPoint(steps, 20, null)).toBe(2);
    });

    test('whole recipe shorter than carb time -> index 0', () => {
        expect(computeCarbInsertPoint([{ Text: 'a', time: 15 }], 20, null)).toBe(0);
    });

    test('carb total larger than remaining tail pushes earlier', () => {
        // brown rice 25 min: last two steps = 20 < 25, so include step 1 as well => index 1
        expect(computeCarbInsertPoint(steps, 25, null)).toBe(1);
    });

    test('ties break in favour of the hint when within one step', () => {
        expect(computeCarbInsertPoint(steps, 20, 3)).toBe(3);
    });

    test('a wild hint is ignored', () => {
        expect(computeCarbInsertPoint(steps, 20, 0)).toBe(2);
        expect(computeCarbInsertPoint(steps, 20, 99)).toBe(2);
    });

    test('missing step times fall back to the average', () => {
        const noTimes = [{ Text: 'a' }, { Text: 'b' }, { Text: 'c' }, { Text: 'd' }];
        // avg = 10 => same as the timed case
        expect(computeCarbInsertPoint(noTimes, 20, null)).toBe(2);
    });

    test('empty recipe returns 0', () => {
        expect(computeCarbInsertPoint([], 20, 0)).toBe(0);
    });
});

describe('resolveVariant / resolveCarbTiming', () => {
    test('resolves valid variants case-insensitively', () => {
        expect(resolveVariant(whiteRice, 'brown')).toBe('Brown');
    });

    test('falls back to the first variant', () => {
        expect(resolveVariant(whiteRice, 'magenta')).toBe('White');
        expect(resolveVariant(whiteRice, null)).toBe('White');
    });

    test('entries without variants have no variant', () => {
        const bread = { name: 'Bread/Wraps', timing: { cookMinutes: 5, prepMinutes: 2 } };
        expect(resolveVariant(bread, 'anything')).toBeUndefined();
    });

    test('timing sums prep + cook', () => {
        expect(resolveCarbTiming(whiteRice, 'White')).toMatchObject({ cookMinutes: 15, prepMinutes: 5, totalMinutes: 20, variant: 'White', label: 'Rice (White)' });
        expect(resolveCarbTiming(whiteRice, 'Brown').totalMinutes).toBe(25);
    });
});

describe('fillCarbPhaseText', () => {
    const whiteRiceTiming = { cookMinutes: 15, prepMinutes: 5, totalMinutes: 20, perServe: { rice: 0.25, water: 0.5 } };

    test('per-serve rice ratios scale with servings', () => {
        expect(fillCarbPhaseText('Wash {qty:rice} rice', whiteRiceTiming, 4)).toBe('Wash 1 cup rice');
        expect(fillCarbPhaseText('Wash {qty:rice} rice', whiteRiceTiming, 2)).toBe('Wash ½ cup rice');
        expect(fillCarbPhaseText('Get {qty:water} boiling', whiteRiceTiming, 4)).toBe('Get 2 cups boiling');
        expect(fillCarbPhaseText('Get {qty:water} boiling', whiteRiceTiming, 2)).toBe('Get 1 cup boiling');
    });

    test('serve count defaults to 2 with unknown servings', () => {
        expect(fillCarbPhaseText('{qty:rice} for {serves}', whiteRiceTiming, null)).toBe('½ cup for 2');
    });

    test('unknown qty token falls back to the serve count', () => {
        expect(fillCarbPhaseText('about {qty:mystery}', whiteRiceTiming, 3)).toBe('about 3');
    });

    test('empty text stays empty', () => {
        expect(fillCarbPhaseText('', whiteRiceTiming, 2)).toBe('');
    });
});

describe('findCarbType', () => {
    const catalog = SEED_CARB_TYPES;
    test('exact name match', () => {
        expect(findCarbType(catalog, 'rice').name).toBe('Rice');
    });
    test('alias match', () => {
        expect(findCarbType(catalog, 'naan').name).toBe('Bread/Wraps');
        expect(findCarbType(catalog, 'basmati rice').name).toBe('Rice');
    });
    test('unknown -> null but fuzzy containment still resolves', () => {
        expect(findCarbType(catalog, 'coconut jasmine rice')).not.toBeNull();
        expect(findCarbType(catalog, 'zzz')).toBeNull();
    });
});

describe('parseCarbDetectResult', () => {
    test('valid detection result', () => {
        const out = parseCarbDetectResult({ alreadyInInstructions: true, matchedStepIndex: 3, reason: 'step 3 cooks the rice' });
        expect(out.ok).toBe(true);
        expect(out.alreadyInInstructions).toBe(true);
        expect(out.matchedStepIndex).toBe(2); // 0-based
        expect(out.reason).toContain('step 3');
    });

    test('null / missing fields are tolerated', () => {
        expect(parseCarbDetectResult(null).ok).toBe(false);
        const out = parseCarbDetectResult({ alreadyInInstructions: false });
        expect(out.ok).toBe(true);
        expect(out.alreadyInInstructions).toBe(false);
        expect(out.matchedStepIndex).toBeUndefined();
        expect(out.reason).toBe('');
    });
});

describe('findCarbMentionInInstructions (heuristic fallback)', () => {
    const rice = { name: 'Rice', aliases: ['basmati rice', 'jasmine rice'] };

    test('hits a step that cooks the carb', () => {
        const steps = [
            { Text: 'Brown the beef in oil.' },
            { Text: 'Simmer the basmati rice for 15 min.' }
        ];
        expect(findCarbMentionInInstructions(rice, steps)).toBe(1);
    });

    test('alias match counts when the family name is used', () => {
        const steps = [{ Text: 'Steam the jasmine rice until fluffy.' }];
        expect(findCarbMentionInInstructions(rice, steps)).toBe(0);
    });

    test('merely referencing the carb without cooking does not count', () => {
        const steps = [{ Text: 'Toss through rice noodles at the end.' }];
        expect(findCarbMentionInInstructions(rice, steps)).toBe(-1);
    });

    test('unknown carb / no steps -> -1', () => {
        expect(findCarbMentionInInstructions(null, [{ Text: 'boil rice' }])).toBe(-1);
        expect(findCarbMentionInInstructions(rice, [])).toBe(-1);
    });
});

describe('resolveCarbTiming (system seed overlay)', () => {
    test('stale pre-phase system doc still yields the canonical phase sequence', () => {
        const stale = {
            name: 'Rice', isSystem: true, aliases: [],
            timing: { cookMinutes: 15, prepMinutes: 5 },
            variants: [{ name: 'White', cookMinutes: 15, prepMinutes: 5 }, { name: 'Brown', cookMinutes: 20, prepMinutes: 5 }]
        };
        const timing = resolveCarbTiming(stale, 'White');
        expect(timing.phases.map(p => p.name)).toEqual(['Boil water', 'Add rice, simmer', 'Fluff & rest']);
        expect(timing.totalMinutes).toBe(20);
        expect(timing.perServe).toEqual({ rice: 0.25, water: 0.5 });
        // Phase instructions exist and carry serve tokens (not blank)
        expect(timing.phases[0].instruction).toContain('{qty:rice}');
    });

    test('admin-created types are returned untouched (no overlay)', () => {
        const adminType = { name: 'Bulgur', isSystem: false, timing: { cookMinutes: 12, prepMinutes: 3 } };
        const timing = resolveCarbTiming(adminType, null);
        expect(timing.totalMinutes).toBe(15);
        expect(timing.phases).toHaveLength(2); // legacy expansion: Get it started + Cook
    });
});

describe('computePhaseInsertPoints', () => {
    const steps = [{ Text: 'a', time: 10 }, { Text: 'b', time: 10 }, { Text: 'c', time: 10 }, { Text: 'd', time: 10 }];
    const riceSeed = SEED_CARB_TYPES.find(c => c.name === 'Rice');

    test('white rice phases land at -20, -15 and the last step', () => {
        const phases = resolveCarbTiming(riceSeed, 'White').phases;
        const out = computePhaseInsertPoints(steps, phases);
        expect(out.map(p => p.insertAfter)).toEqual([2, 2, 3]); // indices
        expect(out[2].minutes).toBe(0); // fluff = timer-less card
    });

    test('brown rice pushes the boil phase one step earlier', () => {
        const steps2 = [{ Text: 'a', time: 10 }, { Text: 'b', time: 10 }, { Text: 'c', time: 10 }, { Text: 'd', time: 10 }];
        const phases = resolveCarbTiming(riceSeed, 'Brown').phases; // 5+20+0 = 25
        const out = computePhaseInsertPoints(steps2, phases);
        expect(out.map(p => p.insertAfter)).toEqual([1, 2, 3]);
    });

    test('phases each get their own slot when step times allow', () => {
        // 30min tail: phases of 20 and 5 land at different steps
        const steps3 = [{ Text: 'a', time: 8 }, { Text: 'b', time: 7 }, { Text: 'c', time: 25 }, { Text: 'd', time: 5 }];
        const phases = [{ name: 'boil', minutes: 5, instruction: '' }, { name: 'cook', minutes: 15, instruction: '' }];
        const out = computePhaseInsertPoints(steps3, phases);
        // cook (15 before end): steps c+d span 30 => index 2; boil (20): c+d = 30 >= 20 => index 2? b+c+d=37 -> c+d=30>=20 so idx 2 as well
        expect(out.map(p => p.insertAfter)).toEqual([2, 2]);
    });

    test('brown rice lands mid-step of a long cook (the chilli case)', () => {
        // Rice (5 + 20 min) must finish with the recipe; both timed phases
        // start partway through the 90-min chilli step, not before it.
        const chilli = [{ Text: 'a', time: 10 }, { Text: 'b', time: 10 }, { Text: 'c', time: 90 }, { Text: 'd', time: 15 }];
        const phases = resolveCarbTiming(riceSeed, 'Brown').phases; // boil 5, cook 20, fluff 0
        const out = computePhaseInsertPoints(chilli, phases);
        expect(out.map(p => p.insertAfter)).toEqual([2, 2, 3]);
        expect(out.map(p => p.during)).toEqual([true, true, false]);
        expect(out.map(p => p.intoMinutes)).toEqual([80, 85, 0]);
    });

    test('boundary slots are not marked during', () => {
        const out = computePhaseInsertPoints(steps, resolveCarbTiming(riceSeed, 'White').phases);
        expect(out.map(p => p.insertAfter)).toEqual([2, 2, 3]);
        expect(out[0].during).toBe(false); // boil lands exactly 20 min before end
        expect(out[0].intoMinutes).toBe(0);
    });

    test('empty phases -> empty result', () => {
        expect(computePhaseInsertPoints(steps, [])).toEqual([]);
    });
});

describe('resolveCarbSlot (mid-step "during" detection)', () => {
    // Chilli-style tail: a 90-min cook followed by a 15-min finisher
    const chilli = [{ Text: 'a', time: 10 }, { Text: 'b', time: 10 }, { Text: 'c', time: 90 }, { Text: 'd', time: 15 }];

    test('slot landing mid-step reports how far into the step it starts', () => {
        // 25 min before the end => 80 min into the 90-min step
        expect(resolveCarbSlot(chilli, 25)).toEqual({ index: 2, intoMinutes: 80 });
        expect(resolveCarbSlot(chilli, 20)).toEqual({ index: 2, intoMinutes: 85 });
    });

    test('slot landing exactly on a step boundary is a plain insert', () => {
        // steps c+d span 105; need 15 => lands exactly where step d starts
        expect(resolveCarbSlot(chilli, 15)).toEqual({ index: 3, intoMinutes: 0 });
    });

    test('overshoot under 5 min snaps back to the boundary', () => {
        const steps = [{ Text: 'a', time: 10 }, { Text: 'b', time: 10 }, { Text: 'c', time: 10 }, { Text: 'd', time: 10 }];
        // need 17: step c starts 20 min before the end, only 3 min early
        expect(resolveCarbSlot(steps, 17)).toEqual({ index: 2, intoMinutes: 0 });
        // need 15: exactly 5 min overshoot => stays "during"
        expect(resolveCarbSlot(steps, 15)).toEqual({ index: 2, intoMinutes: 5 });
    });

    test('zero and recipe-shorter-than-slot cases stay boundary inserts', () => {
        expect(resolveCarbSlot(chilli, 0)).toEqual({ index: 3, intoMinutes: 0 });
        expect(resolveCarbSlot([{ Text: 'a', time: 15 }], 20)).toEqual({ index: 0, intoMinutes: 0 });
        expect(resolveCarbSlot([], 20)).toEqual({ index: 0, intoMinutes: 0 });
    });
});

describe('no-minute steps and timer-backed durations', () => {
    const riceSeed = SEED_CARB_TYPES.find(c => c.name === 'Rice');

    test('an explicit 0-min last step stays 0 instead of the average fallback', () => {
        // "stir and serve" finishing step with no duration: the rice must
        // finish with the 90-min cook, not be pulled onto the fake tail
        const chilli = [{ Text: 'a', time: 10 }, { Text: 'b', time: 10 }, { Text: 'c', time: 90 }, { Text: 'd', time: 0 }];
        const out = computePhaseInsertPoints(chilli, resolveCarbTiming(riceSeed, 'White').phases);
        expect(out.map(p => p.insertAfter)).toEqual([2, 2, 3]);
        expect(out.map(p => p.during)).toEqual([true, true, false]);
        expect(out.map(p => p.intoMinutes)).toEqual([70, 75, 0]);
    });

    test('resolveCarbSlot walks straight over a 0-min tail step', () => {
        expect(resolveCarbSlot([{ time: 90 }, { time: 0 }], 20)).toEqual({ index: 0, intoMinutes: 70 });
        expect(resolveCarbSlot([{ time: 90 }, { time: 0 }], 90)).toEqual({ index: 0, intoMinutes: 0 });
        expect(computeCarbInsertPoint([{ time: 90 }, { time: 0 }], 20, null)).toBe(0);
    });

    test('a MISSING time still falls back to the known average', () => {
        // avg of known [90] = 90 for the time-less step
        expect(resolveCarbSlot([{ time: 90 }, {}], 20)).toEqual({ index: 1, intoMinutes: 70 });
    });
});

describe('recommendCarbOption', () => {
    const catalog = SEED_CARB_TYPES;
    test('recipe type wins', () => {
        const rec = recommendCarbOption(catalog, [{ type: 'Potato', at: 2 }, { type: 'Rice', variant: 'Brown', at: 3 }], 'Rice');
        expect(rec.name).toBe('Rice');
    });
    test('falls back to newest history entry', () => {
        const rec = recommendCarbOption(catalog, [{ type: 'Couscous', at: 5 }, { type: 'Potato', at: 9 }], null);
        expect(rec.name).toBe('Couscous');
    });
    test('stale history entries are skipped', () => {
        const rec = recommendCarbOption(catalog, [{ type: 'Tapioca', at: 5 }], null);
        expect(rec.name).toBe('Rice'); // first catalog entry by order
    });
    test('empty everything -> null', () => {
        expect(recommendCarbOption([], [], null)).toBeNull();
    });
});

test('parseAiJson tolerates fenced responses', () => {
    expect(parseAiJson('```json\n{"a":1}\n```').a).toBe(1);
});
