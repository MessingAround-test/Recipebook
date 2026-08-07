import { Fragment } from 'react';
import { FiZap } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import { formatShortDate } from '../../lib/dateUtils';
import { MEALS } from './types';
import MealSlot from './MealSlot';

const MEAL_COLORS: Record<string, string> = {
    Breakfast: 'text-amber-300/90',
    Lunch: 'text-emerald-300/90',
    Dinner: 'text-blue-300/90',
    Snack: 'text-purple-300/90'
};

const MEAL_LABELS: Record<string, string> = {
    Breakfast: 'Brekky',
    Lunch: 'Lunch',
    Dinner: 'Dinner',
    Snack: 'Snack'
};

interface WeekTimelineProps {
    dayRefs?: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export default function WeekTimeline({ dayRefs }: WeekTimelineProps) {
    const { dates, plan, analysis, openDaySuggest } = usePlanner();

    const dayCost = (date: string) => {
        let planned = 0;
        plan.plannedRecipes.forEach(r => {
            if (r.day !== date) return;
            const a = analysis?.recipeAnalysis?.find(x => (x.id === r.id || x.id === r._id));
            if (a) planned += a.cost;
        });
        return analysis ? (planned + (analysis.dailyEverydayCost || 0)) : 0;
    };

    return (
        <div className="overflow-x-auto pb-4 custom-scrollbar">
            <div
                className="grid min-w-max"
                style={{ gridTemplateColumns: `minmax(84px, 5.5rem) repeat(${dates.length}, minmax(11rem, 1fr))` }}
            >
                {/* Corner cell */}
                <div className="sticky left-0 z-20 bg-background border-b border-white/10 px-3 py-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Meal</span>
                </div>

                {/* Day headers */}
                {dates.map((d) => (
                    <div
                        key={d}
                        ref={(el) => { if (dayRefs) dayRefs.current[d] = el; }}
                        className="border-b border-white/10 px-3 py-2.5 flex flex-col gap-1"
                    >
                        <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-black uppercase tracking-wider">{formatShortDate(d)}</span>
                            <button
                                onClick={() => openDaySuggest(d)}
                                title="AI-fill this day"
                                className="shrink-0 p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
                            >
                                <FiZap size={12} />
                            </button>
                        </div>
                        {analysis && (
                            <span className="text-[10px] font-bold text-emerald-400">${dayCost(d).toFixed(2)}</span>
                        )}
                    </div>
                ))}

                {/* Meal rows */}
                {MEALS.map(meal => (
                    <Fragment key={meal}>
                        <div className="sticky left-0 z-10 bg-background px-3 py-3 flex items-center gap-2 border-t border-white/5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500/60 shrink-0" />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${MEAL_COLORS[meal] || 'text-muted-foreground'}`}>{MEAL_LABELS[meal] || meal}</span>
                        </div>
                        {dates.map(date => (
                            <MealSlot key={date} date={date} meal={meal} timeline />
                        ))}
                    </Fragment>
                ))}
            </div>
        </div>
    );
}
