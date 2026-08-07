import { useEffect, useState } from 'react';
import { FiCoffee, FiTrash2, FiPlus } from 'react-icons/fi';
import { usePlanner } from '../planner/PlannerContext';
import SearchableDropdown from '../SearchableDropdown';

const TOKEN_HEADER = 'edgetoken';

type QtyMode = 'total' | 'perDay' | 'perPerson';

const MODES: { key: QtyMode; label: string }[] = [
    { key: 'total', label: 'Total' },
    { key: 'perDay', label: 'Per day' },
    { key: 'perPerson', label: 'Per person' }
];

function PantryItemRow({ item, idx, numDays, defaultServings }: {
    item: any;
    idx: number;
    numDays: number;
    defaultServings: number;
}) {
    const { updateEverydayQty, updateEverydayUnit, removeEverydayItem } = usePlanner();
    const [mode, setMode] = useState<QtyMode>('perDay');

    const people = Math.max(1, defaultServings);
    const total = Number(item.quantity) || 0;
    const perDay = total / numDays;
    const perPersonPerDay = perDay / people;
    const isIngredient = !item.recipe_id;
    const unit = item.quantity_unit || 'each';
    const unitSuffix = unit === 'grams' ? 'g' : '';

    const valueFor = (m: QtyMode) => {
        if (m === 'total') return Math.round(total * 100) / 100;
        if (m === 'perDay') return Math.round(perDay * 100) / 100;
        return Math.round(perPersonPerDay * 100) / 100;
    };

    const onQtyChange = (raw: string) => {
        const v = parseFloat(raw) || 0;
        if (mode === 'total') updateEverydayQty(idx, v);
        else if (mode === 'perDay') updateEverydayQty(idx, v * numDays);
        else updateEverydayQty(idx, v * people * numDays);
    };

    return (
        <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg border border-white/5">
            <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={valueFor(mode)}
                        onChange={e => onQtyChange(e.target.value)}
                        className="w-16 bg-background border border-white/10 rounded-lg px-2 text-sm"
                        title={`Quantity per ${mode === 'total' ? 'period' : mode === 'perDay' ? 'day' : 'person per day'}`}
                    />
                    <div className="flex rounded-md overflow-hidden border border-white/10">
                        {MODES.map(m => (
                            <button
                                key={m.key}
                                onClick={() => setMode(m.key)}
                                className={`text-[9px] font-black px-1.5 py-0.5 transition-colors ${mode === m.key ? 'bg-emerald-500/30 text-emerald-200' : 'bg-black/20 text-muted-foreground'}`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    {isIngredient && (
                        <div className="flex rounded-md overflow-hidden border border-white/10">
                            <button
                                onClick={() => updateEverydayUnit(idx, 'each')}
                                className={`text-[9px] font-black px-1.5 py-0.5 transition-colors ${unit === 'each' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-black/20 text-muted-foreground'}`}
                            >
                                each
                            </button>
                            <button
                                onClick={() => updateEverydayUnit(idx, 'grams')}
                                className={`text-[9px] font-black px-1.5 py-0.5 transition-colors ${unit === 'grams' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-black/20 text-muted-foreground'}`}
                            >
                                grams
                            </button>
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">
                        {Math.round(total * 10) / 10}{unitSuffix} total · {Math.round(perDay * 100) / 100}{unitSuffix}/day · {Math.round(perPersonPerDay * 100) / 100}{unitSuffix}/person/day
                    </div>
                </div>
            </div>
            <button onClick={() => removeEverydayItem(idx)} className="text-rose-500 hover:text-rose-400 p-1">
                <FiTrash2 size={14} />
            </button>
        </div>
    );
}

export default function PantryPanel() {
    const {
        plan,
        numDays,
        addEverydayItem,
        addEverydayIngredient,
        newEverydayQty,
        setNewEverydayQty,
        openModal,
        recipeOptions
    } = usePlanner();

    const [ingredientText, setIngredientText] = useState('');
    const [ingredientNames, setIngredientNames] = useState<string[]>([]);

    useEffect(() => {
        const token = localStorage.getItem('Token');
        fetch('/api/Ingredients/list', {
            headers: token ? { [TOKEN_HEADER]: token } : {}
        })
            .then(r => r.json())
            .then(d => { if (d?.success) setIngredientNames(d.data || []); })
            .catch(() => {});
    }, []);

    const addIngredient = () => {
        const name = ingredientText.trim();
        if (!name) return;
        addEverydayIngredient(name);
        setIngredientText('');
    };

    return (
        <div className="glass-card relative z-40 p-4">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-emerald-400">
                <FiCoffee /> Pantry Pool
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Quantities are period totals. Pick a unit to edit — the others update automatically.</p>

            <div className="space-y-2 mb-4">
                {plan.everydayItems.length === 0 ? (
                    <div className="text-center p-3 border border-dashed border-white/10 rounded-xl text-muted-foreground/50 text-xs font-bold uppercase tracking-widest">
                        Pool Empty
                    </div>
                ) : (
                    plan.everydayItems.map((item, idx) => (
                        <PantryItemRow key={idx} item={item} idx={idx} numDays={numDays} defaultServings={plan.defaultServings} />
                    ))
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
                            placeholder="Add a recipe to pantry..."
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

                <div className="border-t border-white/10 pt-3 mt-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Or add an ingredient (no recipe needed)
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <input
                                list="pantry-ingredients"
                                value={ingredientText}
                                onChange={e => setIngredientText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addIngredient(); }}
                                placeholder="e.g. bananas, apples..."
                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm"
                                autoComplete="off"
                            />
                            <datalist id="pantry-ingredients">
                                {ingredientNames.map(n => <option key={n} value={n} />)}
                            </datalist>
                        </div>
                        <button
                            onClick={addIngredient}
                            title="Add ingredient"
                            className="px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 transition-colors flex items-center"
                        >
                            <FiPlus size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
