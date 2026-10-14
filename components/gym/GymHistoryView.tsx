// History tab: completed sessions grouped by month; click through to the
// session detail (planned vs achieved + editable date).
import React, { useMemo } from 'react';
import { FiChevronRight, FiCalendar } from 'react-icons/fi';
import { useRouter } from 'next/router';
import { totalVolume, totalTimedSeconds, formatDurationSec } from '../../lib/gym';

interface SessionDoc {
    _id: string;
    plan_name_snapshot?: string;
    date: string;
    status: string;
    exercises: any[];
    started_at?: string;
    completed_at?: string | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function sessionTotals(s: SessionDoc) {
    const sets = (s.exercises || []).flatMap(e => e.sets || []);
    const vol = totalVolume(sets);
    const timed = totalTimedSeconds(sets);
    const minutes = s.started_at && s.completed_at
        ? Math.max(1, Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000))
        : null;
    return { vol, timed, minutes };
}

export default function GymHistoryView({ sessions }: { sessions: SessionDoc[] }) {
    const router = useRouter();

    const completed = useMemo(() => sessions.filter(s => s.status === 'completed'), [sessions]);

    const grouped = useMemo(() => {
        const map = new Map<string, SessionDoc[]>();
        for (const s of completed) {
            const [y, m] = s.date.split('-');
            const key = `${MONTHS[Number(m) - 1]} ${y}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(s);
        }
        return Array.from(map.entries());
    }, [completed]);

    if (!completed.length) {
        return (
            <div className="bg-card border border-border rounded-3xl p-10 text-center">
                <FiCalendar size={28} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-bold text-foreground">No completed workouts yet</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Finished sessions will appear here</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {grouped.map(([monthKey, list]) => (
                <div key={monthKey}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{monthKey}</h3>
                    <div className="space-y-1.5">
                        {list.map(s => {
                            const { vol, timed, minutes } = sessionTotals(s);
                            return (
                                <button
                                    key={s._id}
                                    onClick={() => router.push(`/gym/history/${s._id}`)}
                                    className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 hover:border-olive/40 transition-colors text-left"
                                >
                                    <div className="w-14 shrink-0">
                                        <div className="text-lg font-black text-foreground leading-none">{s.date.split('-')[2]}</div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{MONTHS[Number(s.date.split('-')[1]) - 1]?.slice(0, 3)}</div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-black text-foreground truncate">{s.plan_name_snapshot || 'Quick workout'}</div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                                            <span>{s.exercises.length} exercises</span>
                                            {vol > 0 && <span className="text-olive">{vol.toLocaleString()} kg vol</span>}
                                            {timed > 0 && <span className="text-water">{formatDurationSec(timed)} timed</span>}
                                            {minutes != null && <span>{minutes} min</span>}
                                        </div>
                                    </div>
                                    <FiChevronRight size={16} className="text-muted-foreground shrink-0" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
