import { useState, useEffect, useRef, useCallback } from 'react'
import { quantity_unit_conversions, convertToStandardUnit } from '../lib/conversion'
import { normalizePrepWords } from '../lib/recipeNormalize'
import { Ingredient } from '../lib/recipeExtraction'
import SearchableDropdown from './SearchableDropdown'
import { Loader2, Minus, Plus, Search, Check } from 'lucide-react'

const PACKAGE_UNITS = ["can", "bottle", "package", "stick", "bunch", "head", "stalk", "stem", "bag", "box", "tray", "tub"]
const UNIT_OPTIONS = Object.keys(quantity_unit_conversions).filter(item => !PACKAGE_UNITS.includes(item))

interface RecipeIngredientInputProps {
    onAdd: (ingred: Ingredient) => void
    disabled?: boolean
}

// Recipe ingredient entry using the same flow as adding an item to a
// shopping list: type a name, the app resolves amount + unit (category is
// resolved internally by the endpoints but never shown), fields reveal
// progressively, then the ingredient joins the recipe.
export default function RecipeIngredientInput({ onAdd, disabled = false }: RecipeIngredientInputProps) {
    const [name, setName] = useState("")
    const [quantity, setQuantity] = useState<string | number>(1)
    const [quantityType, setQuantityType] = useState("each")
    const [note, setNote] = useState("")

    const [knownIngredients, setKnownIngredients] = useState<string[]>([])
    const [isAiLoading, setIsAiLoading] = useState(false)
    const [fieldsRevealed, setFieldsRevealed] = useState(false)
    const [showCancelOption, setShowCancelOption] = useState(false)

    const userChangedFields = useRef(false)
    const submitIntentRef = useRef(false)
    const lookupGenRef = useRef(0)
    const abortRef = useRef<AbortController | null>(null)
    const slowTimerRef = useRef<any>(null)

    const resetForm = () => {
        setName("")
        setQuantity(1)
        setQuantityType("each")
        setNote("")
        setFieldsRevealed(false)
        userChangedFields.current = false
    }

    const cancelLookup = () => {
        if (abortRef.current) abortRef.current.abort()
        if (slowTimerRef.current) { clearTimeout(slowTimerRef.current); slowTimerRef.current = null; }
        setIsAiLoading(false)
        setShowCancelOption(false)
        setFieldsRevealed(true)
        userChangedFields.current = true
    }

    const adjustQuantity = (delta: number) => {
        const current = parseFloat(String(quantity))
        const base = isNaN(current) ? 0 : current
        setQuantity(Math.max(0, Math.round((base + delta) * 100) / 100))
        userChangedFields.current = true
    }

    const handleChange = (e: any) => {
        const { name: fieldName, value, option } = e.target
        if (fieldName !== 'ingredientName') return
        setName(value)
        if (option) {
            startItemLookup(value)
        }
    }

    const handleNameSubmit = (nameOverride?: string) => {
        if (submitIntentRef.current) {
            submitIntentRef.current = false
            return
        }
        const nameToUse = typeof nameOverride === 'string' ? nameOverride : name
        if (!nameToUse) return
        // Already showing this item's fields — keep whatever the user edited
        if (fieldsRevealed && nameToUse === name) return
        // Same lookup already running — let it finish
        if (isAiLoading && nameToUse === name) return
        startItemLookup(nameToUse)
    }

    // Begin a fresh lookup: reset the resolved values so what's shown always
    // belongs to the item being searched
    const startItemLookup = (nextName: string) => {
        setFieldsRevealed(false)
        userChangedFields.current = false
        setName(nextName)
        setQuantity(1)
        setQuantityType("each")
        determineDefaults(nextName)
    }

    // Resolve amount + unit from the database first, then AI. The category is
    // returned by both endpoints but intentionally ignored — recipes don't use it.
    const determineDefaults = async (searchName: string) => {
        const gen = ++lookupGenRef.current
        const controller = new AbortController()
        abortRef.current = controller

        const isStale = () => lookupGenRef.current !== gen || controller.signal.aborted
        const clearSlowTimer = () => {
            if (slowTimerRef.current) { clearTimeout(slowTimerRef.current); slowTimerRef.current = null; }
        }

        setIsAiLoading(true)
        setShowCancelOption(false)
        // After 1 second of waiting, offer to cancel and enter the details manually
        slowTimerRef.current = setTimeout(() => {
            if (lookupGenRef.current === gen && !controller.signal.aborted) setShowCancelOption(true)
        }, 1000)

        const token = localStorage.getItem('Token')
        try {
            const response = await (await fetch(`/api/ShoppingListItem/options?search_term=${encodeURIComponent(searchName)}`, {
                headers: { 'edgetoken': token || "" },
                signal: controller.signal
            })).json()

            if (isStale()) return
            clearSlowTimer()

            const dbQuantity = response?.data?.quantity?.[0]?.value
            const dbUnit = response?.data?.quantity_type?.[0]?.value
            if (response?.success && (dbQuantity != null || dbUnit != null)) {
                if (dbQuantity != null) setQuantity(dbQuantity)
                if (dbUnit != null) setQuantityType(dbUnit)
                setFieldsRevealed(true)
                setIsAiLoading(false)
            } else {
                // No stored defaults — reveal the form and let AI refine in the background
                setFieldsRevealed(true)
                userChangedFields.current = false

                fetch(`/api/ai/determine_default_categories?search_term=${encodeURIComponent(searchName)}`, {
                    headers: { 'edgetoken': token || "" },
                    signal: controller.signal
                }).then(res => res.json()).then(aiResponse => {
                    if (isStale() || userChangedFields.current) return
                    if (aiResponse?.success && aiResponse?.data) {
                        const { quantity: aiQuantity, unit } = aiResponse.data
                        if (aiQuantity != null) setQuantity(aiQuantity)
                        if (unit != null) setQuantityType(unit)
                    }
                }).catch(error => {
                    if (!controller.signal.aborted) console.log(error)
                }).finally(() => {
                    if (lookupGenRef.current === gen && !controller.signal.aborted) {
                        setIsAiLoading(false)
                        setShowCancelOption(false)
                    }
                })
            }
        } catch (error) {
            if (isStale()) return
            clearSlowTimer()
            setFieldsRevealed(true)
            setIsAiLoading(false)
        }
    }

    const searchIngredientDatabase = useCallback(async (q: string, signal?: AbortSignal) => {
        try {
            const token = localStorage.getItem('Token')
            const response = await (await fetch(`/api/Ingredients/suggest?q=${encodeURIComponent(q)}`, {
                headers: { 'edgetoken': token || "" },
                signal
            })).json()
            return response.success ? response.data : []
        } catch (error) {
            return []
        }
    }, [])

    useEffect(() => {
        const token = localStorage.getItem('Token')
        if (!token) return
        fetch('/api/Ingredients/defaults', { headers: { 'edgetoken': token } })
            .then(r => r.json())
            .then(d => { if (d.success) setKnownIngredients(d.data || []) })
            .catch(() => {})
    }, [])

    useEffect(() => () => {
        if (abortRef.current) abortRef.current.abort()
        if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    }, [])

    const handleAdd = () => {
        if (disabled) return
        const trimmedName = name.trim()
        if (!trimmedName) return

        if (!fieldsRevealed && !isAiLoading) {
            handleNameSubmit()
            return
        }

        // Standardise the unit the same way the rest of the app does: unknown
        // units resolve to 'each' and the original text is preserved in the note.
        const standard = convertToStandardUnit(quantityType, quantity ?? 1)
        const mergedNote = [standard.note, note.trim()].filter(Boolean).join(', ')

        // Move leading prep words out of the name ("chopped garlic" ->
        // garlic + note "chopped") so the name stays matchable for
        // pricing/nutrition and the details live in the note
        const [normalized] = normalizePrepWords([{
            Name: trimmedName,
            Amount: standard.amount ?? 1,
            AmountType: standard.unit || 'each',
            Note: mergedNote || undefined
        }])

        onAdd(normalized)
        resetForm()

        // Refocus the name field for rapid consecutive entry
        setTimeout(() => {
            document.querySelector<HTMLInputElement>('input[name="ingredientName"]')?.focus()
        }, 60)
    }

    // Solid var colours only — opacity modifiers on var()-based tokens don't
    // compile in this Tailwind setup (bg-secondary/60 etc. emit no CSS)
    const fieldInputClass = "w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:border-accent transition-all [&>option]:text-black"

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); handleAdd() }}
            className="rounded-2xl bg-secondary p-3.5 sm:p-4 space-y-3"
        >
            <div className="flex flex-col gap-1.5">
                <div className="relative">
                    <SearchableDropdown
                        options={knownIngredients}
                        placeholder="What are we adding?"
                        onChange={handleChange}
                        name="ingredientName"
                        value={name}
                        onComplete={handleNameSubmit}
                        remoteSearch={searchIngredientDatabase}
                    />
                </div>
                <p className="text-[11px] text-muted-foreground ml-1">Amount and unit fill in automatically — adjust if needed.</p>
            </div>

            {isAiLoading && (
                <div className="flex flex-col items-center gap-2.5 px-4 py-4 rounded-xl bg-background animate-in fade-in duration-300">
                    <div className="flex items-center gap-2.5">
                        <Loader2 size={14} className="animate-spin text-accent shrink-0" />
                        <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider text-center">
                            Looking up {name ? `"${name}"` : 'details'}…
                        </span>
                    </div>
                    {showCancelOption && (
                        <button
                            type="button"
                            onClick={cancelLookup}
                            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border hover:border-accent rounded-full px-4 py-2.5 transition-all active:scale-95 animate-in fade-in duration-300 min-h-[38px]"
                        >
                            Cancel — enter manually
                        </button>
                    )}
                </div>
            )}

            {fieldsRevealed && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Amount</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="Amount"
                                    value={String(quantity)}
                                    onChange={(e) => { userChangedFields.current = true; setQuantity(e.target.value) }}
                                    className={`${fieldInputClass} !pr-24`}
                                />
                                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => adjustQuantity(-1)}
                                        className="h-8 w-8 rounded-lg bg-background hover:bg-border border border-border text-muted-foreground hover:text-foreground flex items-center justify-center active:scale-90 transition-all"
                                        tabIndex={-1}
                                        aria-label="Decrease amount"
                                    >
                                        <Minus size={13} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => adjustQuantity(1)}
                                        className="h-8 w-8 rounded-lg bg-background hover:bg-border border border-border text-muted-foreground hover:text-foreground flex items-center justify-center active:scale-90 transition-all"
                                        tabIndex={-1}
                                        aria-label="Increase amount"
                                    >
                                        <Plus size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Unit</label>
                            <select
                                value={quantityType}
                                onChange={(e) => { userChangedFields.current = true; setQuantityType(e.target.value) }}
                                className={fieldInputClass}
                            >
                                {(UNIT_OPTIONS.includes(quantityType) ? UNIT_OPTIONS : [quantityType, ...UNIT_OPTIONS]).map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Prep work &amp; notes (optional)</label>
                        <input
                            type="text"
                            placeholder="e.g. chopped, finely diced, at room temperature…"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className={fieldInputClass}
                        />
                        <p className="text-[11px] text-muted-foreground/70 ml-1">Prep words typed in the name (e.g. “chopped garlic”) move here automatically.</p>
                    </div>
                </div>
            )}

            <button
                type="submit"
                disabled={disabled || (!name.trim() && !fieldsRevealed)}
                onMouseDown={() => { submitIntentRef.current = true; }}
                className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${fieldsRevealed
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                    : 'bg-background hover:bg-border text-foreground border border-border'
                    } disabled:opacity-40`}
            >
                {isAiLoading ? (
                    <>
                        <Loader2 size={15} className="animate-spin" /> Resolving…
                    </>
                ) : fieldsRevealed ? (
                    <>
                        <Check size={15} /> Add ingredient
                    </>
                ) : (
                    <>
                        <Search size={15} /> Search
                    </>
                )}
            </button>
        </form>
    )
}
