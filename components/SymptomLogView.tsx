import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiSave, FiX, FiPlus, FiCheck, FiGrid } from 'react-icons/fi';

const MOOD_LABELS = [
    { range: '1-2', label: 'Terrible', color: 'rose' },
    { range: '3-4', label: 'Rough', color: 'orange' },
    { range: '5-6', label: 'Okay', color: 'yellow' },
    { range: '7-8', label: 'Good', color: 'lime' },
    { range: '9-10', label: 'Great', color: 'emerald' },
];

export default function SymptomLogView({ date }: { date: string }) {
    const [log, setLog] = useState<any>(null);
    const [mood, setMood] = useState<number | undefined>(undefined);
    const [symptoms, setSymptoms] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Search state
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchVal, setSearchVal] = useState('');
    const [suggestions, setSuggestions] = useState<{ label: string; value: string }[]>([]);
    const [topSymptoms, setTopSymptoms] = useState<string[]>([]);
    const [browseOpen, setBrowseOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const optionSelected = useRef(false);
    const fetchIdRef = useRef(0);

    // Load top/preset symptoms for quick pick
    const fetchTopSymptoms = useCallback(async () => {
        const token = localStorage.getItem('Token');
        if (!token) return;
        try {
            const res = await fetch('/api/symptomLog/symptoms', { headers: { edgetoken: token } });
            const data = await res.json();
            if (data.success) setTopSymptoms(data.symptoms.map((s: any) => s.value));
        } catch (err) { /* ignore */ }
    }, []);

    useEffect(() => { fetchTopSymptoms(); }, [fetchTopSymptoms]);

    const fetchLog = useCallback(async () => {
        const token = localStorage.getItem('Token');
        if (!token) return;
        const fetchId = ++fetchIdRef.current;
        setLog(null);
        setMood(undefined);
        setSymptoms([]);
        setNotes('');
        setLoading(true);
        try {
            const res = await fetch(`/api/symptomLog?date=${date}`, { headers: { edgetoken: token } });
            const data = await res.json();
            if (fetchId !== fetchIdRef.current) return;
            if (data.success) {
                setLog(data.log);
                setMood(data.log.mood);
                setSymptoms((data.log.symptoms || []).map((s: any) => s.name));
                setNotes(data.log.notes || '');
            }
        } catch (err) {
            console.error("Failed to load symptom log", err);
        } finally {
            if (fetchId === fetchIdRef.current) setLoading(false);
        }
    }, [date]);

    useEffect(() => { fetchLog(); }, [fetchLog]);

    // Debounced symptom search
    useEffect(() => {
        if (!searchVal.trim()) { setSuggestions([]); return; }
        const timer = setTimeout(async () => {
            const token = localStorage.getItem('Token');
            if (!token) return;
            try {
                const res = await fetch(`/api/symptomLog/symptoms?search=${encodeURIComponent(searchVal.trim())}`, { headers: { edgetoken: token } });
                const data = await res.json();
                if (data.success) setSuggestions(data.symptoms);
            } catch (err) { /* ignore */ }
        }, 200);
        return () => clearTimeout(timer);
    }, [searchVal]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const addSymptom = (name: string) => {
        const trimmed = name.trim().toLowerCase();
        if (!trimmed || symptoms.includes(trimmed)) return;
        setSymptoms(prev => [...prev, trimmed]);
        setSearchVal('');
        setSearchOpen(false);
        setSuggestions([]);
        inputRef.current?.focus();
    };

    const removeSymptom = (name: string) => {
        setSymptoms(prev => prev.filter(s => s !== name));
    };

    const handleSearchKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSymptom(searchVal);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const token = localStorage.getItem('Token');
        if (!token) return;
        try {
            const res = await fetch('/api/symptomLog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({
                    date,
                    mood,
                    symptoms: symptoms.map(name => ({ name })),
                    notes
                })
            });
            const data = await res.json();
            if (data.success) {
                setLog(data.log);
                fetchTopSymptoms();
            }
        } catch (err) {
            console.error("Save failed", err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
            {/* Mood Selector */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-xl">
                <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    How do you feel? (1-10)
                </h3>
                <div className="flex flex-col items-center gap-6">
                    <div className="flex gap-1.5 md:gap-2 w-full justify-center">
                        {[1,2,3,4,5,6,7,8,9,10].map(n => {
                            const selected = mood === n;
                            let cls = 'bg-white/[0.02] border-white/5 text-muted-foreground hover:border-white/20 hover:text-white';
                            if (selected) {
                                if (n <= 2) cls = 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/20';
                                else if (n <= 4) cls = 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/20';
                                else if (n <= 6) cls = 'bg-yellow-500/20 border-yellow-500 text-yellow-400 shadow-lg shadow-yellow-500/20';
                                else if (n <= 8) cls = 'bg-lime-500/20 border-lime-500 text-lime-400 shadow-lg shadow-lime-500/20';
                                else cls = 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20';
                            }
                            return (
                                <button
                                    key={n}
                                    onClick={() => setMood(selected ? undefined : n)}
                                    className={`w-full aspect-square rounded-xl md:rounded-2xl font-black text-lg md:text-xl transition-all active:scale-90 ${cls} border-2`}
                                >
                                    {n}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex justify-between w-full max-w-md text-[9px] font-black uppercase tracking-widest text-muted-foreground px-1">
                        {MOOD_LABELS.map(m => (
                            <span key={m.range}>{m.range} {m.label}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Symptoms */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-xl">
                <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Symptoms
                </h3>

                <div ref={searchRef} className="relative mb-4">
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchVal}
                            onChange={e => { setSearchVal(e.target.value); setSearchOpen(true); }}
                            onFocus={() => setSearchOpen(true)}
                            onKeyDown={handleSearchKey}
                            placeholder="Search or type a symptom..."
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500/50 outline-none"
                            autoComplete="off"
                        />
                        <button
                            onClick={() => addSymptom(searchVal)}
                            disabled={!searchVal.trim()}
                            className="px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2 font-black uppercase tracking-widest text-[10px]"
                        >
                            <FiPlus size={18} /> Add
                        </button>
                    </div>

                    {searchOpen && suggestions.length > 0 && (
                        <ul className="absolute top-full left-0 right-0 z-50 mt-2 max-h-56 overflow-y-auto bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl shadow-black/80 p-2 space-y-0.5">
                            {suggestions.map(s => (
                                <li
                                    key={s.value}
                                    onMouseDown={() => { optionSelected.current = true; addSymptom(s.value); }}
                                    className="px-4 py-2.5 text-sm font-medium text-zinc-300 rounded-xl cursor-pointer hover:bg-emerald-500/10 hover:text-emerald-400 hover:pl-5 transition-all"
                                >
                                    {s.label}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Top symptoms quick-pick */}
                {topSymptoms.length > 0 && (
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Previously Used</span>
                            <span className="text-[9px] font-bold text-muted-foreground/50">({topSymptoms.length})</span>
                        </div>
                        <button
                            onClick={() => setBrowseOpen(true)}
                            className="flex-none inline-flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all active:scale-95 min-h-[36px]"
                        >
                            <FiGrid size={14} /> Browse
                        </button>
                    </div>
                )}

                {/* Symptom badges */}
                {symptoms.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {symptoms.map(s => (
                            <span
                                key={s}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-bold text-emerald-400"
                            >
                                {s}
                                <button onClick={() => removeSymptom(s)} className="hover:text-rose-400 transition-colors">
                                    <FiX size={14} />
                                </button>
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider py-2">
                        No symptoms logged yet. Type above to add one.
                    </p>
                )}
            </div>

            {/* Notes */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-xl">
                <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    What was different today?
                </h3>
                <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Didn't sleep well, stressed at work, had a rest day..."
                    rows={4}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/50 outline-none resize-none placeholder:text-muted-foreground/50"
                />
            </div>

            {/* Save */}
            <div className="flex justify-end pt-2">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full md:w-auto min-w-[200px] h-14 bg-emerald-500 text-black font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/30 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                >
                    {saving ? (
                        'Saving...'
                    ) : (
                        <><FiSave size={20} /> Save Symptom Log</>
                    )}
                </button>
            </div>

            {/* Browse modal */}
            {browseOpen && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-8">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setBrowseOpen(false)} />
                    <div className="relative bg-background border-t md:border border-white/10 rounded-t-[2rem] md:rounded-[2.5rem] shadow-2xl w-full md:max-w-xl max-h-[90vh] md:max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom duration-300 md:animate-in md:fade-in md:zoom-in-95">
                        {/* Header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/5 bg-background/95 backdrop-blur-md">
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><FiGrid className="text-emerald-500" /> Browse Symptoms</h2>
                                <p className="text-[9px] font-bold text-muted-foreground mt-0.5">Tap to toggle — added ones are checked</p>
                            </div>
                            <button onClick={() => setBrowseOpen(false)} className="p-2.5 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"><FiX size={22} /></button>
                        </div>

                        {/* List — already-used ones sorted to the end */}
                        <div className="overflow-y-auto max-h-[calc(90vh-80px)] md:max-h-[calc(80vh-80px)] p-4 pb-10">
                            {(() => {
                                const added = symptoms.map(s => s.toLowerCase());
                                const sorted = [...topSymptoms].sort((a, b) => {
                                    const aAdded = added.includes(a.toLowerCase()) ? 1 : 0;
                                    const bAdded = added.includes(b.toLowerCase()) ? 1 : 0;
                                    return aAdded - bAdded;
                                });
                                return sorted.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {sorted.map(name => {
                                            const isAdded = added.includes(name.toLowerCase());
                                            return (
                                                <button
                                                    key={name}
                                                    onClick={() => isAdded ? removeSymptom(name) : addSymptom(name)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                                                        isAdded
                                                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                            : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400'
                                                    }`}
                                                >
                                                    {isAdded ? <FiCheck size={14} /> : <FiPlus size={14} />}
                                                    <span className="capitalize">{name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-center py-12 text-muted-foreground text-sm">No symptoms yet. Add some and they'll appear here.</p>
                                );
                            })()}
                        </div>

                        {/* Done button for mobile */}
                        <div className="sticky bottom-0 p-4 bg-background/95 backdrop-blur-md border-t border-white/5 md:hidden">
                            <button onClick={() => setBrowseOpen(false)} className="w-full h-12 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                                <FiCheck size={18} /> Done ({symptoms.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
