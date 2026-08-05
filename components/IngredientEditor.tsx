import { useState, useEffect, useId, useRef } from 'react'
import { quantity_unit_conversions } from '../lib/conversion'
import { Ingredient } from '../lib/recipeExtraction'
import { RiDeleteBin7Line, RiAddLine } from 'react-icons/ri'

const PACKAGE_UNITS = ["can", "bottle", "package", "stick", "bunch", "head", "stalk", "stem", "bag", "box", "tray", "tub"]
const UNIT_OPTIONS = Object.keys(quantity_unit_conversions).filter(item => !PACKAGE_UNITS.includes(item))

interface IngredientEditorProps {
    ingredients: Ingredient[]
    onChange: (next: Ingredient[]) => void
    autoDefaults?: boolean
    className?: string
}

const inputClass = "w-full bg-white/[0.06] border border-white/10 rounded-xl px-3.5 py-3 text-sm font-semibold text-white placeholder:text-white/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 transition-all [&>option]:text-black"

const emptyDraft = (): Ingredient => ({ Name: '', Amount: 1, AmountType: 'each', Note: '' })

export default function IngredientEditor({ ingredients, onChange, autoDefaults = false, className = '' }: IngredientEditorProps) {
    const [draft, setDraft] = useState<Ingredient>(emptyDraft())
    const [knownIngredients, setKnownIngredients] = useState<string[]>([])
    const [aiLoading, setAiLoading] = useState(false)
    const datalistId = useId()
    const userChangedFields = useRef(false)

    useEffect(() => {
        const token = localStorage.getItem('Token')
        if (!token) return
        fetch('/api/Ingredients/defaults', { headers: { 'edgetoken': token } })
            .then(r => r.json())
            .then(d => { if (d.success) setKnownIngredients(d.data || []) })
            .catch(() => {})
    }, [])

    const updateIngredient = (index: number, patch: Partial<Ingredient>) => {
        onChange(ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)))
    }

    const removeIngredient = (index: number) => {
        onChange(ingredients.filter((_, i) => i !== index))
    }

    const fetchDefaults = async (name: string): Promise<{ quantity?: string | number, unit?: string }> => {
        const token = localStorage.getItem('Token')
        try {
            const response = await (await fetch(`/api/ShoppingListItem/options?search_term=${encodeURIComponent(name)}`, {
                headers: { 'edgetoken': token || '' }
            })).json()
            if (response.success && response.data) {
                const quantity = response.data.quantity?.[0]?.value
                const unit = response.data.quantity_type?.[0]?.value
                if (quantity != null || unit != null) return { quantity, unit }
            }
            const ai = await (await fetch(`/api/ai/determine_default_categories?search_term=${encodeURIComponent(name)}`, {
                headers: { 'edgetoken': token || '' }
            })).json()
            if (ai.success && ai.data) {
                return { quantity: ai.data.quantity, unit: ai.data.unit }
            }
        } catch (e) {
            console.log(e)
        }
        return {}
    }

    const handleAddIngredient = async () => {
        const name = draft.Name.trim()
        if (!name) return

        let resolved = draft
        if (autoDefaults && !userChangedFields.current) {
            setAiLoading(true)
            const defaults = await fetchDefaults(name)
            setAiLoading(false)
            resolved = {
                ...draft,
                Amount: defaults.quantity ?? draft.Amount ?? 1,
                AmountType: defaults.unit || draft.AmountType || 'each'
            }
        }

        onChange([...ingredients, { ...resolved, Name: name }])
        setDraft(emptyDraft())
        userChangedFields.current = false
    }

    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            <datalist id={datalistId}>
                {knownIngredients.map((k, i) => <option key={i} value={k} />)}
            </datalist>

            {ingredients.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center opacity-40 select-none">
                    <div className="text-4xl mb-3">🥫</div>
                    <p className="text-sm italic text-muted-foreground">Nothing in the pantry yet...</p>
                </div>
            ) : (
                <ul className="flex flex-col gap-3">
                    {ingredients.map((ing, i) => (
                        <li key={i} className="bg-white/[0.05] border border-white/10 rounded-2xl p-3.5 space-y-3">
                            <div className="flex items-center gap-2.5">
                                <input
                                    type="text"
                                    value={ing.Name}
                                    onChange={e => updateIngredient(i, { Name: e.target.value })}
                                    placeholder="Ingredient name"
                                    className={inputClass}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeIngredient(i)}
                                    className="shrink-0 p-3 rounded-xl bg-white/[0.06] text-muted-foreground hover:text-white hover:bg-rose-500/60 transition-all"
                                    title="Remove ingredient"
                                >
                                    <RiDeleteBin7Line size={18} />
                                </button>
                            </div>
                            <div className="grid grid-cols-[90px_1fr_1fr] gap-2.5">
                                <input
                                    type="text"
                                    value={String(ing.Amount)}
                                    onChange={e => updateIngredient(i, { Amount: e.target.value })}
                                    placeholder="Amount"
                                    className={inputClass}
                                />
                                <select
                                    value={ing.AmountType}
                                    onChange={e => updateIngredient(i, { AmountType: e.target.value })}
                                    className={inputClass}
                                >
                                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <input
                                    type="text"
                                    value={ing.Note || ''}
                                    onChange={e => updateIngredient(i, { Note: e.target.value })}
                                    placeholder="Note"
                                    className={inputClass}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <div className="bg-white/[0.04] border border-dashed border-white/15 rounded-2xl p-3.5 space-y-2.5">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Add Ingredient</div>
                <input
                    type="text"
                    value={draft.Name}
                    onChange={e => setDraft({ ...draft, Name: e.target.value })}
                    list={datalistId}
                    placeholder="Ingredient name"
                    className={inputClass}
                />
                <div className="grid grid-cols-[90px_1fr] gap-2.5">
                    <input
                        type="text"
                        value={String(draft.Amount)}
                        onChange={e => { userChangedFields.current = true; setDraft({ ...draft, Amount: e.target.value }) }}
                        placeholder="Amount"
                        className={inputClass}
                    />
                    <select
                        value={draft.AmountType}
                        onChange={e => { userChangedFields.current = true; setDraft({ ...draft, AmountType: e.target.value }) }}
                        className={inputClass}
                    >
                        {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2.5">
                    <input
                        type="text"
                        value={draft.Note || ''}
                        onChange={e => setDraft({ ...draft, Note: e.target.value })}
                        placeholder="Note (optional)"
                        className={inputClass}
                    />
                    <button
                        type="button"
                        onClick={handleAddIngredient}
                        disabled={aiLoading || !draft.Name.trim()}
                        className="shrink-0 flex items-center gap-1.5 px-5 py-3 rounded-xl bg-emerald-500 text-black text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition-all disabled:opacity-40"
                    >
                        {aiLoading ? <span className="inline-block w-4 h-4 border-2 border-black/40 border-t-transparent rounded-full animate-spin" /> : <RiAddLine size={16} />}
                        Add
                    </button>
                </div>
            </div>
        </div>
    )
}
