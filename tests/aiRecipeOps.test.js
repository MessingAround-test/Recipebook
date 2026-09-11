const { parseTimerResult } = require('../lib/aiRecipeOps');

describe('parseTimerResult involvement', () => {
    test('maps a valid involvement level through', () => {
        const data = {
            timers: [
                { id: 'timer-1', type: 'timer', name: 'Bake', duration: 40, involvement: 'none', stepIndex: 1 },
                { id: 'timer-2', type: 'timer', name: 'Simmer', duration: 25, involvement: 'low', stepIndex: 2 },
                { id: 'timer-3', type: 'timer', name: 'Boil pasta', duration: 10, involvement: 'active', stepIndex: 3 }
            ]
        };
        const result = parseTimerResult(data);
        expect(result.timers.map(t => t.involvement)).toEqual(['none', 'low', 'active']);
    });

    test('invalid or missing involvement defaults to active', () => {
        const data = {
            timers: [
                { name: 'Bake', duration: 40, involvement: 'sometimes' },
                { name: 'Rest', duration: 10 }
            ]
        };
        const parsed = parseTimerResult(data);
        expect(parsed.timers.map(t => t.involvement)).toEqual(['active', 'active']);
    });

    test('checkpoints also carry an involvement value (inherited by convention, unused in UI)', () => {
        const data = {
            timers: [
                { id: 'timer-1', name: 'Bake', duration: 40, involvement: 'none' },
                { id: 'ckpt-1', type: 'checkpoint', name: 'Check', duration: 0, involvement: 'none', parentTimerId: 'timer-1' }
            ]
        };
        const result = parseTimerResult(data);
        expect(result.timers[1].involvement).toBe('none');
        expect(result.timers[1].type).toBe('checkpoint');
    });
});
