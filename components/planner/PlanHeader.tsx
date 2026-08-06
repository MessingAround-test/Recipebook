import { FiChevronLeft, FiChevronRight, FiShoppingCart, FiCheck, FiLoader } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import { todayStr, getMondayOf, addDays, formatRangeLabel } from '../../lib/dateUtils';

export default function PlanHeader() {
    const {
        startDate,
        numDays,
        changeStart,
        applyPreset,
        draftStart,
        setDraftStart,
        draftEnd,
        setDraftEnd,
        rangeError,
        setRangeError,
        applyDraftRange,
        onRangeKeyDown,
        plan,
        setPlan,
        saveStatus,
        exporting,
        handleExport
    } = usePlanner();

    const presets = [
        { label: 'Next 7 days', fn: () => applyPreset(todayStr(), 7) },
        { label: 'This week', fn: () => applyPreset(getMondayOf(todayStr()), 7) },
        { label: 'Next week', fn: () => applyPreset(addDays(getMondayOf(todayStr()), 7), 7) },
        { label: 'Last 7 days', fn: () => applyPreset(addDays(todayStr(), -6), 7) }
    ];

    return (
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-6 glass-card p-6 z-10 relative gap-4">
            <div className="flex items-center gap-3 w-full xl:w-auto">
                <button onClick={() => changeStart(-numDays)} className="p-2 hover:bg-white/10 rounded-lg text-emerald-500 transition-colors shrink-0">
                    <FiChevronLeft size={24} />
                </button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 whitespace-nowrap">
                        {formatRangeLabel(startDate, numDays)}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        {presets.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={preset.fn}
                                className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white transition-colors"
                            >
                                {preset.label}
                            </button>
                        ))}
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={draftStart}
                                onChange={(e) => { setDraftStart(e.target.value); setRangeError(false); }}
                                onKeyDown={onRangeKeyDown}
                                placeholder="YYYY-MM-DD"
                                title="Start date — type it or pick from a preset"
                                className={`bg-background border border-white/10 rounded-md px-2 py-1 text-xs font-bold text-muted-foreground w-[7.5rem] ${rangeError ? 'border-rose-500' : ''}`}
                            />
                            <span className="text-xs text-muted-foreground">→</span>
                            <input
                                type="text"
                                value={draftEnd}
                                onChange={(e) => { setDraftEnd(e.target.value); setRangeError(false); }}
                                onKeyDown={onRangeKeyDown}
                                placeholder="YYYY-MM-DD"
                                title="End date — type it or pick from a preset"
                                className={`bg-background border border-white/10 rounded-md px-2 py-1 text-xs font-bold text-muted-foreground w-[7.5rem] ${rangeError ? 'border-rose-500' : ''}`}
                            />
                            <button
                                onClick={applyDraftRange}
                                title="Apply date range"
                                className="p-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 transition-colors shrink-0"
                            >
                                <FiCheck size={16} />
                            </button>
                        </div>
                    </div>
                </div>
                <button onClick={() => changeStart(numDays)} className="p-2 hover:bg-white/10 rounded-lg text-emerald-500 transition-colors shrink-0">
                    <FiChevronRight size={24} />
                </button>
            </div>

            <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap">
                <div className="flex flex-col items-start">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">People in the house</label>
                    <input
                        type="number"
                        min="1"
                        className="bg-background border border-white/10 rounded-md w-20 px-3 py-1.5 text-center font-bold text-lg"
                        value={plan.defaultServings}
                        onChange={(e) => setPlan(p => ({ ...p, defaultServings: parseInt(e.target.value) || 2 }))}
                    />
                </div>

                <div className="flex flex-col items-start min-w-[5.5rem]">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Save</label>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold w-full justify-center ${saveStatus === 'saved' ? 'bg-emerald-500/15 text-emerald-400' : saveStatus === 'saving' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/5 text-muted-foreground'}`}>
                        {saveStatus === 'saving' ? <><FiLoader className="animate-spin" size={13} /> Saving...</> : saveStatus === 'saved' ? <><FiCheck size={13} /> Saved</> : 'Auto'}
                    </div>
                </div>

                <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                >
                    <FiShoppingCart /> {exporting ? 'Exporting...' : 'Export List'}
                </button>
            </div>
        </div>
    );
}
