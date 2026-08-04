import React, { useState, useEffect, useMemo } from 'react';
import { FiActivity, FiAlertTriangle, FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

const PERIODS = [
    { value: '7', label: '7 Days', days: 7 },
    { value: '30', label: '30 Days', days: 30 },
    { value: '90', label: '90 Days', days: 90 },
    { value: 'all', label: 'All Time', days: null as number | null },
];

const CATEGORY_STYLES: Record<string, { label: string; cls: string }> = {
    positive: { label: 'Positive', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    negative: { label: 'Negative', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    neutral: { label: 'Neutral', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    none: { label: 'Unclassified', cls: 'bg-white/5 text-muted-foreground border-white/10' },
};

interface CorrelationEntry {
    exposureKey: string;
    label: string;
    type: string;
    lag: number;
    pct: number;
    baseRate: number;
    lift: number;
    diff: number;
    support: number;
    exposedObserved: number;
}

interface SymptomCorrelations {
    name: string;
    category: string;
    occurrences: number;
    baseRate: number;
    top: CorrelationEntry | null;
    moreLikely: CorrelationEntry[];
    lessLikely: CorrelationEntry[];
}

interface ApiResult {
    success: boolean;
    meta: { daysAnalyzed: number; observedDays: number; exposureCount: number; symptomCount: number };
    symptoms: SymptomCorrelations[];
}

function getLocalDateString(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const lagLabel = (lag: number) => (lag === 1 ? 'next day' : 'same day');

export default function CorrelationInsightsView({ endDateProp }: { endDateProp?: Date }) {
    const [period, setPeriod] = useState<string>('30');
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [data, setData] = useState<ApiResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        if (endDateProp) setEndDate(endDateProp);
    }, [endDateProp]);

    const startDate = useMemo(() => {
        const p = PERIODS.find(x => x.value === period);
        if (!p || p.days === null) return null;
        const d = new Date(endDate);
        d.setDate(d.getDate() - (p.days - 1));
        return d;
    }, [endDate, period]);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            setLoading(true);
            const token = localStorage.getItem('Token');
            if (!token) { setLoading(false); return; }
            try {
                const isAll = period === 'all';
                const params = isAll
                    ? 'all=true'
                    : `startDate=${getLocalDateString(startDate!)}&endDate=${getLocalDateString(endDate)}`;
                const res = await fetch(`/api/insights/correlations?${params}`, { headers: { edgetoken: token } });
                const json = await res.json();
                if (!cancelled && json.success) setData(json);
            } catch (e) {
                console.error('Failed to load correlations', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchData();
        return () => { cancelled = true; };
    }, [period, startDate, endDate]);

    const enoughData = (data?.meta?.observedDays ?? 0) >= 4;

    const renderEntry = (e: CorrelationEntry, kind: 'more' | 'less') => (
        <div key={`${e.exposureKey}-${e.lag}`} className={`p-3 rounded-xl border ${kind === 'more' ? 'bg-white/[0.03] border-white/5' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                    {kind === 'more' ? <FiTrendingUp size={12} className="text-rose-400 shrink-0" /> : <FiTrendingDown size={12} className="text-emerald-400 shrink-0" />}
                    <span className="text-[11px] font-black capitalize truncate">{e.label}</span>
                </div>
                <span className={`text-sm font-black shrink-0 ${kind === 'more' ? 'text-rose-300' : 'text-emerald-300'}`}>{e.pct}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${kind === 'more' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(e.pct, 100)}%` }} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>vs {e.baseRate}% baseline</span>
                <span>{e.lift.toFixed(1)}x</span>
                <span>{e.support} of {e.exposedObserved} days</span>
                <span>{lagLabel(e.lag)}</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Period selector */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-white/5 shadow-inner">
                    {PERIODS.map(p => (
                        <button
                            key={p.value}
                            onClick={() => setPeriod(p.value)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${period === p.value ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {period !== 'all' && (
                    <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-0.5 border border-white/5">
                        <button onClick={() => setEndDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground"><FiChevronLeft size={14} /></button>
                        <div className="px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{startDate?.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - {endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</div>
                        <button onClick={() => setEndDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground"><FiChevronRight size={14} /></button>
                    </div>
                )}
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                    {loading ? 'Analyzing...' : `${data?.meta?.observedDays ?? 0} observed days`}
                </div>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <FiAlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed text-amber-200/70 font-medium">
                    These are <span className="font-black text-amber-300">statistical correlations only</span> from your own logged history — not causation and not medical advice. Patterns may be coincidence, and change as you log more.
                </p>
            </div>

            {loading ? (
                <div className="py-16 text-center animate-pulse text-emerald-500 font-black uppercase tracking-widest text-sm">
                    Detecting Patterns...
                </div>
            ) : !data ? (
                <div className="py-16 text-center text-muted-foreground text-sm">Failed to load correlations.</div>
            ) : !enoughData ? (
                <div className="py-16 text-center glass-card border-white/5">
                    <FiActivity size={40} className="mx-auto text-emerald-500 mb-4 opacity-50" />
                    <h3 className="text-xl font-black text-emerald-400 mb-2">Not Enough History Yet</h3>
                    <p className="text-sm text-muted-foreground">Log your food and symptoms for at least a few days and these patterns will appear automatically.</p>
                </div>
            ) : data.symptoms.length === 0 ? (
                <div className="py-16 text-center glass-card border-white/5">
                    <FiActivity size={40} className="mx-auto text-emerald-500 mb-4 opacity-50" />
                    <h3 className="text-xl font-black text-emerald-400 mb-2">No Strong Patterns Found</h3>
                    <p className="text-sm text-muted-foreground">No food/symptom correlations passed the minimum confidence thresholds for this period.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.symptoms.map(s => {
                        const cat = CATEGORY_STYLES[s.category] || CATEGORY_STYLES.none;
                        const isOpen = expanded === s.name;
                        return (
                            <div key={s.name} className={`glass-card relative overflow-hidden transition-all duration-300 ${isOpen ? 'ring-2 ring-emerald-500/40' : 'hover:bg-white/[0.04]'}`}>
                                <button onClick={() => setExpanded(isOpen ? null : s.name)} className="w-full text-left">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-lg font-black capitalize truncate">{s.name}</h3>
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${cat.cls}`}>{cat.label}</span>
                                            </div>
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Occurs {s.occurrences} day{s.occurrences !== 1 ? 's' : ''} · {s.baseRate}% baseline</div>
                                        </div>
                                        {isOpen ? <FiChevronUp className="shrink-0 text-muted-foreground" /> : <FiChevronDown className="shrink-0 text-muted-foreground" />}
                                    </div>
                                </button>

                                {s.top && (
                                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                        <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Top correlation</div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="text-[11px] font-black capitalize truncate">{s.top.label}</div>
                                                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                                                    vs {s.top.baseRate}% baseline · {s.top.lift.toFixed(1)}x · {s.top.support} of {s.top.exposedObserved} days · {lagLabel(s.top.lag)}
                                                </div>
                                            </div>
                                            <div className={`text-xl font-black shrink-0 ${s.top.lift >= 1 ? 'text-rose-300' : 'text-emerald-300'}`}>{s.top.pct}%</div>
                                        </div>
                                    </div>
                                )}

                                {isOpen && (
                                    <div className="mt-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
                                        {s.moreLikely.length > 0 && (
                                            <div>
                                                <div className="text-[9px] font-black uppercase tracking-widest text-rose-400 mb-2">More likely after</div>
                                                <div className="space-y-2">{s.moreLikely.map(e => renderEntry(e, 'more'))}</div>
                                            </div>
                                        )}
                                        {s.lessLikely.length > 0 && (
                                            <div>
                                                <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-2">Less likely after</div>
                                                <div className="space-y-2">{s.lessLikely.map(e => renderEntry(e, 'less'))}</div>
                                            </div>
                                        )}
                                        {s.moreLikely.length === 0 && s.lessLikely.length === 0 && (
                                            <p className="text-[10px] text-muted-foreground">No other correlations passed the confidence thresholds.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
