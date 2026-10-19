// Multi-select exercise picker for Quick Start. Modal overlay with search,
// checkboxes, workout options (break timer / order) and confirms via onStart
// with the chosen ids + settings (order preserved).
import React, { useState, useMemo, useEffect } from 'react';
import { FiX, FiSearch, FiPlay, FiPlus } from 'react-icons/fi';
import WorkoutOptions, { WorkoutSettings } from './WorkoutOptions';

interface ExerciseDoc {
    _id: string;
    name: string;
    muscle_group?: string;
    is_custom?: boolean;
}

interface Props {
    open: boolean;
    exercises: ExerciseDoc[];
    date: string;
    busy?: boolean;
    onClose: () => void;
    onCreateExercise: (name: string) => Promise<ExerciseDoc | null>;
    onStart: (exerciseIds: string[], settings: WorkoutSettings) => void;
}

export default function ExercisePicker({ open, exercises, date, busy, onClose, onCreateExercise, onStart }: Props) {
    const [selected, setSelected] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [settings, setSettings] = useState<WorkoutSettings>({ rest_seconds: null, order_mode: 'sequential' });

    useEffect(() => {
        if (open) {
            setSelected([]); setQuery(''); setNewName('');
            setSettings({ rest_seconds: null, order_mode: 'sequential' });
        }
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return exercises.filter(e => !q || e.name.toLowerCase().includes(q) || (e.muscle_group || '').toLowerCase().includes(q));
    }, [exercises, query]);

    const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

    const create = async () => {
        const name = newName.trim();
        if (!name) return;
        setCreating(true);
        const doc = await onCreateExercise(name);
        setCreating(false);
        if (doc) {
            setNewName('');
            setSelected(s => [...s, doc._id]);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full md:max-w-lg bg-card border border-border rounded-t-3xl md:rounded-3xl p-5 md:p-6 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Quick Start</h3>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Pick exercises · logging for {date}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground"><FiX size={18} /></button>
                </div>

                <div className="relative mb-3">
                    <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={query} onChange={e => setQuery(e.target.value)}
                        placeholder="Search exercises..."
                        className="w-full bg-input border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-foreground"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
                    {filtered.map(e => (
                        <button
                            key={e._id} onClick={() => toggle(e._id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selected.includes(e._id) ? 'bg-olive/15 border border-olive/40' : 'bg-foreground/[0.03] border border-transparent hover:bg-foreground/[0.06]'}`}
                        >
                            <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${selected.includes(e._id) ? 'bg-olive border-olive text-primary-foreground' : 'border-border'}`}>
                                {selected.includes(e._id) && '✓'}
                            </span>
                            <span className="flex-1 text-sm font-bold text-foreground">{e.name}</span>
                            {e.muscle_group && <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{e.muscle_group}</span>}
                        </button>
                    ))}
                    {!filtered.length && <p className="text-center text-sm text-muted-foreground py-6">No exercises match</p>}
                </div>

                <div className="mt-3 flex items-center gap-2">
                    <input
                        value={newName} onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') create(); }}
                        placeholder="+ Create custom exercise"
                        className="flex-1 bg-input border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-foreground"
                    />
                    <button onClick={create} disabled={creating || !newName.trim()} className="p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground disabled:opacity-40"><FiPlus size={16} /></button>
                </div>

                <div className="mt-3">
                    <WorkoutOptions settings={settings} onChange={setSettings} />
                </div>

                <button
                    onClick={() => onStart(selected, settings)}
                    disabled={busy || !selected.length}
                    className="mt-4 w-full py-3.5 rounded-xl bg-olive text-primary-foreground text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-olive/85 transition-all active:scale-95"
                >
                    <FiPlay size={15} /> Start workout ({selected.length})
                </button>
            </div>
        </div>
    );
}
