import { useRef } from 'react';
import { usePlanner } from '../planner/PlannerContext';
import { formatShortDate } from '../../lib/dateUtils';
import WeekTimeline from './WeekTimeline';

export default function DayGrid() {
    const { dates } = usePlanner();
    const dayRefs = useRef({} as Record<string, HTMLDivElement | null>);

    const scrollToDay = (date: string) => {
        dayRefs.current[date]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    };

    return (
        <div className="min-w-0">
            {/* Day jump chips */}
            <div className="sticky top-0 z-30 mb-4 -mx-2 px-2 py-2 bg-background/90 backdrop-blur-md border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
                {dates.map((d) => (
                    <button
                        key={d}
                        onClick={() => scrollToDay(d)}
                        className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-300 border border-white/10 text-muted-foreground transition-colors"
                    >
                        {formatShortDate(d)}
                    </button>
                ))}
            </div>

            <WeekTimeline dayRefs={dayRefs} />
        </div>
    );
}
