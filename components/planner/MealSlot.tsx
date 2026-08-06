import { useState } from 'react';
import { FiPlus, FiCoffee, FiCheck, FiX } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import RecipeCard from './RecipeCard';

interface MealSlotProps {
    date: string;
    meal: string;
    compact?: boolean;
    timeline?: boolean;
}

export default function MealSlot({ date, meal, compact = false, timeline = false }: MealSlotProps) {
    const { plan, analysis, handleDragOver, handleDrop, openModal, togglePantryPlacement } = usePlanner();
    const [pantryOpen, setPantryOpen] = useState(false);

    const mealRecipes = plan.plannedRecipes.filter(r => r.mealType === meal && r.day === date);

    const slotKey = `${date}|${meal}`;
    const placements = plan.pantryPlacements?.[slotKey] || [];
    const pinnedItems = placements.map(i => plan.everydayItems[i]).filter(Boolean);

    const analysisDataFor = (r) => analysis?.recipeAnalysis?.find(a => (a.id === r.id || a.id === r._id));

    const headerButtons = (size: number, open: boolean) => (
        <div className="flex items-center gap-0.5">
            {plan.everydayItems.length > 0 && (
                <button
                    onClick={() => setPantryOpen(!open)}
                    title="Pin pantry item"
                    className={`p-0.5 rounded transition-colors ${open ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground/40 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                >
                    <FiCoffee size={size} />
                </button>
            )}
            <button
                onClick={() => openModal(false, { day: date, mealType: meal })}
                title={`Add to ${meal}`}
                className="p-0.5 rounded text-muted-foreground/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
                <FiPlus size={size} />
            </button>
        </div>
    );

    const pantryPicker = () => {
        if (!pantryOpen) return null;
        return (
            <div className="mb-1.5 rounded-lg border border-emerald-500/20 bg-black/40 p-1.5 space-y-0.5">
                <p className="px-1 pb-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400/70">Pantry (visual only)</p>
                {plan.everydayItems.map((item, idx) => {
                    const pinned = placements.includes(idx);
                    return (
                        <button
                            key={idx}
                            onClick={() => togglePantryPlacement(idx, date, meal)}
                            className={`w-full flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] leading-tight transition-colors ${pinned ? 'bg-emerald-500/15 text-emerald-200' : 'text-muted-foreground hover:bg-white/5'}`}
                        >
                            <FiCoffee size={10} className={pinned ? 'text-emerald-400' : 'text-muted-foreground/50'} />
                            <span className="flex-1 truncate">{item.name}</span>
                            {pinned && <FiCheck size={10} className="text-emerald-400 shrink-0" />}
                        </button>
                    );
                })}
            </div>
        );
    };

    const pinnedChips = () => {
        if (pinnedItems.length === 0) return null;
        return (
            <div className={`${timeline ? 'space-y-1' : 'space-y-1.5'} mb-1.5`}>
                {pinnedItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-1 rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1 text-[10px] leading-tight text-emerald-200/90">
                        <FiCoffee size={10} className="text-emerald-400/80 shrink-0" />
                        <span className="flex-1 truncate">{item.name}</span>
                        <button
                            onClick={() => togglePantryPlacement(placements[i], date, meal)}
                            title="Unpin"
                            className="text-emerald-400/50 hover:text-red-400 transition-colors"
                        >
                            <FiX size={10} />
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div
            className={`flex flex-col bg-black/20 rounded-xl border border-white/5 transition-colors ${timeline ? 'm-0.5 min-h-[110px] p-2' : 'p-3 min-h-[110px]'}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, date, meal)}
        >
            {!timeline && (
                <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${meal === 'Snack' ? 'text-amber-400/80' : 'text-muted-foreground'}`}>{meal}</h3>
                    {headerButtons(14, pantryOpen)}
                </div>
            )}

            {timeline && (
                <div className="flex items-center justify-end mb-1.5">
                    {headerButtons(12, pantryOpen)}
                </div>
            )}

            {pantryPicker()}
            {pinnedChips()}

            {mealRecipes.length > 0 ? (
                <div className={`${timeline ? 'space-y-1.5' : 'space-y-2'} flex-1`}>
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
