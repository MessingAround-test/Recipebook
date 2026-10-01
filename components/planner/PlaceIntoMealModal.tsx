'use client';

import { FiX } from 'react-icons/fi';
import { usePlanner } from './PlannerContext';
import { formatShortDate } from '../../lib/dateUtils';
import { MEALS } from './types';
import { MEAL_SHORT, MEAL_COLORS } from './utils';

/**
 * Mobile meal-picker: where on the selected day should this pool item land?
 * Opened from an "add" button on Library pool cards; anchored flush to the
 * top of the bottom tab bar so it reads as sliding out of the toolbar.
 */
export default function PlaceIntoMealModal() {
    const { placeTray, setPlaceTray, selectedDay, movePlannedRecipe } = usePlanner();

    if (!placeTray) return null;

    const placeInto = (meal: string) => {
        movePlannedRecipe(String(placeTray.id || placeTray._id), selectedDay, meal);
        setPlaceTray(null);
    };

    return (
        <div
            className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onMouseDown={() => setPlaceTray(null)}
            onTouchStart={() => setPlaceTray(null)}
        >
            <div
                className="fixed inset-x-0 z-[96] bg-[#121214] border-t border-white/10 rounded-t-2xl p-4 pb-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-w-xl mx-auto bottom-[calc(4.5rem+var(--planner-tabs-h,3.75rem)+env(safe-area-inset-bottom))] xl:bottom-0"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Place into {formatShortDate(selectedDay)}</p>
                        <p className="text-sm font-black truncate">{placeTray.recipe_name}</p>
                    </div>
                    <button onClick={() => setPlaceTray(null)} className="p-2 text-muted-foreground hover:text-white transition-colors">
                        <FiX size={18} />
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {MEALS.map(meal => (
                        <button
                            key={meal}
                            onClick={() => placeInto(meal)}
                            className={`py-3.5 rounded-xl border text-sm font-black uppercase tracking-wider transition-all ${MEAL_COLORS[meal]} bg-white/[0.04] border-white/10 hover:border-blue-400/50 hover:bg-blue-500/10`}
                        >
                            {MEAL_SHORT[meal]}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
