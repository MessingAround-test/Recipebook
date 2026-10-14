// "Last time" strip shown above the set logger during a workout: the sets from
// the most recent prior session of the same exercise, so you know what to beat.
import React from 'react';
import { FiClock } from 'react-icons/fi';
import { LoggedSetT, formatSetDisplay } from '../../lib/gym';

interface Props {
    sets: LoggedSetT[] | null | undefined;
    date: string | null | undefined;
    onOpenHistory?: () => void;
}

export default function LastTimePanel({ sets, date, onOpenHistory }: Props) {
    const done = (sets || []).filter(s => (s.actual_reps || s.actual_duration_sec));
    if (!done.length) {
        return (
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                <FiClock size={13} /> No previous record — set the baseline
            </div>
        );
    }
    return (
        <button
            onClick={onOpenHistory}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-foreground/[0.04] border border-border hover:border-olive/40 transition-all text-left group"
            title="View full history for this exercise"
        >
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground shrink-0">Last time{date ? ` (${date})` : ''}:</span>
            <span className="flex-1 flex flex-wrap gap-1.5">
                {done.map((s, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded-md bg-foreground/5 text-[11px] font-bold tabular-nums ${s.is_failure ? 'text-butter' : 'text-foreground'}`}>
                        {formatSetDisplay(s)}
                    </span>
                ))}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-olive opacity-0 group-hover:opacity-100 transition-opacity shrink-0">History →</span>
        </button>
    );
}
