// Gym helpers: e1RM/volume maths, formatting, set prefill resolution, session
// date validation and plan item sanitization (field report: plan vs achieved
// must line up and back-dated sessions must reject future dates).
import {
    estimateE1RM, setVolume, totalVolume, totalTimedSeconds, topWeight, bestE1RM, topDuration,
    estimateSessionMET, estimateSessionKcal,
    formatDurationSec, formatSetDisplay, formatPlanTarget, modeLabel,
    resolvePrefillWeight, resolvePrefillReps,
    validateSessionDate, todayLocalISO, toLocalISODate,
    sanitizePlanItem, sanitizeWorkoutSettings, STARTER_PLANS, STARTER_EXERCISES,
    LoggedSetT,
} from '../lib/gym';

const set = (partial: Partial<LoggedSetT>): LoggedSetT => ({
    set_number: 1,
    planned_reps: null,
    planned_weight_kg: null,
    planned_duration_sec: null,
    actual_reps: null,
    actual_weight_kg: null,
    actual_duration_sec: null,
    is_failure: false,
    completed_at: null,
    ...partial,
});

describe('estimateE1RM', () => {
    it('returns the weight for a single rep', () => {
        expect(estimateE1RM(100, 1)).toBe(100);
    });

    it('applies the Epley formula for multiple reps', () => {
        expect(estimateE1RM(100, 5)).toBe(116.7); // 100 * (1 + 5/30)
        expect(estimateE1RM(60, 8)).toBe(76);     // 60 * (1 + 8/30) = 76
    });

    it('returns 0 for missing or non-positive inputs', () => {
        expect(estimateE1RM(0, 5)).toBe(0);
        expect(estimateE1RM(100, 0)).toBe(0);
        expect(estimateE1RM(null as any, 5)).toBe(0);
        expect(estimateE1RM(100, null as any)).toBe(0);
    });
});

describe('volume helpers', () => {
    it('setVolume is weight × reps and 0 for bodyweight/timed', () => {
        expect(setVolume(60, 8)).toBe(480);
        expect(setVolume(null, 10)).toBe(0);
        expect(setVolume(60, null)).toBe(0);
        expect(setVolume(60, 0)).toBe(0);
    });

    it('totalVolume sums only rep-based work and rounds', () => {
        const sets = [
            set({ actual_weight_kg: 60, actual_reps: 8 }),
            set({ actual_weight_kg: 60, actual_reps: 7 }),
            set({ actual_duration_sec: 60 }), // timed — no volume
        ];
        expect(totalVolume(sets)).toBe(900);
        expect(totalVolume([])).toBe(0);
        expect(totalVolume(null)).toBe(0);
    });

    it('totalTimedSeconds sums durations only', () => {
        const sets = [
            set({ actual_duration_sec: 60 }),
            set({ actual_duration_sec: 45, actual_reps: 10, actual_weight_kg: 20 }),
        ];
        expect(totalTimedSeconds(sets)).toBe(105);
    });

    it('topWeight / bestE1RM / topDuration pick the maxima', () => {
        const sets = [
            set({ actual_weight_kg: 60, actual_reps: 8 }), // e1RM 76
            set({ actual_weight_kg: 65, actual_reps: 5 }), // e1RM 75.8
            set({ actual_duration_sec: 45 }),
        ];
        expect(topWeight(sets)).toBe(65);
        expect(bestE1RM(sets)).toBe(76);
        expect(topDuration(sets)).toBe(45);
    });
});

describe('formatDurationSec', () => {
    it('formats seconds, minutes and hours', () => {
        expect(formatDurationSec(45)).toBe('45s');
        expect(formatDurationSec(60)).toBe('1m');
        expect(formatDurationSec(90)).toBe('1m 30s');
        expect(formatDurationSec(3600)).toBe('1h');
        expect(formatDurationSec(3900)).toBe('1h 5m');
        expect(formatDurationSec(0)).toBe('0s');
        expect(formatDurationSec(null)).toBe('0s');
    });
});

describe('formatSetDisplay', () => {
    it('formats reps, failure marks, timed sets and bodyweight', () => {
        expect(formatSetDisplay(set({ actual_weight_kg: 60, actual_reps: 8 }))).toBe('60×8');
        expect(formatSetDisplay(set({ actual_weight_kg: 60, actual_reps: 6, is_failure: true }))).toBe('60×6 fail');
        expect(formatSetDisplay(set({ actual_duration_sec: 60 }))).toBe('1m');
        expect(formatSetDisplay(set({ actual_duration_sec: 45, actual_weight_kg: 20 }))).toBe('20kg 45s');
        expect(formatSetDisplay(set({ actual_reps: 12 }))).toBe('12 reps');
        expect(formatSetDisplay(set({}))).toBe('—');
        expect(formatSetDisplay(null)).toBe('—');
    });
});

describe('formatPlanTarget', () => {
    it('describes reps, failure and timed targets', () => {
        expect(formatPlanTarget({ target_sets: 4, rep_mode: 'reps', target_reps: 8, target_weight_kg: 60 })).toBe('4 × 8 reps @ 60kg');
        expect(formatPlanTarget({ target_sets: 3, rep_mode: 'failure', target_reps: null, target_weight_kg: null })).toBe('3 × to failure');
        expect(formatPlanTarget({ target_sets: 3, rep_mode: 'timed', target_duration_sec: 60, target_weight_kg: null })).toBe('3 × 1m');
        expect(formatPlanTarget({ target_sets: 3, rep_mode: 'timed', target_duration_sec: null, target_weight_kg: null })).toBe('3 × stopwatch');
    });
});

describe('modeLabel', () => {
    it('labels each rep mode', () => {
        expect(modeLabel('reps')).toBe('Reps');
        expect(modeLabel('failure')).toBe('To failure');
        expect(modeLabel('timed')).toBe('Timed');
    });
});

describe('resolvePrefillWeight', () => {
    it('prefers the plan target', () => {
        expect(resolvePrefillWeight(70, [set({ set_number: 1, actual_weight_kg: 50 })], 1)).toBe('70');
    });

    it('falls back to the same set from last session', () => {
        const prev = [
            set({ set_number: 1, actual_weight_kg: 60 }),
            set({ set_number: 2, actual_weight_kg: 62.5 }),
        ];
        expect(resolvePrefillWeight(null, prev, 2)).toBe('62.5');
    });

    it('falls back to the last logged weight, then empty', () => {
        const prev = [
            set({ set_number: 1, actual_weight_kg: 60 }),
            set({ set_number: 2, actual_weight_kg: null }),
        ];
        expect(resolvePrefillWeight(null, prev, 5)).toBe('60');
        expect(resolvePrefillWeight(null, [], 1)).toBe('');
        expect(resolvePrefillWeight(null, null, 1)).toBe('');
    });
});

describe('resolvePrefillReps', () => {
    it('prefills the target only in reps mode', () => {
        expect(resolvePrefillReps('reps', 8)).toBe('8');
        expect(resolvePrefillReps('failure', null)).toBe('');
        expect(resolvePrefillReps('timed', null)).toBe('');
    });
});

describe('validateSessionDate', () => {
    it('accepts today and past dates', () => {
        expect(validateSessionDate(todayLocalISO())).toBeNull();
        expect(validateSessionDate('2024-06-15')).toBeNull();
    });

    it('rejects future, malformed and ancient dates', () => {
        expect(validateSessionDate('2999-01-01')).toBe('Date cannot be in the future');
        expect(validateSessionDate('1999-12-31')).toBe('Date too far in the past');
        expect(validateSessionDate('nope')).toBe('Date must be YYYY-MM-DD');
        expect(validateSessionDate('2024-13-01')).toBe('Invalid date');
        expect(validateSessionDate('2024-02-31')).toBe('Invalid date');
        expect(validateSessionDate(undefined)).toBe('Date must be YYYY-MM-DD');
    });
});

describe('toLocalISODate', () => {
    it('zero-pads month and day', () => {
        expect(toLocalISODate(new Date(2024, 0, 5))).toBe('2024-01-05');
    });
});

describe('sanitizePlanItem', () => {
    it('normalizes a valid reps item', () => {
        const out = sanitizePlanItem({ exercise_id: 'abc', target_sets: 4, rep_mode: 'reps', target_reps: 8, target_weight_kg: 60 });
        expect(out).toEqual({
            exercise_id: 'abc', order: 0, target_sets: 4, rep_mode: 'reps',
            target_reps: 8, target_duration_sec: null, target_weight_kg: 60,
        });
    });

    it('clears reps for failure mode and allows null duration for timed', () => {
        const fail = sanitizePlanItem({ exercise_id: 'abc', target_sets: 3, rep_mode: 'failure', target_reps: 8 });
        expect(typeof fail === 'object' && fail.rep_mode).toBe('failure');
        expect(typeof fail === 'object' && fail.target_reps).toBeNull();

        const timed = sanitizePlanItem({ exercise_id: 'abc', target_sets: 3, rep_mode: 'timed', target_duration_sec: null });
        expect(typeof timed === 'object' && timed.target_duration_sec).toBeNull();

        const timedPlan = sanitizePlanItem({ exercise_id: 'abc', target_sets: 3, rep_mode: 'timed', target_duration_sec: 60 });
        expect(typeof timedPlan === 'object' && timedPlan.target_duration_sec).toBe(60);
    });

    it('rejects bad input', () => {
        expect(sanitizePlanItem(null)).toBe('Invalid plan item');
        expect(sanitizePlanItem({ target_sets: 3 })).toBe('Each item needs an exercise');
        expect(sanitizePlanItem({ exercise_id: 'a', target_sets: 0, rep_mode: 'reps', target_reps: 8 })).toBe('Sets must be between 1 and 30');
        expect(sanitizePlanItem({ exercise_id: 'a', target_sets: 3, rep_mode: 'reps', target_reps: 0 })).toBe('Reps must be between 1 and 200');
        expect(sanitizePlanItem({ exercise_id: 'a', target_sets: 3, rep_mode: 'timed', target_duration_sec: 1 })).toBe('Duration must be between 5s and 2h');
    });

    it('treats blank weight as null', () => {
        const out = sanitizePlanItem({ exercise_id: 'a', target_sets: 3, rep_mode: 'reps', target_reps: 8, target_weight_kg: '' });
        expect(typeof out === 'object' && out.target_weight_kg).toBeNull();
    });
});

describe('estimateSessionMET / estimateSessionKcal', () => {
    it('uses a moderate MET by default and bumps for heavy work', () => {
        expect(estimateSessionMET(0, 0)).toBe(5);
        expect(estimateSessionMET(60, 2000)).toBe(5);
        expect(estimateSessionMET(80, 0)).toBe(6);
        expect(estimateSessionMET(0, 5000)).toBe(6);
        expect(estimateSessionMET(120, 0)).toBe(7);
        expect(estimateSessionMET(0, 10000)).toBe(7);
    });

    it('estimates kcal from duration and body weight (MET × kg × hours)', () => {
        expect(estimateSessionKcal(60, 70)).toBe(350);        // 5 × 70 × 1h
        expect(estimateSessionKcal(30, 70)).toBe(175);        // half hour
        expect(estimateSessionKcal(60, 80, 100, 0)).toBe(480); // MET 6
        expect(estimateSessionKcal(60, 80, 130, 0)).toBe(560); // MET 7
    });

    it('falls back to 70kg and guards bad input', () => {
        expect(estimateSessionKcal(60, 0)).toBe(350);
        expect(estimateSessionKcal(0, 70)).toBe(0);
        expect(estimateSessionKcal(-10, 70)).toBe(0);
    });
});

describe('sanitizeWorkoutSettings', () => {
    it('accepts null rest and valid rest seconds', () => {
        expect(sanitizeWorkoutSettings({ rest_seconds: null })).toEqual({ rest_seconds: null, order_mode: 'sequential' });
        expect(sanitizeWorkoutSettings({ rest_seconds: 90 })).toEqual({ rest_seconds: 90, order_mode: 'sequential' });
        expect(sanitizeWorkoutSettings({ rest_seconds: '120' })).toEqual({ rest_seconds: 120, order_mode: 'sequential' });
    });

    it('rejects out-of-range rest and bad order modes', () => {
        expect(sanitizeWorkoutSettings({ rest_seconds: 99999 })).toBe('Rest must be between 0 and 1800 seconds');
        expect(sanitizeWorkoutSettings({ rest_seconds: -5 })).toBe('Rest must be between 0 and 1800 seconds');
        expect(sanitizeWorkoutSettings({ rest_seconds: 'abc' })).toBe('Rest must be between 0 and 1800 seconds');
        expect(sanitizeWorkoutSettings({ order_mode: 'nope' })).toBe('Invalid order mode');
    });

    it('validates circuit mode', () => {
        expect(sanitizeWorkoutSettings({ rest_seconds: null, order_mode: 'circuit' })).toEqual({ rest_seconds: null, order_mode: 'circuit' });
    });
});

describe('starter seed data', () => {
    it('has Push/Pull/Legs plans referencing known exercises', () => {
        const names = new Set(STARTER_EXERCISES.map(e => e.name));
        expect(STARTER_PLANS.map(p => p.name)).toEqual(['Push Day', 'Pull Day', 'Leg Day']);
        for (const plan of STARTER_PLANS) {
            expect(plan.items.length).toBeGreaterThan(0);
            for (const item of plan.items) {
                expect(names.has(item.exerciseName)).toBe(true);
            }
        }
    });

    it('includes a timed example (plank) and failure items', () => {
        const all = STARTER_PLANS.flatMap(p => p.items);
        expect(all.some(i => i.rep_mode === 'timed' && i.target_duration_sec === 60)).toBe(true);
        expect(all.some(i => i.rep_mode === 'failure')).toBe(true);
    });
});
