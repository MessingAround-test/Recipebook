import { FiCoffee, FiTrash2 } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import SearchableDropdown from '../SearchableDropdown';

export default function PantryPanel() {
    const {
        plan,
        numDays,
        addEverydayItem,
        updateEverydayQty,
        removeEverydayItem,
        newEverydayQty,
        setNewEverydayQty,
        openModal,
        recipeOptions
    } = usePlanner();

    return (
        <div className="glass-card relative z-40 p-4">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-emerald-400">
                <FiCoffee /> Pantry Pool
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Enter per-day amounts — spread evenly across your {numDays} {numDays === 1 ? 'day' : 'days'}.</p>

            <div className="space-y-2 mb-4">
                {plan.everydayItems.length === 0 ? (
                    <div className="text-center p-3 border border-dashed border-white/10 rounded-xl text-muted-foreground/50 text-xs font-bold uppercase tracking-widest">
                        Pool Empty
                    </div>
                ) : (
                    plan.everydayItems.map((item, idx) => {
                        const perDay = Math.round((item.quantity / numDays) * 100) / 100;
                        const perPersonPerDay = Math.round((perDay / Math.max(1, plan.defaultServings)) * 100) / 100;
                        return (
                            <div key={idx} className="flex items-center justify-between bg-black/20 p-2 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        value={perDay}
                                        onChange={(e) => updateEverydayQty(idx, (parseFloat(e.target.value) || 0) * numDays)}
                                        className="w-16 bg-background border border-white/10 rounded-lg px-2 text-sm"
                                        title="Quantity per day"
                                    />
                                    <div className="min-w-0">
                                        <div className="font-medium text-sm truncate">{item.name}</div>
                                        <div className="text-[10px] text-muted-foreground">{Math.round(item.quantity * 10) / 10} total over {numDays} {numDays === 1 ? 'day' : 'days'}</div>
                                        <div className="text-[10px] font-black text-emerald-400">
                                            {perPersonPerDay} / person / day
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => removeEverydayItem(idx)} className="text-rose-500 hover:text-rose-400 p-1">
                                    <FiTrash2 size={14} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Qty per day</div>
                <div className="flex gap-2 relative">
                    <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={newEverydayQty}
                        onChange={e => setNewEverydayQty(parseFloat(e.target.value) || 1)}
                        className="w-16 bg-background border border-white/10 rounded-lg px-2 text-sm z-10 relative"
                        title="Quantity per day"
                    />
                    <div className="flex-1 relative z-50">
                        <SearchableDropdown
                            options={recipeOptions}
                            placeholder="Add to pantry..."
                            onChange={(e) => addEverydayItem(e.target.value)}
                            name=""
                            value=""
                            onComplete={() => { }}
                        />
                    </div>
                </div>
                <button onClick={() => openModal(false, { day: null, mealType: null, pantry: true })} className="text-xs font-bold text-emerald-400/80 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-3 py-1.5 transition-colors text-left">
                    + Browse recipes
                </button>
            </div>
        </div>
    );
}
