import { useMemo, useState } from 'react';
import { FiX, FiMinus, FiPlus, FiTrash2, FiGitMerge, FiScissors, FiChevronsUp } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import { makeKey } from '../planner/utils';

interface RecipeCardProps {
    item: any;
    analysisData?: any;
    compact?: boolean;
    timeline?: boolean;
}

/**
 * One-line card: name · servings · cost (+ warning dots). The whole card is a
 * button that opens an action sheet with everything else (servings stepper,
 * double, split, merge, delete). Tap-to-act instead of tiny hover buttons —
 * one pattern on desktop and mobile.
 */
export default function RecipeCard({ item, analysisData, compact = false, timeline = false }: RecipeCardProps) {
    const {
        handleDragStart,
        removePlannedRecipe,
        scalePlannedRecipe,
        doublePlannedRecipe,
        mergeTwoItems,
        splitRecipe,
        combinePendingId,
        setCombinePendingId,
        isPendingCard,
        pendingItem,
        setPlaceTray
    } = usePlanner();

    // Undecided (pool) items offer a direct "add to the selected day" button
    const isPoolItem = item.day === 'Undecided';

    const [sheetOpen, setSheetOpen] = useState(false);
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
        setSheetOpen(false);
    };

    const clickMerge = () => {
        if (!combinePendingId || combinePendingId === key) {
            // First pick: card stays pending; close the sheet so the user can tap the partner card.
            setCombinePendingId(key);
            setSheetOpen(false);
            return;
        }
        const other = pendingItem;
        if (other && other.recipe_id && other.recipe_id === item.recipe_id && other.day === item.day) {
            mergeTwoItems(combinePendingId, key);
            setCombinePendingId(null);
        } else {
            setCombinePendingId(key);
        }
        setSheetOpen(false);
    };

    const sheetRow = (label: string, icon: React.ReactNode, onClick: () => void, tone: string, disabled = false) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-black uppercase tracking-wider transition-all hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed ${tone}`}
        >
            {icon} {label}
        </button>
    );

    const actionSheet = useMemo(() => {
        if (!sheetOpen) return null;
        return (
            <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200" onMouseDown={() => setSheetOpen(false)}>
                <div
                    className="w-full sm:max-w-md bg-[#121214] border-t border-white/10 sm:border sm:rounded-2xl rounded-t-2xl p-4 pb-6 sm:pb-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
                    onMouseDown={e => e.stopPropagation()}
                >
                    {/* Title */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                            {item.isAverageMeal && <div className="text-[9px] font-black uppercase tracking-widest text-amber-400">Avg Meal</div>}
                            {item.isLeftover && <div className="text-[9px] font-black uppercase tracking-widest text-amber-400">Leftovers</div>}
                            <p className="font-black text-sm leading-tight truncate">{item.recipe_name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                People: {total}
                                {item.carbType ? ` · ${item.carbType}` : ''}
                                {analysisData?.cost != null ? ` · $${analysisData.cost.toFixed(2)}` : ''}
                            </p>
                        </div>
                        <button onClick={() => setSheetOpen(false)} className="p-2 -mr-1 text-muted-foreground hover:text-white transition-colors" aria-label="Close">
                            <FiX size={18} />
                        </button>
                    </div>

                    {/* Servings stepper */}
                    {!item.isLeftover && !compact && (
                        <div className="flex items-center justify-between px-1 py-2.5 mb-2 rounded-xl bg-white/[0.04] border border-white/10">
                            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">People</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => scalePlannedRecipe(key, total - 1)} disabled={total <= 1} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">
                                    <FiMinus size={14} />
                                </button>
                                <span className="w-10 text-center text-sm font-black">{total}</span>
                                <button onClick={() => scalePlannedRecipe(key, total + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <FiPlus size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        {!item.isLeftover && !compact && sheetRow('Double', <FiChevronsUp size={15} />, () => { doublePlannedRecipe(key); setSheetOpen(false); }, 'text-purple-300')}
                        {(total >= 2 && !item.isLeftover) && sheetRow('Split', <FiScissors size={15} />, () => { setSplitOpen(true); setSplitQty(Math.max(1, Math.ceil(total / 2))); }, 'text-emerald-300')}
                        {sheetRow(isPending ? 'Merging…' : 'Merge', <FiGitMerge size={15} />, clickMerge, isPending ? 'bg-blue-500/20 text-blue-200' : 'text-blue-300')}
                        {sheetRow('Remove', <FiTrash2 size={15} />, () => { removePlannedRecipe(key); setSheetOpen(false); }, 'text-rose-300')}
                    </div>

                    {isPending && (
                        <p className="text-[10px] text-blue-300/80 text-center mt-3">
                            Picked — now tap another card of the same recipe to merge, or tap Merge again to cancel.
                        </p>
                    )}

                    {/* Split qty picker */}
                    {splitOpen && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Split into</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setSplitQty(q => Math.max(1, q - 1))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-xs font-black">
                                        <FiMinus size={12} />
                                    </button>
                                    <span className="w-10 text-center text-sm font-black">{splitQty}</span>
                                    <button onClick={() => setSplitQty(q => Math.min(total - 1, q + 1))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-xs font-black">
                                        <FiPlus size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={confirmSplit} className="flex-1 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-widest">
                                    Split
                                </button>
                                <button onClick={resetSplit} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground text-[10px] font-bold">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }, [sheetOpen, splitOpen, splitQty, total, key, item, compact, analysisData, isPending, combinePendingId, confirmSplit, resetSplit, clickMerge]);

    return (
        <>
            <div
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onClick={() => setSheetOpen(true)}
                className={`cursor-pointer active:scale-[0.98] transition-all rounded-lg border px-2.5 py-2 flex items-center justify-between gap-2 group ${item.isAverageMeal ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20' : item.isLeftover ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'} ${isPending ? 'ring-2 ring-blue-400 bg-blue-500/20 shadow-[0_0_14px_rgba(59,130,246,0.5)]' : ''}`}
                title={item.recipe_name}
            >
                <div className="min-w-0 flex-1">
                    {item.isAverageMeal && <div className="text-[8px] font-black uppercase tracking-widest text-amber-400 leading-none mb-0.5">Avg meal</div>}
                    <div className="font-bold text-xs leading-tight truncate">{item.recipe_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">×{item.servings}</span>
                        {analysisData?.cost != null && (
                            <span className="text-[10px] font-medium text-emerald-400">${analysisData.cost.toFixed(2)}</span>
                        )}
                        {analysisData?.isExpensive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Expensive" />}
                        {analysisData?.isLowNutrition && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Low nutrition" />}
                    </div>
                </div>
                {isPoolItem && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setPlaceTray(item); }}
                        title="Add to the selected day"
                        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/40 text-blue-300 hover:text-white transition-colors"
                        aria-label="Add to selected day"
                    >
                        <FiPlus size={14} />
                    </button>
                )}
            </div>

            {actionSheet}
        </>
    );
}
