import { useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiShoppingCart, FiGrid, FiSmartphone } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import { todayStr, getMondayOf, addDays, formatRangeLabel, formatShortDate } from '../../lib/dateUtils';

/**
 * Compact one-row header: ‹ range › + Export + (desktop) Day/Week toggle.
 * Everything else (presets, typed date range, servings, save status) lives in
 * a tap-to-open sheet so the header itself stays out of the way on phones.
 */
export default function PlanHeader() {
    const {
        startDate,
        numDays,
        changeStart,
        applyPreset,
        plan,
        setPlan,
        saveStatus,
        exporting,
        handleExport,
        viewMode,
        setViewMode,
        draftStart, setDraftStart,
        draftEnd, setDraftEnd,
        rangeError, setRangeError,
        applyDraftRange, onRangeKeyDown
    } = usePlanner();

    const [sheetOpen, setSheetOpen] = useState(false);

    const presets = [
        { label: 'Next 7 days', fn: () => applyPreset(todayStr(), 7) },
        { label: 'This week', fn: () => applyPreset(getMondayOf(todayStr()), 7) },
        { label: 'Next week', fn: () => applyPreset(addDays(getMondayOf(todayStr()), 7), 7) },
        { label: 'Last 7 days', fn: () => applyPreset(addDays(todayStr(), -6), 7) }
    ];

    const saveBadge = saveStatus === 'saving'
        ? { icon: <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />, text: 'Saving' }
        : saveStatus === 'saved'
            ? { icon: <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />, text: 'Saved' }
            : saveStatus === 'error'
                ? { icon: <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />, text: 'Error' }
                : null;

    return (
        <>
            <div className="flex items-center gap-1 mb-3 glass-card px-2 py-1.5 sticky top-0 z-40 xl:top-3">
                <button onClick={() => changeStart(-numDays)} aria-label="Previous period" className="p-2 hover:bg-white/10 rounded-lg text-emerald-500 transition-colors shrink-0">
                    <FiChevronLeft size={20} />
                </button>
                <button
                    onClick={() => setSheetOpen(true)}
                    className="flex-1 min-w-0 text-center px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                    title="Change dates, presets & people"
                >
                    <h1 className="text-sm xl:text-lg font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 truncate">
                        {formatRangeLabel(startDate, numDays)}
                    </h1>
                </button>
                <button onClick={() => changeStart(numDays)} aria-label="Next period" className="p-2 hover:bg-white/10 rounded-lg text-emerald-500 transition-colors shrink-0">
                    <FiChevronRight size={20} />
                </button>

                {saveBadge && (
                    <span className={`hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${saveStatus === 'saving' ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                        {saveBadge.icon} {saveBadge.text}
                    </span>
                )}

                {/* Desktop: Day flow vs Week grid */}
                <div className="hidden xl:flex p-1 rounded-xl bg-black/30 border border-white/10 shrink-0">
                    <button
                        onClick={() => setViewMode('day')}
                        title="Day flow — one day at a time"
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'day' ? 'bg-emerald-500/20 text-emerald-300' : 'text-muted-foreground hover:text-white'}`}
                    >
                        <FiSmartphone size={12} /> Day
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        title="Week grid — all days side by side"
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'grid' ? 'bg-emerald-500/20 text-emerald-300' : 'text-muted-foreground hover:text-white'}`}
                    >
                        <FiGrid size={12} /> Week
                    </button>
                </div>

                <button
                    onClick={handleExport}
                    disabled={exporting}
                    aria-label="Export shopping list"
                    className="ml-auto shrink-0 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white p-2.5 xl:px-4 xl:gap-2 xl:flex rounded-xl font-bold items-center transition-all shadow-lg shadow-blue-500/20"
                >
                    <FiShoppingCart size={18} />
                    <span className="hidden xl:inline">{exporting ? 'Exporting...' : 'Export List'}</span>
                </button>
            </div>

            {sheetOpen && (
                <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200" onMouseDown={() => setSheetOpen(false)}>
                    <div
                        className="w-full sm:max-w-md bg-[#121214] border border-white/10 border-b-0 sm:rounded-2xl rounded-t-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar"
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <div className="relative text-center mb-4">
                            <h2 className="text-xs font-black uppercase tracking-widest text-emerald-400">Plan settings</h2>
                            <button onClick={() => setSheetOpen(false)} className="absolute right-0 top-0 p-1.5 -mr-1 text-muted-foreground hover:text-white transition-colors" aria-label="Close">
                                <span className="text-lg leading-none">×</span>
                            </button>
                            <p className="mt-1 text-sm font-black">{formatShortDate(startDate)}</p>
                        </div>

                        {/* Start/end date inputs (existing flexible parser) */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Start</label>
                                <input
                                    type="text"
                                    value={draftStart}
                                    onChange={(e) => { setDraftStart(e.target.value); setRangeError(false); }}
                                    onKeyDown={onRangeKeyDown}
                                    placeholder="YYYY-MM-DD"
                                    className={`w-full bg-black/30 border ${rangeError ? 'border-rose-500' : 'border-white/10'} rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-500/40`}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">End</label>
                                <input
                                    type="text"
                                    value={draftEnd}
                                    onChange={(e) => { setDraftEnd(e.target.value); setRangeError(false); }}
                                    onKeyDown={onRangeKeyDown}
                                    placeholder="YYYY-MM-DD"
                                    className={`w-full bg-black/30 border ${rangeError ? 'border-rose-500' : 'border-white/10'} rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-500/40`}
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => { applyDraftRange(); setSheetOpen(false); }}
                            className="w-full mb-5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-widest transition-colors"
                        >
                            Apply dates
                        </button>

                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Presets</div>
                        <div className="grid grid-cols-2 gap-2 mb-5">
                            {presets.map(p => (
                                <button
                                    key={p.label}
                                    onClick={() => { p.fn(); setSheetOpen(false); }}
                                    className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* People in the house */}
                        <div className="flex items-center justify-between py-2 border-t border-white/10">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">People in the house</span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPlan(pl => ({ ...pl, defaultServings: Math.max(1, pl.defaultServings - 1) }))} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 font-black">−</button>
                                <span className="w-8 text-center font-black">{plan.defaultServings}</span>
                                <button onClick={() => setPlan(pl => ({ ...pl, defaultServings: pl.defaultServings + 1 }))} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 font-black">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
