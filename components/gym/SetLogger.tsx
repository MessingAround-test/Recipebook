// Current-exercise card for the session runner: planned target, last time,
// logged sets and the per-set input (reps / failure / timed). The parent page
// owns session state; this component only collects the set payload.
import React, { useState, useEffect } from 'react';
import { FiCheck, FiChevronLeft, FiChevronRight, FiFlag, FiEdit2, FiTrash2, FiTarget } from 'react-icons/fi';
import { SessionExerciseT, LoggedSetT, formatPlanTarget, formatSetDisplay, formatDurationSec, resolvePrefillWeight, resolvePrefillReps, RepMode } from '../../lib/gym';
import LastTimePanel from './LastTimePanel';
import SetTimer from './SetTimer';

interface Props {
    exercise: SessionExerciseT;
    exerciseIndex: number;
    totalExercises: number;
    busy?: boolean;
    onLogSet: (payload: Partial<LoggedSetT>) => Promise<void>;
    onRemoveSet: (setNumber: number) => Promise<void>;
    onUpdateTarget: (patch: { target_sets?: number; rep_mode?: RepMode; target_reps?: number | null; target_duration_sec?: number | null; target_weight_kg?: number | null }) => Promise<void>;
    onPrev: () => void;
    onNext: () => void;
    onFinish: () => void;
    onOpenHistory: () => void;
}

export default function SetLogger({ exercise, exerciseIndex, totalExercises, busy, onLogSet, onRemoveSet, onUpdateTarget, onPrev, onNext, onFinish, onOpenHistory }: Props) {
    const nextSetNumber = Math.min(
        exercise.sets.length ? Math.max(...exercise.sets.map(s => s.set_number)) + 1 : 1,
        exercise.target_sets
    );
    const allSetsDone = exercise.sets.length >= exercise.target_sets;

    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [failed, setFailed] = useState(exercise.rep_mode === 'failure');
    const [editTarget, setEditTarget] = useState(false);
    const [draft, setDraft] = useState({
        target_sets: exercise.target_sets,
        rep_mode: exercise.rep_mode,
        target_reps: exercise.target_reps != null ? String(exercise.target_reps) : '',
        target_duration_sec: exercise.target_duration_sec != null ? String(exercise.target_duration_sec) : '',
        target_weight_kg: exercise.target_weight_kg != null ? String(exercise.target_weight_kg) : '',
    });

    // Prefill when the set number changes (uses plan target → last session).
    useEffect(() => {
        setWeight(resolvePrefillWeight(exercise.target_weight_kg, exercise.previous_sets, nextSetNumber));
        setReps(resolvePrefillReps(exercise.rep_mode, exercise.target_reps));
        setFailed(exercise.rep_mode === 'failure');
    }, [exercise.exercise_id, nextSetNumber, exercise.rep_mode, exercise.target_weight_kg, exercise.target_reps]); // eslint-disable-line react-hooks/exhaustive-deps

    const submitRepsSet = async () => {
        const w = weight !== '' ? Number(weight) : null;
        const r = reps !== '' ? Number(reps) : null;
        if (exercise.rep_mode === 'reps' && (!r || r < 1)) return;
        if (exercise.rep_mode === 'failure' && (!r || r < 1)) return;
        await onLogSet({
            set_number: nextSetNumber,
            actual_reps: r,
            actual_weight_kg: w && w > 0 ? w : null,
            is_failure: exercise.rep_mode === 'failure' ? true : failed,
            planned_reps: exercise.target_reps,
            planned_weight_kg: exercise.target_weight_kg,
            planned_duration_sec: null,
        });
    };

    const submitTimedSet = async (elapsedSec: number) => {
        const w = weight !== '' ? Number(weight) : null;
        await onLogSet({
            set_number: nextSetNumber,
            actual_duration_sec: Math.max(1, Math.round(elapsedSec)),
            actual_weight_kg: w && w > 0 ? w : null,
            is_failure: false,
            planned_reps: null,
            planned_weight_kg: exercise.target_weight_kg,
            planned_duration_sec: exercise.target_duration_sec,
        });
    };

    const saveTarget = async () => {
        const patch: any = {
            target_sets: Math.max(1, Math.min(30, Number(draft.target_sets) || exercise.target_sets)),
            rep_mode: draft.rep_mode,
            target_reps: draft.rep_mode === 'reps' ? (draft.target_reps !== '' ? Number(draft.target_reps) : null) : null,
            target_duration_sec: draft.rep_mode === 'timed' ? (draft.target_duration_sec !== '' ? Number(draft.target_duration_sec) : null) : null,
            target_weight_kg: draft.target_weight_kg !== '' && Number(draft.target_weight_kg) > 0 ? Number(draft.target_weight_kg) : null,
        };
        await onUpdateTarget(patch);
        setEditTarget(false);
    };

    const sortedSets = [...exercise.sets].sort((a, b) => a.set_number - b.set_number);

    return (
        <div className="bg-card border border-border rounded-3xl p-5 md:p-7 shadow-sm space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-widest text-olive mb-1">
                        Exercise {exerciseIndex + 1} of {totalExercises}
                    </div>
                    <h2 className="text-xl md:text-2xl font-black text-foreground truncate">{exercise.name_snapshot}</h2>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-olive/10 text-olive text-[9px] font-black uppercase tracking-widest">{formatPlanTarget(exercise)}</span>
                        {exercise.muscle_group && (
                            <span className="px-2 py-0.5 rounded-md bg-foreground/5 text-muted-foreground text-[9px] font-black uppercase tracking-widest">{exercise.muscle_group}</span>
                        )}
                        <button onClick={() => setEditTarget(e => !e)} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                            <FiEdit2 size={11} /> Target
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={onPrev} disabled={exerciseIndex === 0} className="p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 disabled:opacity-30 text-muted-foreground transition-colors"><FiChevronLeft size={18} /></button>
                    <button onClick={onNext} disabled={exerciseIndex >= totalExercises - 1} className="p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 disabled:opacity-30 text-muted-foreground transition-colors"><FiChevronRight size={18} /></button>
                </div>
            </div>

            {/* Inline target editor */}
            {editTarget && (
                <div className="bg-foreground/[0.03] border border-border rounded-2xl p-4 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Sets</label>
                            <input type="number" min={1} max={30} value={draft.target_sets} onChange={e => setDraft(d => ({ ...d, target_sets: Number(e.target.value) }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm font-bold text-foreground" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mode</label>
                            <select value={draft.rep_mode} onChange={e => setDraft(d => ({ ...d, rep_mode: e.target.value as RepMode }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm font-bold text-foreground">
                                <option value="reps">Reps</option>
                                <option value="failure">To failure</option>
                                <option value="timed">Timed</option>
                            </select>
                        </div>
                        {draft.rep_mode === 'reps' && (
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Reps</label>
                                <input type="number" min={1} value={draft.target_reps} onChange={e => setDraft(d => ({ ...d, target_reps: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm font-bold text-foreground" />
                            </div>
                        )}
                        {draft.rep_mode === 'timed' && (
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Secs (blank = stopwatch)</label>
                                <input type="number" min={5} value={draft.target_duration_sec} onChange={e => setDraft(d => ({ ...d, target_duration_sec: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm font-bold text-foreground" placeholder="stopwatch" />
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Weight kg (opt.)</label>
                            <input type="number" min={0} step="0.5" value={draft.target_weight_kg} onChange={e => setDraft(d => ({ ...d, target_weight_kg: e.target.value }))} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm font-bold text-foreground" placeholder="—" />
                        </div>
                        <div className="flex items-end">
                            <button onClick={saveTarget} disabled={busy} className="w-full px-3 py-2 rounded-lg bg-olive text-primary-foreground text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Save target</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Last time */}
            <LastTimePanel sets={exercise.previous_sets} date={(exercise as any).previous_date} onOpenHistory={onOpenHistory} />

            {/* Logged sets */}
            {sortedSets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {sortedSets.map(s => (
                        <button
                            key={s.set_number}
                            onClick={() => !busy && onRemoveSet(s.set_number)}
                            title="Remove this set"
                            className="group px-2.5 py-1 rounded-lg bg-olive/10 text-foreground text-xs font-bold tabular-nums flex items-center gap-1.5 hover:bg-berry/15 transition-colors"
                        >
                            <span className="text-[9px] text-muted-foreground font-black">S{s.set_number}</span>
                            {formatSetDisplay(s)}
                            <FiTrash2 size={10} className="opacity-0 group-hover:opacity-100 text-berry transition-opacity" />
                        </button>
                    ))}
                </div>
            )}

            {/* Set input */}
            {!allSetsDone ? (
                exercise.rep_mode === 'timed' ? (
                    <div className="space-y-3">
                        <SetTimer plannedSec={exercise.target_duration_sec} onLog={submitTimedSet} busy={busy} />
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1 max-w-[200px]">
                                <input type="number" step="0.5" min={0} value={weight} onChange={e => setWeight(e.target.value)} placeholder="Weight (opt.)" className="w-full bg-input border border-border rounded-xl px-4 py-3 text-lg font-black text-foreground pr-10" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">kg</span>
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Set {nextSetNumber} of {exercise.target_sets}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Set {nextSetNumber} of {exercise.target_sets}
                            {exercise.rep_mode === 'failure' && <span className="text-butter ml-2">— hit failure</span>}
                        </div>
                        <div className="flex items-end gap-3 flex-wrap">
                            <div className="relative">
                                <input type="number" step="0.5" min={0} value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" className="w-28 bg-input border border-border rounded-xl px-4 py-3 text-lg font-black text-foreground pr-10" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">kg</span>
                            </div>
                            <span className="text-lg font-black text-muted-foreground pb-2">×</span>
                            <div className="relative">
                                <input
                                    type="number" min={1} value={reps}
                                    onChange={e => { setReps(e.target.value); if (exercise.rep_mode === 'failure') setFailed(true); }}
                                    placeholder={exercise.rep_mode === 'failure' ? 'AMRAP' : '—'}
                                    className="w-28 bg-input border border-border rounded-xl px-4 py-3 text-lg font-black text-foreground"
                                />
                            </div>
                            {exercise.rep_mode === 'reps' && (
                                <button
                                    onClick={() => setFailed(f => !f)}
                                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border transition-colors ${failed ? 'bg-butter/15 border-butter/40 text-butter' : 'bg-foreground/5 border-border text-muted-foreground'}`}
                                >
                                    <FiFlag size={13} /> Failed
                                </button>
                            )}
                            <button
                                onClick={submitRepsSet}
                                disabled={busy || (exercise.rep_mode !== 'failure' && (!reps || Number(reps) < 1))}
                                className="flex-1 min-w-[140px] px-6 py-3 rounded-xl bg-olive text-primary-foreground text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-olive/85 transition-all active:scale-95"
                            >
                                <FiCheck size={16} /> Log set
                            </button>
                        </div>
                    </div>
                )
            ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap bg-olive/[0.06] border border-olive/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-olive">
                        <FiTarget size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            All {exercise.target_sets} sets done — {exercise.sets.length} logged
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onFinish} className="px-5 py-2.5 rounded-xl bg-olive text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:bg-olive/85 transition-colors">
                            Finish workout
                        </button>
                        <button onClick={onNext} disabled={exerciseIndex >= totalExercises - 1} className="px-5 py-2.5 rounded-xl bg-foreground/5 text-muted-foreground text-[10px] font-black uppercase tracking-widest disabled:opacity-30 hover:bg-foreground/10 transition-colors flex items-center gap-1.5">
                            Next <FiChevronRight size={13} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
