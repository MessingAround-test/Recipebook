import { useEffect, useState } from 'react';
import { FiX, FiCalendar } from 'react-icons/fi';
import DayNutrientCoverage from './planner/DayNutrientCoverage';
import { formatShortDate } from '../lib/dateUtils';

interface PlanDayCoverageModalProps {
    open: boolean;
    onClose: () => void;
    plan: any;
    day: string;
    initialData?: any;
}

export default function PlanDayCoverageModal({ open, onClose, plan, day, initialData }: PlanDayCoverageModalProps) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(initialData || null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open || !plan || !day) return;
        let cancelled = false;
        // Use cached data for the first paint, then still refresh on open.
        if (initialData) {
            setData(initialData);
        }
        setError('');
        setLoading(true);
        const token = localStorage.getItem('Token');
        fetch('/api/weeklyPlan/dayCoverage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', edgetoken: token || '' },
            body: JSON.stringify({ plan, day })
        })
            .then(r => r.json())
            .then(d => {
                if (cancelled) return;
                if (d.success) setData(d);
                else setError(d.message || 'Failed to load');
            })
            .catch(() => { if (!cancelled) setError('Failed to load'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, plan, day, initialData]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-black tracking-widest uppercase flex items-center gap-2">
                        <FiCalendar className="text-emerald-400" /> Estimated Intake
                        <span className="text-sm font-bold text-muted-foreground normal-case tracking-normal">{formatShortDate(day)}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-white transition-colors">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-5">
                    {loading && !data ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Estimating intake…</p>
                        </div>
                    ) : error && !data ? (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-bold">
                            {error}
                        </div>
                    ) : data ? (
                        <>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                What today would cover if you ate everything planned.
                            </p>
                            <DayNutrientCoverage coverage={data.dayCoverage || []} />
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
