import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useAdminGuard } from '../../lib/useAdminGuard'
import { FiSave, FiSearch, FiTag } from 'react-icons/fi'

const CATEGORIES = [
    { value: 'positive', label: 'Positive', color: 'text-emerald-400' },
    { value: 'negative', label: 'Negative', color: 'text-rose-400' },
    { value: 'neutral', label: 'Neutral', color: 'text-amber-400' },
    { value: 'none', label: 'Nothing', color: 'text-muted-foreground' },
];

interface SymptomRow {
    name: string;
    category: string;
}

export default function SymptomCategories() {
    const isAuthorized = useAdminGuard();
    const [rows, setRows] = useState<SymptomRow[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSymptoms = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('Token');
        try {
            const res = await fetch('/api/admin/symptoms', { headers: { 'edgetoken': token || '' } });
            const data = await res.json();
            if (data.success) setRows(data.symptoms || []);
            else alert(data.message || 'Failed to load symptoms');
        } catch (e: any) {
            alert('Load failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (isAuthorized) fetchSymptoms(); }, [isAuthorized, fetchSymptoms]);

    const setCategory = (name: string, category: string) => {
        setRows(prev => prev.map(r => r.name === name ? { ...r, category } : r));
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(r => r.name.toLowerCase().includes(q));
    }, [rows, search]);

    const stats = useMemo(() => {
        const counts: Record<string, number> = {};
        rows.forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1; });
        return counts;
    }, [rows]);

    const handleSave = async () => {
        setSaving(true);
        const token = localStorage.getItem('Token');
        try {
            const res = await fetch('/api/admin/symptoms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({ symptoms: rows.map(r => ({ name: r.name, category: r.category })) })
            });
            const data = await res.json();
            if (data.success) alert(`Saved ${data.modifiedCount} updated, ${data.upsertedCount} created`);
            else alert(data.message || 'Save failed');
        } catch (e: any) {
            alert('Save failed: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isAuthorized) return null;

    return (
        <Layout title="Symptom Categories" description="Assign positive/negative/neutral to logged symptoms">
            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                <PageHeader title="Symptom Categories" />

                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Symptoms</div>
                        <div className="text-2xl font-black">{rows.length}</div>
                    </div>
                    {CATEGORIES.map(c => (
                        <div key={c.value} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{c.label}</div>
                            <div className={`text-2xl font-black ${c.color}`}>{stats[c.value] || 0}</div>
                        </div>
                    ))}
                </div>

                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search symptoms..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500/50 outline-none"
                        />
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving || rows.length === 0}
                        className="inline-flex items-center justify-center gap-2 px-6 h-12 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
                    >
                        <FiSave size={18} /> {saving ? 'Saving...' : 'Save All'}
                    </button>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><FiTag size={12} /> Sentiment</span>
                    {CATEGORIES.map(c => (
                        <span key={c.value} className={`inline-flex items-center gap-1.5 ${c.color}`}>
                            <span className="w-2 h-2 rounded-full bg-current opacity-60" /> {c.label}
                        </span>
                    ))}
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading...</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-xl">
                        <div className="divide-y divide-white/5">
                            {filtered.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground text-sm">
                                    {rows.length === 0 ? 'No symptoms found yet. They appear once logged by any user.' : 'No symptoms match your search.'}
                                </div>
                            ) : filtered.map(row => (
                                <div key={row.name} className="flex items-center justify-between gap-3 px-4 md:px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm capitalize truncate">{row.name}</div>
                                        <div className="text-[9px] text-muted-foreground/60 font-black uppercase tracking-widest">Loggable symptom</div>
                                    </div>
                                    <select
                                        value={row.category}
                                        onChange={e => setCategory(row.name, e.target.value)}
                                        className="shrink-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer min-h-[40px]"
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c.value} value={c.value} className="text-foreground">{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}