// Dependent-timer propagation: scheduled ends, per-session shifts and the
// wave plan that keeps waits aligned when a timer completes, restarts or
// is extended (field report: waits must follow their dependency live).
import {
    scheduledEndOf, scheduleDelta, shiftSession, collectShiftTargets, planShiftWave
} from '../lib/timerPropagation';

const T = 1700000000000;
const MIN = 60000;

describe('scheduledEndOf', () => {
    it('reads endTime for running sessions and completedAt for finished ones', () => {
        expect(scheduledEndOf({ endTime: T, remaining: 60, status: 'active' })).toBe(T);
        expect(scheduledEndOf({ endTime: T, remaining: -5, status: 'overdue' })).toBe(T);
        expect(scheduledEndOf({ endTime: null, remaining: 0, status: 'completed', completedAt: T })).toBe(T);
    });

    it('returns null when the session carries no fixed end', () => {
        expect(scheduledEndOf({ endTime: null, remaining: 42, status: 'paused' })).toBeNull();
        expect(scheduledEndOf({ endTime: null, remaining: 42, status: 'pending' })).toBeNull();
        expect(scheduledEndOf({ endTime: null, remaining: 0, status: 'completed' })).toBeNull();
        expect(scheduledEndOf(null)).toBeNull();
        expect(scheduledEndOf(undefined)).toBeNull();
    });
});

describe('scheduleDelta', () => {
    it('is signed: positive when the plan moved later, negative when earlier', () => {
        expect(scheduleDelta(T, T + 5 * MIN)).toBe(5 * MIN);
        expect(scheduleDelta(T, T - 5 * MIN)).toBe(-5 * MIN);
        expect(scheduleDelta(T, T)).toBe(0);
    });

    it('is 0 when either anchor is missing', () => {
        expect(scheduleDelta(null, T)).toBe(0);
        expect(scheduleDelta(T, null)).toBe(0);
        expect(scheduleDelta(undefined, undefined)).toBe(0);
    });
});

describe('shiftSession', () => {
    it('slides running sessions by the delta', () => {
        const out = shiftSession({ endTime: T, remaining: 60, status: 'active' }, 3 * MIN, T);
        expect(out.endTime).toBe(T + 3 * MIN);
        expect(out.status).toBe('active');
    });

    it('leaves a during-phase that already fired where it rang', () => {
        const fired = { endTime: T - 1000, remaining: 0, status: 'overdue', during: true };
        expect(shiftSession(fired, 3 * MIN, T)).toBe(fired);
    });

    it('still shifts a during-phase that has not fired yet', () => {
        const out = shiftSession({ endTime: T + 60000, remaining: 60, status: 'active', during: true }, 3 * MIN, T);
        expect(out.endTime).toBe(T + 60000 + 3 * MIN);
    });

    it('adjusts a paused session\u2019s remaining and never goes negative', () => {
        expect(shiftSession({ endTime: null, remaining: 60, status: 'paused' }, 30000, T).remaining).toBe(90);
        expect(shiftSession({ endTime: null, remaining: 60, status: 'paused' }, -30 * MIN, T).remaining).toBe(0);
    });

    it('leaves completed and pending sessions untouched', () => {
        const done = { endTime: null, remaining: 0, status: 'completed', completedAt: T };
        expect(shiftSession(done, 3 * MIN, T)).toBe(done);
        const pending = { endTime: null, remaining: 60, status: 'pending' };
        expect(shiftSession(pending, 3 * MIN, T)).toBe(pending);
    });

    it('is a no-op for a zero delta', () => {
        const s = { endTime: T, remaining: 60, status: 'active' };
        expect(shiftSession(s, 0, T)).toBe(s);
    });
});

describe('planShiftWave', () => {
    const timers = [
        { id: 'sear', stepIndex: 0, dependencies: [{ timerId: 'start', offset: 0 }] },
        { id: 'rest', stepIndex: 1, dependencies: [{ timerId: 'sear', offset: 5 }] },
        { id: 'gravy', stepIndex: 2, dependencies: [{ timerId: 'rest', offset: 0 }] },
        { id: 'unrelated', stepIndex: 2, dependencies: [{ timerId: 'start', offset: 0 }] },
        { id: 'carb-wait', carb: true, stepIndex: 1, dependencies: [] }
    ];
    const phases = (stepIndex: number) => (stepIndex === 1 ? [{ timerId: 'side-into-1' }] : []);

    it('carries one delta down the dependency chain and adds during phases', () => {
        const plan = planShiftWave('sear', 5 * MIN, timers, phases);
        expect(plan.map(p => p.id).sort()).toEqual(['gravy', 'rest', 'side-into-1']);
        expect(plan.every(p => p.deltaMs === 5 * MIN)).toBe(true);
    });

    it('includes a visited child\u2019s own during phases', () => {
        // side-into-1 belongs to step 1, which only appears via 'rest'.
        const plan = planShiftWave('sear', MIN, timers, phases);
        expect(plan.find(p => p.id === 'side-into-1')).toBeTruthy();
    });

    it('skips a carb timer\u2019s during phases but still shifts its dependents', () => {
        const withCarb = [
            ...timers,
            { id: 'carb-main', carb: true, stepIndex: 1, dependencies: [] },
            { id: 'waits-for-carb', stepIndex: 2, dependencies: [{ timerId: 'carb-main', offset: 0 }] }
        ];
        const plan = planShiftWave('carb-main', MIN, withCarb, phases);
        expect(plan.map(p => p.id)).toEqual(['waits-for-carb']);
    });

    it('never returns the source and tolerates dependency cycles', () => {
        const cyclic = [
            { id: 'a', stepIndex: 0, dependencies: [{ timerId: 'b', offset: 0 }] },
            { id: 'b', stepIndex: 0, dependencies: [{ timerId: 'a', offset: 0 }] }
        ];
        const plan = planShiftWave('a', 1000, cyclic, () => []);
        expect(plan.map(p => p.id)).toEqual(['b']);
        expect(collectShiftTargets('a', cyclic, () => [])).toEqual(['b']);
    });

    it('returns nothing for a zero delta or an unknown source', () => {
        expect(planShiftWave('sear', 0, timers, phases)).toEqual([]);
        expect(planShiftWave('ghost', MIN, timers, phases)).toEqual([]);
    });
});
