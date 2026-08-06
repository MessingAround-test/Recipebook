import { FiX, FiFilter, FiCoffee, FiSearch } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import { MEALS } from './types';
import { isSnackRecipe, normalizeMealType, sortCarbKeys } from './utils';

export default function BrowseRecipesModal() {
    const {
        allRecipes,
        showRecipeModal,
        closeModal,
        modalOnlySnacks,
        setModalOnlySnacks,
        modalGroupBy,
        setModalGroupBy,
        modalMealFilters,
        setModalMealFilters,
        toggleMealFilter,
        modalSearch,
        setModalSearch,
        modalSelectedRecipeIds,
        handleToggleModalRecipe,
        confirmModalRecipes,
        browseTarget
    } = usePlanner();

    if (!showRecipeModal) return null;

    const searchTerm = modalSearch.trim().toLowerCase();

    const filtered = allRecipes.filter(r => {
        if (searchTerm) {
            const haystack = `${r.name} ${r.genre || ''} ${(r.mealTypes || []).join(' ')}`.toLowerCase();
            if (!haystack.includes(searchTerm)) return false;
        }
        if (modalOnlySnacks && !isSnackRecipe(r)) return false;
        if (modalMealFilters.size > 0) {
            const primary = (r.mealTypes && r.mealTypes.length > 0)
                ? normalizeMealType(r.mealTypes[0])
                : 'General';
            if (!modalMealFilters.has(primary)) return false;
        }
        return true;
    });

    const grouped = filtered.reduce((acc, r) => {
        let key;
        if (modalGroupBy === 'meal') {
            const mt = (r.mealTypes && r.mealTypes.length > 0) ? normalizeMealType(r.mealTypes[0]) : 'General';
            key = mt;
        } else if (modalGroupBy === 'genre') {
            key = r.genre || 'General';
        } else {
            key = r.carbType || 'Uncategorized';
        }
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
    }, {});

    const sortGroupKeys = (a, b) => {
        if (modalGroupBy === 'carb') return sortCarbKeys(a, b);
        return a.localeCompare(b);
    };

    const targetLabel = browseTarget?.pantry
        ? ' to Pantry'
        : browseTarget?.day && browseTarget?.mealType
            ? ` into ${browseTarget.day} (${browseTarget.mealType})`
            : ' to Pool';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-black tracking-widest uppercase">Browse Recipes</h2>
                    <button onClick={closeModal} className="p-2 text-muted-foreground hover:text-white transition-colors">
                        <FiX size={20} />
                    </button>
                </div>
                <div className="p-4 border-b border-white/5 flex flex-col gap-3">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={15} />
                        <input
                            type="text"
                            value={modalSearch}
                            onChange={(e) => setModalSearch(e.target.value)}
                            placeholder="Search recipes..."
                            autoFocus
                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                        />
                        {modalSearch && (
                            <button
                                onClick={() => setModalSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-white transition-colors"
                            >
                                <FiX size={14} />
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={modalOnlySnacks}
                                onChange={(e) => setModalOnlySnacks(e.target.checked)}
                                className="hidden"
                            />
                            <FiFilter className="text-amber-400" />
                            <span>Only snacks</span>
                        </label>
                        <div className="flex items-center gap-1 flex-wrap">
                            {MEALS.map(m => (
                                <button
                                    key={m}
                                    onClick={() => toggleMealFilter(m)}
                                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border transition-colors ${modalMealFilters.has(m) ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white'}`}
                                >
                                    {m}
                                </button>
                            ))}
                            {modalMealFilters.size > 0 && (
                                <button
                                    onClick={() => setModalMealFilters(new Set())}
                                    className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Group by</span>
                        {[['carb', 'Carb type'], ['meal', 'Meal type'], ['genre', 'Genre']].map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setModalGroupBy(key)}
                                className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border transition-colors ${modalGroupBy === key ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-4 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
                    {Object.keys(grouped).length === 0 && (
                        <div className="text-center py-10 text-muted-foreground/60 text-xs font-bold uppercase tracking-widest">
                            {searchTerm ? `No recipes match "${modalSearch.trim()}"` : 'No recipes match your filters'}
                        </div>
                    )}
                    {Object.entries(grouped).sort(([a], [b]) => sortGroupKeys(a, b)).map(([group, recipes]) => (
                        <div key={group}>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
                                {group}
                                <span className="flex-1 h-px bg-white/5"></span>
                            </h3>
                            <div className="space-y-2">
                                {(recipes as any[]).map(r => (
                                    <label key={r._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-white/5 hover:border-white/10 transition-all group">
                                        <input
                                            type="checkbox"
                                            checked={modalSelectedRecipeIds.has(r._id)}
                                            onChange={() => handleToggleModalRecipe(r._id)}
                                            className="w-5 h-5 rounded-lg border-white/20 bg-black/50 text-emerald-500 focus:ring-emerald-500/50 shrink-0"
                                        />
                                        {r.image ? (
                                            <img src={r.image} alt={r.name} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-white/10" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                                <FiCoffee className="text-muted-foreground/40" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm group-hover:text-emerald-400 transition-colors">{r.name}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">People: {r.servings || 1} • {r.genre || 'General'}{isSnackRecipe(r) ? ' • Snack' : ''}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                    <button onClick={closeModal} className="px-4 py-2 rounded-lg font-bold text-muted-foreground hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                    <button onClick={confirmModalRecipes} className="px-6 py-2 rounded-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shadow-lg shadow-emerald-500/20">
                        Add {modalSelectedRecipeIds.size} {targetLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
