'use client';

import { FiCheckCircle } from 'react-icons/fi';
import { usePlanner } from './PlannerContext';

/**
 * Period planning progress: mains coverage is the primary bar (placed meals
 * plus pool items both count — an Average Meal counts as a main) with a check
 * once every day of the period is covered. Lunch / breakfast are shown as
 * minimal counts because they are optional, low-prep extras.
 */
export default function PlanProgress({ compact = false }: { compact?: boolean }) {
    const { planProgress } = usePlanner();
    const done = planProgress.mains >= planProgress.mainTarget;
    const pct = Math.min(100, Math.round((planProgress.mains / Math.max(1, planProgress.mainTarget)) * 100));

    const bar = (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-emerald-400' : 'bg-blue-400/80'}`}
                    style={{ width: `${done ? 100 : Math.max(pct, 4)}%` }}
                />
            </div>
            <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest ${done ? 'text-emerald-400' : 'text-blue-300'}`}>
                {done ? <span className="inline-flex items-center gap-1"><FiCheckCircle size={12} /> Done</span> : `${planProgress.mains}/${planProgress.mainTarget}`}
            </span>
        </div>
    );

    const extras = (
        <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-muted-foreground">
                Lunch · {planProgress.lunches}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-muted-foreground">
                Brekkie · {planProgress.breakfasts}
            </span>
        </div>
    );

    if (compact) {
        return (
            <div className="mb-2 -mx-2 px-2">
                {bar}
                <div className="mt-1.5">{extras}</div>
            </div>
        );
    }

    return (
        <div className="glass-card p-3 mb-3">
            <p className={`text-[11px] font-black uppercase tracking-widest mb-2 ${done ? 'text-emerald-400' : 'text-amber-300'}`}>
                {done ? 'Mains sorted — nice week' : 'Pick what you want to eat for the week — cover the mains first'}
            </p>
            {bar}
            <div className="mt-2">{extras}</div>
        </div>
    );
}
