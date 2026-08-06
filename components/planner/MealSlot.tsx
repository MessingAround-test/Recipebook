import { FiPlus } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import RecipeCard from './RecipeCard';

interface MealSlotProps {
    date: string;
    meal: string;
    compact?: boolean;
    timeline?: boolean;
}

export default function MealSlot({ date, meal, compact = false, timeline = false }: MealSlotProps) {
    const { plan, analysis, handleDragOver, handleDrop, openModal } = usePlanner();

    const mealRecipes = plan.plannedRecipes.filter(r => r.mealType === meal && r.day === date);

    const analysisDataFor = (r) => analysis?.recipeAnalysis?.find(a => (a.id === r.id || a.id === r._id));

    return (
        <div
            className={`flex flex-col bg-black/20 rounded-xl border border-white/5 transition-colors ${timeline ? 'm-0.5 min-h-[110px] p-2' : 'p-3 min-h-[110px]'}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, date, meal)}
        >
            {!timeline && (
                <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${meal === 'Snack' ? 'text-amber-400/80' : 'text-muted-foreground'}`}>{meal}</h3>
                    <button
                        onClick={() => openModal(false, { day: date, mealType: meal })}
                        title={`Add to ${meal}`}
                        className="p-1 rounded-md text-muted-foreground/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                        <FiPlus size={14} />
                    </button>
                </div>
            )}

            {timeline && (
                <div className="flex items-center justify-end mb-1.5">
                    <button
                        onClick={() => openModal(false, { day: date, mealType: meal })}
                        title={`Add to ${meal}`}
                        className="p-0.5 rounded text-muted-foreground/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                        <FiPlus size={12} />
                    </button>
                </div>
            )}

            {mealRecipes.length > 0 ? (
                <div className={`${timeline ? 'space-y-1.5' : 'space-y-2'}`}>
                    {mealRecipes.map((r, idx) => (
                        <RecipeCard key={r.id || r._id || idx} item={r} analysisData={analysisDataFor(r)} compact={compact || timeline} />
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center border border-dashed border-white/5 rounded-lg text-muted-foreground/30 text-[10px] font-bold uppercase tracking-widest mt-1">
                    Drop here
                </div>
            )}
        </div>
    );
}
