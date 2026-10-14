// Plans tab: list workout plans and edit them inline — per-exercise sets,
// rep mode (reps / to failure / timed), optional target weight, reorder,
// remove, plus quick-create of custom exercises.
import React, { useState } from 'react';
import { FiPlus, FiTrash2, FiChevronUp, FiChevronDown, FiEdit3, FiSave, FiX } from 'react-icons/fi';
import { Dumbbell } from 'lucide-react';
import { RepMode, modeLabel, formatPlanTarget, sanitizePlanItem } from '../../lib/gym';

interface PlanDoc { _id: string; name: string; description?: string; items: any[]; }
interface ExerciseDoc { _id: string; name: string; muscle_group?: string; is_custom?: boolean; }

interface DraftItem {
    exercise_id: string;
    target_sets: string;
    rep_mode: RepMode;
    target_reps: string;
    target_duration_sec: string;
    target_weight_kg: string;
}

interface Props {
    plans: PlanDoc[];
    exercises: ExerciseDoc[];
    busy?: boolean;
    onSavePlan: (payload: { id?: string; name: string; description: string; items: DraftItem[] }) => Promise<boolean>;
    onDeletePlan: (id: string) => Promise<void>;
    onCreateExercise: (name: string) => Promise<ExerciseDoc | null>;
}

function toDraftItems(items: any[]): DraftItem[] {
    return items.map(i => ({
        exercise_id: String(i.exercise_id),
        target_sets: String(i.target_sets ?? 3),
        rep_mode: (i.rep_mode || 'reps') as RepMode,
        target_reps: i.target_reps != null ? String(i.target_reps) : '',
        target_duration_sec: i.target_duration_sec != null ? String(i.target_duration_sec) : '',
        target_weight_kg: i.target_weight_kg != null ? String(i.target_weight_kg) : '',
    }));
}

export default function GymPlansView({ plans, exercises, busy, onSavePlan, onDeletePlan, onCreateExercise }: Props) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [draftDesc, setDraftDesc] = useState('');
    const [items, setItems] = useState<DraftItem[]>([]);
    const [newExName, setNewExName] = useState('');
    const [error, setError] = useState('');

    const startCreate = () => {
        setCreating(true); setEditingId(null);
        setDraftName(''); setDraftDesc('');
        setItems([{ exercise_id: exercises[0]?._id || '', target_sets: '3', rep_mode: 'reps', target_reps: '8', target_duration_sec: '', target_weight_kg: '' }]);
        setError('');
    };

    const startEdit = (plan: PlanDoc) => {
        setEditingId(plan._id); setCreating(false);
        setDraftName(plan.name); setDraftDesc(plan.description || '');
        setItems(toDraftItems(plan.items));
        setError('');
    };

    const closeEditor = () => { setEditingId(null); setCreating(false); setError(''); };

    const patchItem = (idx: number, patch: Partial<DraftItem>) =>
        setItems(list => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

    const moveItem = (idx: number, dir: -1 | 1) =>
        setItems(list => {
            const next = [...list];
            const j = idx + dir;
            if (j < 0 || j >= next.length) return list;
            [next[idx], next[j]] = [next[j], next[idx]];
            return next;
        });

    const removeItem = (idx: number) => setItems(list => list.filter((_, i) => i !== idx));

    const addItem = () => setItems(list => [...list, { exercise_id: exercises[0]?._id || '', target_sets: '3', rep_mode: 'reps', target_reps: '8', target_duration_sec: '', target_weight_kg: '' }]);

    const createExercise = async () => {
        const name = newExName.trim();
        if (!name) return;
        const doc = await onCreateExercise(name);
        if (doc) {
            setNewExName('');
            setItems(list => [...list, { exercise_id: doc._id, target_sets: '3', rep_mode: 'reps', target_reps: '8', target_duration_sec: '', target_weight_kg: '' }]);
        }
    };

    const save = async () => {
        setError('');
        if (!draftName.trim()) { setError('Plan name is required'); return; }
        if (!items.length) { setError('Add at least one exercise'); return; }
        const ok = await onSavePlan({ id: editingId || undefined, name: draftName.trim(), description: draftDesc, items });
        if (ok) closeEditor();
        else setError('Could not save plan — check the fields');
    };

    const previewTarget = (it: DraftItem) => {
        const item = sanitizePlanItem({
            exercise_id: it.exercise_id || 'x',
            target_sets: Number(it.target_sets) || 1,
            rep_mode: it.rep_mode,
            target_reps: it.target_reps !== '' ? Number(it.target_reps) : null,
            target_duration_sec: it.target_duration_sec !== '' ? Number(it.target_duration_sec) : null,
            target_weight_kg: it.target_weight_kg !== '' ? Number(it.target_weight_kg) : null,
        });
        return typeof item === 'string' ? item : formatPlanTarget(item);
    };

    const exName = (id: string) => exercises.find(e => e._id === id)?.name || '—';

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={startCreate} disabled={creating || busy} className="px-5 py-2.5 rounded-xl bg-olive text-primary-foreground text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40 hover:bg-olive/85 transition-colors">
                    <FiPlus size={14} /> New plan
                </button>
            </div>

            {/* Editor */}
            {(creating || editingId) && (
                <div className="bg-card border border-olive/30 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-olive">{editingId ? 'Edit plan' : 'New plan'}</h3>
                        <button onClick={closeEditor} className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground"><FiX size={16} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="Plan name (e.g. Push Day)" className="bg-input border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-foreground" />
                        <input value={draftDesc} onChange={e => setDraftDesc(e.target.value)} placeholder="Short description" className="md:col-span-2 bg-input border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-foreground" />
                    </div>

                    <div className="space-y-2">
                        {items.map((it, idx) => (
                            <div key={idx} className="grid grid-cols-2 md:grid-cols-[2fr_repeat(4,70px)_auto] gap-2 items-center bg-foreground/[0.03] border border-border rounded-xl p-2.5">
                                <select value={it.exercise_id} onChange={e => patchItem(idx, { exercise_id: e.target.value })} className="col-span-2 md:col-span-1 bg-input border border-border rounded-lg px-3 py-2 text-sm font-bold text-foreground min-w-0">
                                    {exercises.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                                    {!it.exercise_id && <option value="">— pick —</option>}
                                </select>
                                <input type="number" min={1} max={30} value={it.target_sets} onChange={e => patchItem(idx, { target_sets: e.target.value })} title="Sets" className="bg-input border border-border rounded-lg px-2 py-2 text-sm font-bold text-foreground" />
                                <select value={it.rep_mode} onChange={e => patchItem(idx, { rep_mode: e.target.value as RepMode })} className="bg-input border border-border rounded-lg px-2 py-2 text-xs font-bold text-foreground">
                                    <option value="reps">Reps</option>
                                    <option value="failure">Fail</option>
                                    <option value="timed">Timed</option>
                                </select>
                                {it.rep_mode === 'reps' ? (
                                    <input type="number" min={1} value={it.target_reps} onChange={e => patchItem(idx, { target_reps: e.target.value })} title="Reps" className="bg-input border border-border rounded-lg px-2 py-2 text-sm font-bold text-foreground" />
                                ) : it.rep_mode === 'timed' ? (
                                    <input type="number" min={5} value={it.target_duration_sec} onChange={e => patchItem(idx, { target_duration_sec: e.target.value })} title="Secs (blank = stopwatch)" placeholder="secs" className="bg-input border border-border rounded-lg px-2 py-2 text-sm font-bold text-foreground" />
                                ) : (
                                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-center">AMRAP</div>
                                )}
                                <input type="number" min={0} step="0.5" value={it.target_weight_kg} onChange={e => patchItem(idx, { target_weight_kg: e.target.value })} title="Weight kg (optional)" placeholder="kg" className="bg-input border border-border rounded-lg px-2 py-2 text-sm font-bold text-foreground" />
                                <div className="flex items-center gap-0.5 justify-end">
                                    <button onClick={() => moveItem(idx, -1)} className="p-1.5 text-muted-foreground hover:text-foreground"><FiChevronUp size={14} /></button>
                                    <button onClick={() => moveItem(idx, 1)} className="p-1.5 text-muted-foreground hover:text-foreground"><FiChevronDown size={14} /></button>
                                    <button onClick={() => removeItem(idx)} className="p-1.5 text-muted-foreground hover:text-berry"><FiTrash2 size={14} /></button>
                                </div>
                                <div className="col-span-2 md:col-span-6 text-[10px] font-black uppercase tracking-widest text-olive/80 pl-1">{previewTarget(it)}</div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={addItem} className="px-4 py-2 rounded-xl bg-foreground/5 text-muted-foreground text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-foreground/10"><FiPlus size={13} /> Add exercise</button>
                        <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
                            <input value={newExName} onChange={e => setNewExName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createExercise(); }} placeholder="+ New custom exercise" className="flex-1 bg-input border border-border rounded-xl px-3 py-2 text-sm font-bold text-foreground" />
                            <button onClick={createExercise} disabled={!newExName.trim()} className="p-2 rounded-xl bg-foreground/5 text-muted-foreground disabled:opacity-40 hover:bg-foreground/10"><FiPlus size={14} /></button>
                        </div>
                    </div>

                    {error && <p className="text-[11px] font-bold text-berry">{error}</p>}
                    <button onClick={save} disabled={busy} className="w-full md:w-auto px-8 py-3 rounded-xl bg-olive text-primary-foreground text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 disabled:opacity-40 hover:bg-olive/85 transition-all">
                        <FiSave size={15} /> Save plan
                    </button>
                </div>
            )}

            {/* Plan list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map(plan => (
                    <div key={plan._id} className="bg-card border border-border rounded-3xl p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                                <h3 className="text-base font-black text-foreground flex items-center gap-2"><Dumbbell size={15} className="text-olive" /> {plan.name}</h3>
                                {plan.description && <p className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">{plan.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => startEdit(plan)} className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground" title="Edit"><FiEdit3 size={14} /></button>
                                <button
                                    onClick={() => { if (confirm(`Delete "${plan.name}"? Past sessions are kept.`)) onDeletePlan(plan._id); }}
                                    className="p-2 rounded-xl bg-foreground/5 hover:bg-berry/10 text-muted-foreground hover:text-berry" title="Delete"
                                ><FiTrash2 size={14} /></button>
                            </div>
                        </div>
                        <ul className="space-y-1">
                            {plan.items.map((it, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs">
                                    <span className="font-bold text-foreground truncate flex-1">{exName(String(it.exercise_id))}</span>
                                    <span className="text-muted-foreground font-bold tabular-nums shrink-0">{formatPlanTarget(it)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}
