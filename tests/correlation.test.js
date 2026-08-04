const { computeCorrelations } = require('../lib/correlation');

const TARGETS = { energy_kcal: 100, protein_g: 100, carbohydrates_g: 100, fat_g: 100, fiber_g: 100 };

function daily(date, names, nutrients, exerciseKcal) {
    return {
        date,
        items: (names || []).map(name => ({ name, nutrients: nutrients || {} })),
        exercise_kcal: exerciseKcal || 0,
    };
}

function sym(date, symptomNames) {
    return { date, symptoms: (symptomNames || []).map(name => ({ name })) };
}

test('same-day positive correlation, base rate and support filtering', () => {
    const dailyLogs = [];
    const symptomLogs = [];
    for (let d = 1; d <= 15; d++) {
        const date = `2026-01-${String(d).padStart(2, '0')}`;
        if (d <= 6) dailyLogs.push(daily(date, ['milk', 'lowfood']));
        symptomLogs.push(sym(date, d <= 6 ? ['headache'] : ['okay']));
    }
    // 'rare' co-occurs with lowfood only twice -> should be filtered by support
    symptomLogs[0].symptoms = [{ name: 'headache' }, { name: 'rare' }];
    symptomLogs[1].symptoms = [{ name: 'headache' }, { name: 'rare' }];

    const result = computeCorrelations(dailyLogs, symptomLogs, TARGETS);

    expect(result.meta.observedDays).toBe(15);
    expect(result.symptoms.some(s => s.name === 'rare')).toBe(false);

    const headache = result.symptoms.find(s => s.name === 'headache');
    expect(headache).toBeTruthy();
    expect(headache.top.exposureKey).toBe('food|milk');
    expect(headache.top.lag).toBe(0);
    expect(headache.top.support).toBe(6);
    expect(headache.top.pct).toBe(100);
    expect(headache.top.baseRate).toBe(40);
    expect(headache.top.lift).toBeCloseTo(2.5, 1);
});

test('next-day lag links a food to the following day symptom', () => {
    const dailyLogs = [];
    const symptomLogs = [];
    for (let d = 1; d <= 10; d++) {
        const date = `2026-01-${String(d).padStart(2, '0')}`;
        if (d <= 6) dailyLogs.push(daily(date, ['fish']));
        symptomLogs.push(sym(date, d >= 2 && d <= 7 ? ['good energy'] : ['okay']));
    }

    const result = computeCorrelations(dailyLogs, symptomLogs, TARGETS);

    const goodEnergy = result.symptoms.find(s => s.name === 'good energy');
    expect(goodEnergy).toBeTruthy();
    const fishNextDay = goodEnergy.moreLikely.find(e => e.exposureKey === 'food|fish' && e.lag === 1);
    expect(fishNextDay).toBeTruthy();
    expect(fishNextDay.support).toBe(6);
    expect(fishNextDay.pct).toBe(100);
});

test('high daily score correlates with a positive custom symptom', () => {
    const dailyLogs = [];
    const symptomLogs = [];
    for (let d = 1; d <= 12; d++) {
        const date = `2026-01-${String(d).padStart(2, '0')}`;
        if (d <= 6) {
            dailyLogs.push(daily(date, ['muesli'], {
                energy_kcal: 100, protein_g: 100, carbohydrates_g: 100, fat_g: 100, fiber_g: 100,
            }));
        }
        symptomLogs.push(sym(date, d <= 6 ? ['felt amazing'] : ['okay']));
    }

    const result = computeCorrelations(dailyLogs, symptomLogs, TARGETS);

    const feltAmazing = result.symptoms.find(s => s.name === 'felt amazing');
    expect(feltAmazing).toBeTruthy();
    const highScore = feltAmazing.moreLikely.find(e => e.exposureKey === 'score:high');
    expect(highScore).toBeTruthy();
    expect(highScore.pct).toBe(100);
    expect(highScore.support).toBe(6);
    expect(feltAmazing.baseRate).toBe(50);
});

test('negative (less likely) correlation and custom food/symptom names', () => {
    const dailyLogs = [
        daily('2026-01-01', ['coffee', 'blue cheese']),
        daily('2026-01-02', ['coffee', 'blue cheese']),
        daily('2026-01-03', ['coffee', 'blue cheese']),
        daily('2026-01-04', ['coffee']),
    ];
    const symptomLogs = [
        sym('2026-01-01', ['tired', 'weird dream']),
        sym('2026-01-02', ['tired', 'weird dream']),
        sym('2026-01-03', ['weird dream']),
        sym('2026-01-04', ['meh']),
        sym('2026-01-05', ['tired']),
        sym('2026-01-06', ['tired']),
        sym('2026-01-07', ['tired']),
        sym('2026-01-08', ['tired']),
    ];

    const result = computeCorrelations(dailyLogs, symptomLogs, TARGETS, [], { minSupport: 2, minExposureObserved: 2 });

    const tired = result.symptoms.find(s => s.name === 'tired');
    expect(tired).toBeTruthy();
    const coffeeLess = tired.lessLikely.find(e => e.exposureKey === 'food|coffee');
    expect(coffeeLess).toBeTruthy();
    expect(coffeeLess.support).toBe(2);
    expect(coffeeLess.pct).toBe(50);
    expect(coffeeLess.lift).toBeLessThan(1);

    const weirdDream = result.symptoms.find(s => s.name === 'weird dream');
    expect(weirdDream).toBeTruthy();
    const blueCheese = weirdDream.moreLikely.find(e => e.exposureKey === 'food|blue cheese');
    expect(blueCheese).toBeTruthy();
    expect(blueCheese.pct).toBe(100);
});

test('returns empty result when no observed days exist', () => {
    const dailyLogs = [daily('2026-01-01', ['milk'])];
    const symptomLogs = [];
    const result = computeCorrelations(dailyLogs, symptomLogs, TARGETS);
    expect(result.meta.observedDays).toBe(0);
    expect(result.symptoms).toHaveLength(0);
});
