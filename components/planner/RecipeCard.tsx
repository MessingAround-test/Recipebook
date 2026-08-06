import { useMemo, useState } from 'react';
import { FiTrash2, FiGitMerge, FiScissors, FiCheck, FiX } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import { makeKey } from '../planner/utils';

interface RecipeCardProps {
    item: any;
    analysisData?: any;
    compact?: boolean;
    timeline?: boolean;
}

export default function RecipeCard({ item, analysisData, compact = false, timeline = false }: RecipeCardProps) {
    const {
        handleDragStart,
        removePlannedRecipe,
        mergeTwoItems,
        splitRecipe,
        combinePendingId,
        setCombinePendingId,
        isPendingCard,
        pendingItem
    } = usePlanner();

    const [splitOpen, setSplitOpen] = useState(false);
    const [splitQty, setSplitQty] = useState(() => Math.ceil((Number(item.servings) || 0) / 2));

    const key = makeKey(item);
    const isPending = isPendingCard(item);
    const total = Number(item.servings) || 0;

    const resetSplit = () => {
        setSplitOpen(false);
        setSplitQty(Math.max(1, Math.ceil(total / 2)));
    };

    const confirmSplit = () => {
        splitRecipe(key, splitQty);
        resetSplit();
    };

    const clickMerge = () => {
        if (!combinePendingId || combinePendingId === key) {
            setCombinePendingId(key);
            return;
        }
        const other = pendingItem;
        if (other && other.recipe_id && other.recipe_id === item.recipe_id && other.day === item.day) {
            mergeTwoItems(combinePendingId, key);
            setCombinePendingId(null);
        } else {
            setCombinePendingId(key);
        }
    };

    const splitControls = useMemo(() => {
        if (!splitOpen) return null;
        return (
            <div className="flex flex-col gap-1.5 mt-2 p-2 rounded-lg bg-black/30 border border-emerald-500/20">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 shrink-0">Split into</span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setSplitQty(q => Math.max(1, q - 1))}
                            className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-xs font-black"
                        >
                            -
                        </button>
                        <span className="w-10 text-center text-sm font-black">{splitQty}</span>
                        <button
                            onClick={() => setSplitQty(q => Math.min(total - 1, q + 1))}
                            className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-xs font-black"
                        >
                            +
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={confirmSplit} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                        <FiCheck size={11} /> Split
                    </button>
                    <button onClick={resetSplit} className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-muted-foreground text-[10px] font-bold">
                        <FiX size={11} />
                    </button>
                </div>
            </div>
        );
    }, [splitOpen, splitQty, total, confirmSplit, resetSplit]);

    if (timeline) {
        return (
            <div
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                className={`cursor-grab active:cursor-grabbing transition-all rounded-lg border px-2 py-1.5 flex items-start justify-between group ${item.isLeftover ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'} ${isPending ? 'ring-2 ring-blue-400 bg-blue-500/20 shadow-[0_0_14px_rgba(59,130,246,0.5)]' : ''}`}
                title={item.recipe_name}
            >
                <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs leading-tight truncate">{item.recipe_name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">People: {item.servings}</span>
                        {analysisData?.cost != null && (
                            <span className="text-[10px] font-medium text-emerald-400">${analysisData.cost.toFixed(2)}</span>
                        )}
                        {analysisData?.isExpensive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Expensive" />}
                        {analysisData?.isLowNutrition && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Low nutrition" />}
                    </div>
                </div>
                <button
                    onClick={() => removePlannedRecipe(key)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-400 p-0.5 shrink-0"
                >
                    <FiTrash2 size={12} />
                </button>
            </div>
        );
    }

    return (
        <div
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            className={`cursor-grab active:cursor-grabbing transition-all rounded-xl p-3 border flex items-start justify-between group ${item.isLeftover ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'} ${isPending ? 'ring-2 ring-blue-400 bg-blue-500/20 shadow-[0_0_14px_rgba(59,130,246,0.5)]' : ''}`}
        >
            <div className="min-w-0 flex-1">
                {item.isLeftover && <div className="text-[10px] font-bold text-amber-500 mb-1 uppercase tracking-wider">(Leftovers)</div>}
                <div className="font-bold text-sm leading-tight break-words">{item.recipe_name}</div>
                <div className="flex items-center gap-2 mt-1">
                    <div className="text-xs text-muted-foreground">People: {item.servings}</div>
                    {analysisData?.cost != null && (
                        <div className="text-[10px] font-medium text-emerald-400">${analysisData.cost.toFixed(2)}</div>
                    )}
                    {item.carbType && !compact && (
                        <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">{item.carbType}</span>
                    )}
                </div>
                {(analysisData?.isExpensive || analysisData?.isLowNutrition) && (
                    <div className="flex items-center gap-1.5 mt-1">
                        {analysisData?.isExpensive && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30">Expensive</span>}
                        {analysisData?.isLowNutrition && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-400 border border-rose-500/30">Low Nutrition</span>}
                    </div>
                )}
                {splitControls}
                {!compact && !splitOpen && (
                    <div className="flex items-center gap-1 mt-2">
                        <button
                            onClick={clickMerge}
                            title={combinePendingId && combinePendingId !== key ? 'Merge with pending' : 'Merge with another of the same recipe'}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-colors text-[10px] font-black uppercase tracking-wider ${isPending ? 'bg-blue-500/30 text-blue-200' : 'text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/20'}`}
                        >
                            <FiGitMerge size={12} /> {isPending ? 'Merge!' : 'Merge'}
                        </button>
                        {total >= 2 && !item.isLeftover && (
                            <button
                                onClick={() => { setSplitOpen(true); setSplitQty(Math.max(1, Math.ceil(total / 2))); }}
                                title="Split this block into main + leftovers"
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                            >
                                <FiScissors size={12} /> Split
                            </button>
                        )}
                    </div>
                )}
            </div>
            <button
                onClick={() => removePlannedRecipe(key)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-400 p-1 shrink-0"
            >
                <FiTrash2 size={14} />
            </button>
        </div>
    );
}
