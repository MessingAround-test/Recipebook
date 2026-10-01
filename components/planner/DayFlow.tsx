import { useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiZap, FiHelpCircle } from 'react-icons/fi';
import { usePlanner } from './PlannerContext';
import { formatShortDate, formatDayChip } from '../../lib/dateUtils';
import { MEALS } from './types';
import { MEAL_SHORT, MEAL_COLORS } from './utils';
import MealSlot from './MealSlot';
import DayDietTab from './DayDietTab';
import PlanProgress from './PlanProgress';

// Day-by-day flow: one compact day per pane (swipe or arrows). Everything
// else lives in popup trays so the pane itself only holds the day's four
// meal slots — scrolling is kept to an absolute minimum. Pool placement
// happens from the Library cards ("add to selected day" button).
export default function DayFlow() {
    const {
        dates,
        plan,
        analysis,
        openDaySuggest,
        openDayQuiz,
        selectedDay,
        setSelectedDay
    } = usePlanner();

    const touchStart = useRef<{ x: number; y: number } | null>(null);

    const paneIdx = Math.max(0, dates.indexOf(selectedDay));
    const paneKey = selectedDay;

    const goTo = (idx: number) => {
        const d = dates[Math.max(0, Math.min(dates.length - 1, idx))];
        if (d) setSelectedDay(d);
    };

    const onTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        // Horizontal-dominant swipe with a sane threshold so vertical page
        // scrolls never move the day.
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            goTo(paneIdx + (dx < 0 ? 1 : -1));
        }
    };

    const dayCost = (date: string) => {
        let planned = 0;
        (plan?.plannedRecipes || []).forEach((r: any) => {
            if (r.day !== date) return;
            const a0 = analysis?.recipeAnalysis?.find((x: any) => (x.id === r.id || x.id === r._id));
            if (a0) planned += a0.cost;
        });
        return analysis ? planned + (analysis.dailyEverydayCost || 0) : 0;
    };

    return (
        <div className="min-w-0">
            {/* Period mains progress (pool + placed items both count) */}
            <PlanProgress compact />

            {/* Day jump chips (swipe shorthand) */}
            <div className="mb-2 -mx-2 px-2 flex gap-1.5 overflow-x-auto no-scrollbar">
                {dates.map((d, i) => (
                    <button
                        key={d}
                        onClick={() => goTo(i)}
                        className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-colors ${i === paneIdx
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-300'}`}
                    >
                        {formatDayChip(d)}
                    </button>
                ))}
            </div>

            {/* Sticky day header + swipe arrows: navigation always on page one */}
            <div className="sticky top-12 z-30 -mx-2 px-2 py-2 bg-background/90 backdrop-blur-md border-b border-white/5 flex items-center gap-1">
                <button
                    onClick={() => goTo(paneIdx - 1)}
                    disabled={paneIdx <= 0}
                    title="Previous day"
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg glass-card border border-white/10 text-emerald-400 hover:bg-white/10 disabled:opacity-30 transition-all"
                >
                    <FiChevronLeft size={16} />
                </button>
                <h2 className="flex-1 text-center text-lg font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 whitespace-nowrap">
                    {formatShortDate(paneKey)}
                    {analysis && <span className="ml-2 text-xs font-bold text-emerald-400 normal-case tracking-normal">${dayCost(paneKey).toFixed(2)}</span>}
                </h2>
                <button
                    onClick={() => openDayQuiz(paneKey)}
                    title="Quiz-fill this day"
                    className="shrink-0 p-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
                >
                    <FiHelpCircle size={13} />
                </button>
                <button
                    onClick={() => openDaySuggest(paneKey)}
                    title="AI-fill this day"
                    className="shrink-0 p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
                >
                    <FiZap size={13} />
                </button>
                <button
                    onClick={() => goTo(paneIdx + 1)}
                    disabled={paneIdx >= dates.length - 1}
                    title="Next day"
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg glass-card border border-white/10 text-emerald-400 hover:bg-white/10 disabled:opacity-30 transition-all"
                >
                    <FiChevronRight size={16} />
                </button>
            </div>

            {/* Pool access now lives on the Library cards (add-to-selected-day) */}

            <div
                className="relative overflow-hidden select-none mt-2 touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                {/* Day panes */}
                <div
                    className="flex transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(-${paneIdx * 100}%)` }}
                >
                    {dates.map((date) => (
                        <div
                            key={date}
                            className="w-full shrink-0 px-1"
                            aria-hidden={date !== paneKey}
                        >
                            {/* 2×2 slot grid — the day at a glance, no scrolling */}
                            <div className="grid grid-cols-2 gap-2">
                                {MEALS.map(meal => (
                                    <div
                                        key={meal}
                                        className="rounded-2xl"
                                    >
                                        <div className={`px-2 pt-1.5 pb-0.5 text-[10px] font-black uppercase tracking-widest ${MEAL_COLORS[meal] || 'text-muted-foreground'}`}>
                                            {MEAL_SHORT[meal]}
                                        </div>
                                        <MealSlot date={date} meal={meal} timeline />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Per-day diet scores (desktop only — mobile hides the day view scores) */}
            <div className="hidden xl:block">
                <DayDietTab day={paneKey} />
            </div>
        </div>
    );
}
