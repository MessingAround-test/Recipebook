const { aggregateToWeeks, getWeekOfMonthLabel } = require('../lib/trendsAggregation');

describe('getWeekOfMonthLabel', () => {
    test('labels Monday-anchored weeks within a month', () => {
        // Jan 2024: Jan 1 is a Monday
        expect(getWeekOfMonthLabel('2024-01-01')).toBe('Jan wk 1');
        expect(getWeekOfMonthLabel('2024-01-08')).toBe('Jan wk 2');
        expect(getWeekOfMonthLabel('2024-01-29')).toBe('Jan wk 5');
    });

    test('handles a month whose first days fall in the previous month week', () => {
        // Feb 2024: Feb 5 is the first Monday (Feb 1 is a Thursday)
        expect(getWeekOfMonthLabel('2024-02-05')).toBe('Feb wk 1');
        expect(getWeekOfMonthLabel('2024-02-26')).toBe('Feb wk 4');
        // Week starting Jan 29 covers Feb 1-4, but its Monday is in January
        expect(getWeekOfMonthLabel('2024-01-29')).toBe('Jan wk 5');
    });
});

describe('aggregateToWeeks', () => {
    test('averages logged days only; unlogged days do not affect the average or day count', () => {
        const weeks = aggregateToWeeks([
            { date: '2024-06-04', score: 80, logged: true, mood: 6, positive: 2, negative: 1, neutral: 0 },
            { date: '2024-06-05', score: 0, logged: false, mood: null, positive: 0, negative: 0, neutral: 0 },
            { date: '2024-06-06', score: 90, logged: true, mood: 8, positive: 0, negative: 0, neutral: 1 },
        ]);

        expect(weeks).toHaveLength(1);
        const week = weeks[0];
        expect(week.date).toBe('2024-06-03'); // Monday anchor
        expect(week.score).toBe(85);
        expect(week.logged).toBe(true);
        expect(week.mood).toBe(7); // avg(6, 8), 1-10 scale; chart layer multiplies by 10
        expect(week.positive).toBe(2);
        expect(week.negative).toBe(1);
        expect(week.neutral).toBe(1);
    });

    test('a logged day scoring 0 is counted in the average (not treated as skipped)', () => {
        const weeks = aggregateToWeeks([
            { date: '2024-06-04', score: 100, logged: true },
            { date: '2024-06-05', score: 0, logged: true },
        ]);
        expect(weeks[0].score).toBe(50);
        expect(weeks[0].logged).toBe(true);
    });

    test('fully unlogged week yields null score/mood and stays marked unlogged', () => {
        const weeks = aggregateToWeeks([
            { date: '2024-06-04', score: 0, logged: false, mood: null },
            { date: '2024-06-05', score: 0, logged: false, mood: null },
        ]);
        expect(weeks[0].score).toBeNull();
        expect(weeks[0].mood).toBeNull();
        expect(weeks[0].logged).toBe(false);
    });

    test('buckets split across Monday boundary', () => {
        const weeks = aggregateToWeeks([
            { date: '2024-06-09', score: 60, logged: true }, // Sunday
            { date: '2024-06-10', score: 80, logged: true }, // Monday
        ]);
        expect(weeks).toHaveLength(2);
        expect(weeks[0].date).toBe('2024-06-03');
        expect(weeks[0].score).toBe(60);
        expect(weeks[1].date).toBe('2024-06-10');
        expect(weeks[1].score).toBe(80);
    });

    test('symptom counts are summed across the week', () => {
        const weeks = aggregateToWeeks([
            { date: '2024-06-03', positive: 1, negative: 0, neutral: 2 },
            { date: '2024-06-04', positive: 3, negative: 1, neutral: 0 },
        ]);
        expect(weeks[0].positive).toBe(4);
        expect(weeks[0].negative).toBe(1);
        expect(weeks[0].neutral).toBe(2);
    });

    test('handles empty input', () => {
        expect(aggregateToWeeks([])).toEqual([]);
    });
});
