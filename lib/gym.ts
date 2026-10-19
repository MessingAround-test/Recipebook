// Pure helpers for the gym / weight-training feature: e1RM maths, set
// formatting, prefill resolution, session totals, date validation and the
// per-user starter seed (Push / Pull / Legs). Client and server safe.

export type RepMode = 'reps' | 'failure' | 'timed';

export interface PlanItemT {
    exercise_id: string;
    order: number;
    target_sets: number;
    rep_mode: RepMode;
    target_reps: number | null;
    target_duration_sec: number | null;
    target_weight_kg: number | null;
}

export interface LoggedSetT {
    set_number: number;
    planned_reps: number | null;
    planned_weight_kg: number | null;
    planned_duration_sec: number | null;
    actual_reps: number | null;
    actual_weight_kg: number | null;
    actual_duration_sec: number | null;
    is_failure: boolean;
    completed_at: string | null;
}

export interface SessionExerciseT {
    exercise_id: string;
    name_snapshot: string;
    muscle_group?: string;
    order: number;
    target_sets: number;
    rep_mode: RepMode;
    target_reps: number | null;
    target_duration_sec: number | null;
    target_weight_kg: number | null;
    sets: LoggedSetT[];
    /** Server-hydrated: sets from the most recent prior completed session. */
    previous_sets?: LoggedSetT[] | null;
}

// ── Maths ────────────────────────────────────────────────────────────────────

/** Epley estimate of 1-rep max. A single rep is its own e1RM. */
export function estimateE1RM(weightKg: number, reps: number): number {
    const w = Number(weightKg) || 0;
    const r = Number(reps) || 0;
    if (w <= 0 || r <= 0) return 0;
    if (r <= 1) return w;
    return Math.round(w * (1 + r / 30) * 10) / 10;
}

/** Tonnage of a single set: weight × reps for rep work; 0 for timed bodyweight work. */
export function setVolume(weightKg: number | null | undefined, reps: number | null | undefined): number {
    const w = Number(weightKg) || 0;
    const r = Number(reps) || 0;
    if (w <= 0 || r <= 0) return 0;
    return w * r;
}

/** Total tonnage of a set of logged sets (rep-based work only). */
export function totalVolume(sets: LoggedSetT[] | undefined | null): number {
    if (!sets || !sets.length) return 0;
    return Math.round(sets.reduce((sum, s) => sum + setVolume(s.actual_weight_kg, s.actual_reps), 0));
}

/** Total timed seconds across logged sets. */
export function totalTimedSeconds(sets: LoggedSetT[] | undefined | null): number {
    if (!sets || !sets.length) return 0;
    return sets.reduce((sum, s) => sum + (Number(s.actual_duration_sec) || 0), 0);
}

/** Heaviest successfully logged weight in a set of sets. */
export function topWeight(sets: LoggedSetT[] | undefined | null): number {
    if (!sets || !sets.length) return 0;
    return Math.max(0, ...sets.map(s => Number(s.actual_weight_kg) || 0));
}

/** Best e1RM across a set of logged sets. */
export function bestE1RM(sets: LoggedSetT[] | undefined | null): number {
    if (!sets || !sets.length) return 0;
    return Math.max(0, ...sets.map(s => estimateE1RM(Number(s.actual_weight_kg) || 0, Number(s.actual_reps) || 0)));
}

/** Longest timed set in a set of logged sets. */
export function topDuration(sets: LoggedSetT[] | undefined | null): number {
    if (!sets || !sets.length) return 0;
    return Math.max(0, ...sets.map(s => Number(s.actual_duration_sec) || 0));
}

// ── Calories ─────────────────────────────────────────────────────────────────

/**
 * Rough MET for a weight-training session. Intentionally vague — based on how
 * heavy the work was (top single weight and total tonnage), not per-exercise
 * MET tables. Bodyweight / timed work stays at the moderate base.
 */
export function estimateSessionMET(topWeightKg: number, totalVolumeKg: number): number {
    const w = Number(topWeightKg) || 0;
    const v = Number(totalVolumeKg) || 0;
    if (w >= 120 || v >= 10000) return 7;
    if (w >= 80 || v >= 5000) return 6;
    return 5;
}

/**
 * Estimated calories for a completed session: MET × body weight × wall-clock
 * hours. A vague estimate — good enough to roll into daily exercise kcal.
 */
export function estimateSessionKcal(
    durationMinutes: number,
    bodyWeightKg: number,
    topWeightKg: number = 0,
    totalVolumeKg: number = 0
): number {
    const hours = (Number(durationMinutes) || 0) / 60;
    const weight = Number(bodyWeightKg) || 70;
    if (hours <= 0 || weight <= 0) return 0;
    return Math.round(estimateSessionMET(topWeightKg, totalVolumeKg) * weight * hours);
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** 45 → "45s", 90 → "1m 30s", 3600 → "1h". */
export function formatDurationSec(sec: number | null | undefined): string {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    if (s < 60) return `${s}s`;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins < 60) return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

/** "60×8", "60×8 fail", "45s", "60×AMRAP". */
export function formatSetDisplay(set: Partial<LoggedSetT> | null | undefined): string {
    if (!set) return '—';
    const w = set.actual_weight_kg != null ? Number(set.actual_weight_kg) : null;
    if (set.actual_duration_sec != null && Number(set.actual_duration_sec) > 0) {
        const base = `${formatDurationSec(set.actual_duration_sec)}`;
        return w != null && w > 0 ? `${w}kg ${base}` : base;
    }
    if (set.actual_reps != null && Number(set.actual_reps) > 0) {
        const base = w != null && w > 0 ? `${w}×${set.actual_reps}` : `${set.actual_reps} reps`;
        return set.is_failure ? `${base} fail` : base;
    }
    return '—';
}

/** Short description of a plan target, e.g. "4 × 8 @ 60kg", "4 × to failure", "3 × 60s @ 20kg". */
export function formatPlanTarget(item: {
    target_sets: number;
    rep_mode: RepMode;
    target_reps?: number | null;
    target_duration_sec?: number | null;
    target_weight_kg?: number | null;
}): string {
    const sets = Number(item.target_sets) || 0;
    let mid: string;
    if (item.rep_mode === 'timed') {
        mid = item.target_duration_sec ? formatDurationSec(item.target_duration_sec) : 'stopwatch';
    } else if (item.rep_mode === 'failure') {
        mid = 'to failure';
    } else {
        mid = item.target_reps ? `${item.target_reps} reps` : 'reps';
    }
    const w = item.target_weight_kg != null && Number(item.target_weight_kg) > 0 ? ` @ ${item.target_weight_kg}kg` : '';
    return `${sets} × ${mid}${w}`;
}

/** Human label for a rep mode chip. */
export function modeLabel(mode: RepMode): string {
    if (mode === 'failure') return 'To failure';
    if (mode === 'timed') return 'Timed';
    return 'Reps';
}

// ── Prefill ──────────────────────────────────────────────────────────────────

/**
 * Weight to prefill in the logger for a given set:
 * plan target → same set_number from last session → last logged set weight → empty.
 */
export function resolvePrefillWeight(
    planTargetKg: number | null | undefined,
    previousSets: LoggedSetT[] | null | undefined,
    setNumber: number
): string {
    if (planTargetKg != null && Number(planTargetKg) > 0) return String(planTargetKg);
    if (previousSets && previousSets.length) {
        const sameSet = previousSets.find(s => s.set_number === setNumber && s.actual_weight_kg != null && Number(s.actual_weight_kg) > 0);
        if (sameSet) return String(sameSet.actual_weight_kg);
        for (let i = previousSets.length - 1; i >= 0; i--) {
            const w = previousSets[i].actual_weight_kg;
            if (w != null && Number(w) > 0) return String(w);
        }
    }
    return '';
}

/** Reps to prefill: planned target for 'reps' mode, otherwise blank. */
export function resolvePrefillReps(repMode: RepMode, targetReps: number | null | undefined): string {
    if (repMode === 'reps' && targetReps != null && Number(targetReps) > 0) return String(targetReps);
    return '';
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** Local YYYY-MM-DD for a date (never UTC-shifted). */
export function toLocalISODate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function todayLocalISO(): string {
    return toLocalISODate(new Date());
}

/** Returns an error message for invalid session dates, or null when valid. */
export function validateSessionDate(date: any): string | null {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Date must be YYYY-MM-DD';
    const [y, m, d] = date.split('-').map(Number);
    const parsed = new Date(y, m - 1, d);
    if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return 'Invalid date';
    if (date > todayLocalISO()) return 'Date cannot be in the future';
    if (date < '2000-01-01') return 'Date too far in the past';
    return null;
}

// ── Starter seed (per-user, Push / Pull / Legs) ──────────────────────────────

export interface StarterExercise {
    name: string;
    muscle_group: string;
}

export const STARTER_EXERCISES: StarterExercise[] = [
    { name: 'Barbell Bench Press', muscle_group: 'chest' },
    { name: 'Overhead Press', muscle_group: 'shoulders' },
    { name: 'Incline Dumbbell Press', muscle_group: 'chest' },
    { name: 'Triceps Pushdown', muscle_group: 'triceps' },
    { name: 'Lateral Raise', muscle_group: 'shoulders' },
    { name: 'Plank', muscle_group: 'core' },
    { name: 'Barbell Row', muscle_group: 'back' },
    { name: 'Pull-up', muscle_group: 'back' },
    { name: 'Lat Pulldown', muscle_group: 'back' },
    { name: 'Face Pull', muscle_group: 'rear delts' },
    { name: 'Barbell Curl', muscle_group: 'biceps' },
    { name: 'Squat', muscle_group: 'legs' },
    { name: 'Romanian Deadlift', muscle_group: 'legs' },
    { name: 'Leg Press', muscle_group: 'legs' },
    { name: 'Walking Lunge', muscle_group: 'legs' },
    { name: 'Calf Raise', muscle_group: 'calves' },
];

export interface StarterPlanItem {
    exerciseName: string;
    target_sets: number;
    rep_mode: RepMode;
    target_reps: number | null;
    target_duration_sec: number | null;
    target_weight_kg: number | null;
}

export interface StarterPlan {
    name: string;
    description: string;
    items: StarterPlanItem[];
}

const ip = (exerciseName: string, target_sets: number, target_reps: number, target_weight_kg: number | null = null): StarterPlanItem => ({
    exerciseName, target_sets, rep_mode: 'reps', target_reps, target_duration_sec: null, target_weight_kg
});
const ifl = (exerciseName: string, target_sets: number, target_weight_kg: number | null = null): StarterPlanItem => ({
    exerciseName, target_sets, rep_mode: 'failure', target_reps: null, target_duration_sec: null, target_weight_kg
});
const it = (exerciseName: string, target_sets: number, target_duration_sec: number | null): StarterPlanItem => ({
    exerciseName, target_sets, rep_mode: 'timed', target_reps: null, target_duration_sec, target_weight_kg: null
});

export const STARTER_PLANS: StarterPlan[] = [
    {
        name: 'Push Day',
        description: 'Chest, shoulders & triceps',
        items: [
            ip('Barbell Bench Press', 4, 8),
            ip('Overhead Press', 3, 10),
            ip('Incline Dumbbell Press', 3, 10),
            ifl('Triceps Pushdown', 3),
            ifl('Lateral Raise', 3),
            it('Plank', 3, 60),
        ],
    },
    {
        name: 'Pull Day',
        description: 'Back, rear delts & biceps',
        items: [
            ip('Barbell Row', 4, 8),
            ifl('Pull-up', 3),
            ip('Lat Pulldown', 3, 12),
            ip('Face Pull', 3, 15),
            ifl('Barbell Curl', 3),
        ],
    },
    {
        name: 'Leg Day',
        description: 'Quads, hamstrings, glutes & calves',
        items: [
            ip('Squat', 4, 6),
            ip('Romanian Deadlift', 3, 10),
            ip('Leg Press', 3, 12),
            ifl('Walking Lunge', 3),
            ip('Calf Raise', 4, 15),
        ],
    },
];

// ── Validation for plan items (shared client/server) ────────────────────────

/** Normalize + validate one incoming plan item. Returns normalized item or error string. */
export function sanitizePlanItem(raw: any): PlanItemT | string {
    if (!raw || typeof raw !== 'object') return 'Invalid plan item';
    if (!raw.exercise_id || typeof raw.exercise_id !== 'string') return 'Each item needs an exercise';
    const rep_mode: RepMode = raw.rep_mode === 'failure' || raw.rep_mode === 'timed' ? raw.rep_mode : 'reps';
    const target_sets = Math.floor(Number(raw.target_sets));
    if (!target_sets || target_sets < 1 || target_sets > 30) return 'Sets must be between 1 and 30';

    let target_reps: number | null = null;
    let target_duration_sec: number | null = null;
    if (rep_mode === 'reps') {
        target_reps = Math.floor(Number(raw.target_reps));
        if (!target_reps || target_reps < 1 || target_reps > 200) return 'Reps must be between 1 and 200';
    } else if (rep_mode === 'timed') {
        if (raw.target_duration_sec != null && raw.target_duration_sec !== '') {
            target_duration_sec = Math.floor(Number(raw.target_duration_sec));
            if (!target_duration_sec || target_duration_sec < 5 || target_duration_sec > 7200) return 'Duration must be between 5s and 2h';
        }
        // null duration = free stopwatch
    }

    let target_weight_kg: number | null = null;
    if (raw.target_weight_kg != null && raw.target_weight_kg !== '' && Number(raw.target_weight_kg) > 0) {
        target_weight_kg = Math.round(Number(raw.target_weight_kg) * 10) / 10;
        if (target_weight_kg > 1000) return 'Weight looks too high';
    }

    return {
        exercise_id: raw.exercise_id,
        order: Math.floor(Number(raw.order)) || 0,
        target_sets,
        rep_mode,
        target_reps,
        target_duration_sec,
        target_weight_kg,
    };
}

// ── Session settings (break timer + running order) ───────────────────────────

export type OrderMode = 'sequential' | 'circuit';

/**
 * Normalize the per-workout settings: rest_seconds (null = break timer off,
 * 0–1800s otherwise) and order_mode ('sequential' | 'circuit'). Returns the
 * normalized object or an error string.
 */
export function sanitizeWorkoutSettings(raw: any): { rest_seconds: number | null; order_mode: OrderMode } | string {
    const input = raw && typeof raw === 'object' ? raw : {};

    let rest_seconds: number | null = null;
    if (input.rest_seconds != null && input.rest_seconds !== '') {
        const n = Number(input.rest_seconds);
        if (!Number.isFinite(n) || n < 0 || n > 1800) return 'Rest must be between 0 and 1800 seconds';
        rest_seconds = Math.round(n);
    }

    let order_mode: OrderMode = 'sequential';
    if (input.order_mode != null && input.order_mode !== '') {
        if (input.order_mode !== 'sequential' && input.order_mode !== 'circuit') return 'Invalid order mode';
        order_mode = input.order_mode;
    }

    return { rest_seconds, order_mode };
}
