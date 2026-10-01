import { FiInfo, FiLayers, FiScissors, FiGitMerge } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import { sortCarbKeys } from '../planner/utils';
import RecipeCard from './RecipeCard';
import PlanProgress from './PlanProgress';

/**
 * Library tab = the Recipe Pool: undecided recipes waiting to be placed.
 * Split / Combine drop zones are desktop-only affordances (drag); on touch
 * the same ops live in each card's action sheet.
 */
export default function RecipePool() {
    const {
        undecidedRecipes,
        openModal,
        addAverageMeal,
        handleDragOver,
        handleDrop,
        handleSplitDrop,
        handleCombineDrop,
        setCombinePendingId,
        pendingItem
    } = usePlanner();

    const grouped = undecidedRecipes.reduce((acc, r) => {
        const type = r.carbType || 'Uncategorized';
        if (!acc[type]) acc[type] = [];
        acc[type].push(r);
        return acc;
    }, {});

    return (
        <div
            className="glass-card border-blue-500/30 p-4 relative z-10"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'Undecided')}
        >
            <PlanProgress />
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                    <FiInfo /> Library
                </h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={addAverageMeal}
                        title="Add an 'Average Meal' placeholder — counted at average values once placed on a day"
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-bold px-2 py-1 rounded-md transition-colors"
                    >
                        + Avg Meal
                    </button>
                    <button onClick={() => openModal(false)} className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-bold px-2 py-1 rounded-md transition-colors">
                        + Browse
                    </button>
                </div>
            </div>

            {/* Split / Combine drop zones — desktop (drag) only */}
            <div className="hidden xl:grid grid-cols-2 gap-2 mb-3">
                <div
                    onDragOver={handleDragOver}
                    onDrop={handleSplitDrop}
                    title="Drop a recipe here to split it in half"
                    className="rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 p-2.5 text-center cursor-copy"
                >
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center justify-center gap-1"><FiScissors size={11} /> Split</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">Drop to split in half</div>
                </div>
                <div
                    onDragOver={handleDragOver}
                    onDrop={handleCombineDrop}
                    title="Drop one item, then drop another of the same recipe and day to add their quantities"
                    className={`rounded-lg border-2 border-dashed p-2.5 text-center cursor-copy transition-all ${pendingItem
                        ? 'border-blue-400 bg-blue-500/25 ring-2 ring-blue-400/60 shadow-[0_0_18px_rgba(59,130,246,0.45)]'
                        : 'border-blue-500/30 bg-blue-500/5'}`}
                >
                    <div className={`text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 ${pendingItem ? 'text-blue-200 animate-pulse' : 'text-blue-400'}`}>
                        <FiGitMerge size={11} /> Combine
                    </div>
                    {pendingItem ? (
                        <div className="mt-1.5 flex items-center justify-between gap-1 px-2 py-1 rounded-md bg-blue-500/40 border border-blue-300/60">
                            <div className="text-[10px] font-black text-white truncate">{pendingItem.recipe_name}</div>
                            <button
                                onClick={() => setCombinePendingId(null)}
                                title="Cancel selection"
                                className="shrink-0 text-[9px] font-black uppercase tracking-widest text-blue-200 hover:text-white bg-blue-500/40 hover:bg-blue-500/60 rounded px-1.5 py-0.5 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="text-[9px] text-muted-foreground mt-0.5">Drop 2 to add quantities</div>
                    )}
                </div>
            </div>

            <div className="space-y-3 min-h-[80px] max-h-[min(60vh,640px)] overflow-y-auto custom-scrollbar pr-1">
                {undecidedRecipes.length === 0 ? (
                    <div className="text-center p-5 border border-dashed border-white/10 rounded-xl text-muted-foreground/50 text-xs font-bold uppercase tracking-widest">
                        <FiLayers className="mx-auto mb-2 opacity-40" size={20} />
                        Library empty
                        <div className="mt-1.5 normal-case tracking-normal font-medium text-[11px] text-muted-foreground/60">
                            Recipes you add without a day land here
                        </div>
                    </div>
                ) : (
                    Object.entries(grouped).sort(([a], [b]) => sortCarbKeys(a, b)).map(([carbType, recipes]) => (
                        <div key={carbType}>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 px-1 border-b border-white/10 pb-1">{carbType}</h4>
                            <div className="space-y-1.5">
                                {(recipes as any[]).map((r, idx) => (
                                    <RecipeCard key={r.id || r._id || idx} item={r} />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
