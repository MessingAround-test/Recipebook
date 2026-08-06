import { FiInfo } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import { sortCarbKeys } from '../planner/utils';
import RecipeCard from './RecipeCard';

export default function RecipePool() {
    const {
        undecidedRecipes,
        openModal,
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
            className="glass-card border-blue-500/30 p-4"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'Undecided')}
        >
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                    <FiInfo /> Recipe Pool
                </h3>
                <button onClick={() => openModal(false)} className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-bold px-2 py-1 rounded-md transition-colors">
                    + Browse
                </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Drag these recipes to your days!</p>

            {/* Split / Combine drop zones */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <div
                    onDragOver={handleDragOver}
                    onDrop={handleSplitDrop}
                    title="Drop a recipe here to split it in half"
                    className="rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 p-3 text-center cursor-copy"
                >
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Split</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">Drop to split in half</div>
                </div>
                <div
                    onDragOver={handleDragOver}
                    onDrop={handleCombineDrop}
                    title="Drop one item, then drop another of the same recipe and day to add their quantities"
                    className={`rounded-lg border-2 border-dashed p-3 text-center cursor-copy transition-all ${pendingItem
                        ? 'border-blue-400 bg-blue-500/25 ring-2 ring-blue-400/60 shadow-[0_0_18px_rgba(59,130,246,0.45)]'
                        : 'border-blue-500/30 bg-blue-500/5'}`}
                >
                    <div className={`text-[10px] font-black uppercase tracking-widest ${pendingItem ? 'text-blue-200 animate-pulse' : 'text-blue-400'}`}>Combine</div>
                    {pendingItem ? (
                        <div className="mt-1.5 px-2 py-1.5 rounded-md bg-blue-500/40 border border-blue-300/60 shadow-[0_0_10px_rgba(59,130,246,0.6)]">
                            <div className="text-[10px] font-black text-white truncate">{pendingItem.recipe_name}</div>
                            <div className="text-[9px] font-bold text-blue-100 mt-0.5">People: {pendingItem.servings}</div>
                            <div className="text-[8px] uppercase tracking-wider text-blue-200 mt-1">Drop a 2nd to add</div>
                        </div>
                    ) : (
                        <div className="text-[9px] text-muted-foreground mt-0.5">Drop 2 to add quantities</div>
                    )}
                    {pendingItem && (
                        <button
                            onClick={() => setCombinePendingId(null)}
                            className="mt-1.5 text-[8px] font-black uppercase tracking-widest text-blue-300 hover:text-white bg-blue-500/30 hover:bg-blue-500/50 rounded px-2 py-0.5 transition-colors"
                        >
                            Cancel selection
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-2 min-h-[100px]">
                {undecidedRecipes.length === 0 ? (
                    <div className="text-center p-4 border border-dashed border-white/10 rounded-xl text-muted-foreground/50 text-xs font-bold uppercase tracking-widest">
                        Pool Empty
                    </div>
                ) : (
                    Object.entries(grouped).sort(([a], [b]) => sortCarbKeys(a, b)).map(([carbType, recipes]) => (
                        <div key={carbType} className="mb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1 border-b border-white/10 pb-1 inline-block">{carbType}</h4>
                            <div className="space-y-2">
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
