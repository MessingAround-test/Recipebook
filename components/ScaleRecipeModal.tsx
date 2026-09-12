import { useEffect, useState } from 'react'
import Modal from 'react-modal'
import { Scale, Users, Package, Minus, Plus } from 'lucide-react'
import { normalizeToGrams, formatWeight, resolveUnitKey, quantity_unit_conversions } from '../lib/conversion'
import { formatWeightImperial } from '../lib/unitDisplay'

export interface ScaleIngredientOption {
    name: string
    qty: number
    unit: string
    gramsPerEach: number
}

type ScaleTab = 'weight' | 'servings' | 'ingredient'

const QUICK_MULTIPLES = [0.5, 1.5, 2, 3]
const QUICK_SERVES = [1, 2, 4, 6, 8]

interface ScaleRecipeModalProps {
    isOpen: boolean
    onClose: () => void
    onApply: () => void
    pendingGrams: number | null
    onPendingGrams: (grams: number) => void
    scaleFactor: number
    baseWeight: number
    weightResolvedCount: number
    weightTotalCount: number
    baseServings: number
    unitSystem: 'metric' | 'imperial'
    ingredientOptions: ScaleIngredientOption[]
}

function roundForInput(n: number) {
    return Math.round(n * 100) / 100
}

// The ingredient-tab alternative unit is dimension-aware and follows the
// user's system preference:
//   weight-type units  -> g on metric / lb on imperial
//   volume-type units  -> ml on metric / fl oz on imperial (cup, tbsp... DO
//                          convert, unlike weights-to-grams estimates)
//   count/other units  -> g/lb estimate, only when a grams-per-each exists
// Ratio math always runs in one shared base: grams for weight, millilitres
// for volume (normalizeToGrams returns those numeric bases).
const G_PER_LB = 453.592
const ML_PER_FLOZ = 28.4131

interface IngredientConversion {
    argUnit: string    // what the dropdown offers ("g", "lb", "ml"...)
    argFactor: number  // grams (or ml) per one arg unit
    grams: number      // recipe amount in the shared base (g for weight, ml for volume)
    resolved: string   // canonical key of the recipe unit
    defType: string    // 'weight' | 'volume' | 'each'
}

function ingredientConversion(opt: ScaleIngredientOption | undefined, unitSystem: 'metric' | 'imperial'): IngredientConversion | null {
    if (!opt) return null
    const resolved = resolveUnitKey(opt.unit)
    const def = quantity_unit_conversions[resolved] as { type: string } | undefined
    const defType = def ? def.type : 'each'
    let argUnit: string
    let argFactor: number
    let weighable: boolean
    if (defType === 'weight') {
        argUnit = unitSystem === 'imperial' ? 'lb' : 'g'
        argFactor = unitSystem === 'imperial' ? G_PER_LB : 1
        weighable = true
    } else if (defType === 'volume') {
        argUnit = unitSystem === 'imperial' ? 'fl oz' : 'ml'
        argFactor = unitSystem === 'imperial' ? ML_PER_FLOZ : 1
        weighable = true
    } else {
        argUnit = unitSystem === 'imperial' ? 'lb' : 'g'
        argFactor = unitSystem === 'imperial' ? G_PER_LB : 1
        weighable = (opt.gramsPerEach || 0) > 0
    }
    const grams = weighable ? normalizeToGrams(opt.unit, opt.qty, opt.gramsPerEach).value : null
    if (!weighable || typeof grams !== 'number' || !(grams > 0)) return null
    return { argUnit, argFactor, grams, resolved, defType }
}

// The recipe's own unit is the default unless the unit's system fights the
// user's preference — that only happens with weights: lb/oz on a metric
// cook's settings (or g/kg on an imperial cook's). Cups, tbsp, tsp, ml...
// always stay as the recipe writes them; the alternative unit is still one
// dropdown click away.
const UNITS_UNLIKE_PREF: Record<'metric' | 'imperial', string[]> = {
    metric: ['pound', 'ounce'],
    imperial: ['gram', 'kilogram']
}

function ingredientDraft(opt: ScaleIngredientOption | undefined, unitSystem: 'metric' | 'imperial'): { unit: 'same' | 'weight'; qty: string } {
    if (!opt) return { unit: 'same', qty: '' }
    const conv = ingredientConversion(opt, unitSystem)
    if (conv && UNITS_UNLIKE_PREF[unitSystem].includes(conv.resolved)) {
        return { unit: 'weight', qty: String(roundForInput(conv.grams / conv.argFactor)) }
    }
    return { unit: 'same', qty: String(opt.qty) }
}

export default function ScaleRecipeModal({
    isOpen,
    onClose,
    onApply,
    pendingGrams,
    onPendingGrams,
    scaleFactor,
    baseWeight,
    weightResolvedCount,
    weightTotalCount,
    baseServings,
    unitSystem,
    ingredientOptions
}: ScaleRecipeModalProps) {
    // Only tabs whose inputs are actually usable appear as choices.
    const availableTabs: ScaleTab[] = []
    if (baseWeight > 0) availableTabs.push('weight')
    if (baseServings > 0) availableTabs.push('servings')
    if (ingredientOptions.length > 0) availableTabs.push('ingredient')

    const [activeTab, setActiveTab] = useState<ScaleTab>('weight')
    const [ingIdx, setIngIdx] = useState(0)
    const [haveQty, setHaveQty] = useState('')
    const [haveUnit, setHaveUnit] = useState<'same' | 'weight'>('same')

    // Fresh draft each open: pick the first ingredient, prefill "the amount
    // you have" with what the recipe already calls for, and default to the
    // most natural tab (servings when known, otherwise whatever exists).
    useEffect(() => {
        if (!isOpen) return
        setIngIdx(0)
        const draft = ingredientDraft(ingredientOptions[0], unitSystem)
        setHaveUnit(draft.unit)
        setHaveQty(draft.qty)
        setActiveTab(baseServings > 0 ? 'servings' : (availableTabs[0] || 'ingredient'))
        // availableTabs is derived, not stable — reading it here is intentional
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // Draft math — ONE pending grams value drives the live preview no matter
    // which tab produced it, so weight / servings / ingredient agree.
    const pendingFactor = pendingGrams != null && baseWeight > 0 ? pendingGrams / baseWeight : (scaleFactor || 1)
    const pendingWeight = baseWeight * pendingFactor
    const pendingServings = baseServings > 0 ? Math.max(1, Math.round(baseServings * pendingFactor)) : 0
    const weightStep = Math.max(1, Math.round(baseWeight / 100))
    const isPendingScaled = pendingGrams != null && Math.abs(pendingFactor - 1) > 0.0001

    const selectedIng = ingredientOptions[ingIdx]
    // Original amount of the selected ingredient in the shared base (grams
    // for weight-type units, millilitres for volume-type) — lets the typed
    // "have" amount be turned into a ratio. null when not convertible.
    const selectedGrams = selectedIng
        ? normalizeToGrams(selectedIng.unit, selectedIng.qty, selectedIng.gramsPerEach).value
        : null

    // The alternative unit depends on the selected ingredient's quantity
    // dimension: weight -> g/lb, volume -> ml/fl oz, counts -> g/lb estimate.
    const conversion = selectedIng ? ingredientConversion(selectedIng, unitSystem) : null
    const argUnit = conversion ? conversion.argUnit : ''
    const argFactor = conversion ? conversion.argFactor : 1

    // Ratio of have / recipe-calls-for. Same-unit is exact; the alternative
    // unit converts to the shared base first (lb -> g, fl oz -> ml...) and
    // compares against the base value of the original amount.
    const haveNum = parseFloat(haveQty)
    let ingredientRatio: number | null = null
    if (selectedIng && haveNum > 0) {
        if (haveUnit === 'same') {
            ingredientRatio = haveNum / selectedIng.qty
        } else if (conversion && typeof selectedGrams === 'number' && selectedGrams > 0) {
            ingredientRatio = (haveNum * argFactor) / selectedGrams
        }
    }

    // The recipe's original amount expressed in whatever unit the "have"
    // field is currently in — used for prefill, quick pills and reset.
    const gramsPerOriginalUnit = selectedIng && typeof selectedGrams === 'number' && selectedIng.qty > 0
        ? selectedGrams / selectedIng.qty
        : null
    const origInHaveUnit = selectedIng
        ? roundForInput(haveUnit === 'same'
            ? selectedIng.qty
            : gramsPerOriginalUnit != null ? gramsPerOriginalUnit / argFactor : selectedIng.qty)
        : 0

    // Switching units keeps the physical amount on screen: convert the typed
    // value across (recipe original -> shared base -> target unit), falling
    // back to the recipe's original amount when the field is empty/unparsable.
    const switchHaveUnit = (next: 'same' | 'weight') => {
        if (!selectedIng || !conversion) return
        const cur = parseFloat(haveQty)
        if (gramsPerOriginalUnit != null && Number.isFinite(cur) && cur > 0) {
            const base = haveUnit === 'same' ? cur * gramsPerOriginalUnit : cur * argFactor
            const val = next === 'weight'
                ? roundForInput(base / argFactor)
                : roundForInput(base / gramsPerOriginalUnit)
            setHaveQty(String(val))
        } else {
            setHaveQty(String(origInHaveUnit))
        }
        setHaveUnit(next)
    }
    // Whenever the ingredient fields change (or the tab becomes active),
    // push the derived total grams so the other tabs and the footer preview
    // stay in sync with "the amount you have".
    useEffect(() => {
        if (!isOpen || activeTab !== 'ingredient') return
        if (selectedIng && ingredientRatio != null && ingredientRatio > 0 && baseWeight > 0) {
            onPendingGrams(baseWeight * ingredientRatio)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [haveQty, haveUnit, ingIdx, activeTab, isOpen])

    const previewWeight = unitSystem === 'imperial' ? formatWeightImperial(pendingWeight) : formatWeight(pendingWeight)
    const unweighedCount = Math.max(0, weightTotalCount - weightResolvedCount)

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            style={{
                content: {
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                    maxWidth: '360px',
                    width: 'calc(100% - 2rem)',
                    padding: '1rem 1.25rem 1.25rem',
                    borderRadius: '1rem',
                    top: '50%',
                    left: '50%',
                    right: 'auto',
                    bottom: 'auto',
                    transform: 'translate(-50%, -50%)',
                    maxHeight: 'calc(100vh - 2rem)',
                    overflowY: 'auto'
                },
                overlay: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 2000
                }
            }}
            contentLabel="Scale recipe"
        >
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-base font-bold flex items-center gap-2">
                    <Scale className="w-4 h-4 text-muted-foreground" /> Scale recipe
                </h2>
                <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>

            {availableTabs.length > 1 && (
                <div className="flex gap-1 bg-secondary rounded-lg p-1 mb-4">
                    {availableTabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 h-7 rounded-md text-xs font-semibold capitalize flex items-center justify-center gap-1.5 transition-colors ${activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {tab === 'weight' && <Scale className="w-3.5 h-3.5" />}
                            {tab === 'servings' && <Users className="w-3.5 h-3.5" />}
                            {tab === 'ingredient' && <Package className="w-3.5 h-3.5" />}
                            {tab}
                        </button>
                    ))}
                </div>
            )}

            {activeTab === 'weight' && baseWeight > 0 && (
                <>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target weight</span>
                        <span className="text-xs font-semibold tabular-nums text-foreground/80">{previewWeight}</span>
                    </div>
                    <input
                        type="range"
                        min={1}
                        max={baseWeight * 3}
                        step={weightStep}
                        value={Math.min(Math.max(pendingWeight, 1), baseWeight * 3)}
                        onChange={e => onPendingGrams(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer mb-2"
                        aria-label="Target weight slider"
                    />
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            type="number" min="1" inputMode="numeric"
                            value={Math.round(pendingWeight)}
                            onChange={e => onPendingGrams(Number(e.target.value))}
                            onKeyDown={e => { if (e.key === 'Enter') onApply() }}
                            className="w-24 bg-secondary focus:bg-card border border-border focus:border-accent outline-none rounded-md text-sm tabular-nums text-center px-2 py-1.5"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">g total</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                        {QUICK_MULTIPLES.map(m => (
                            <button
                                key={m}
                                onClick={() => onPendingGrams(baseWeight * m)}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${Math.abs(pendingFactor - m) < 0.0001 ? 'bg-emerald-500 text-white' : 'bg-secondary hover:bg-card border border-transparent hover:border-border text-foreground/80'}`}
                            >
                                {m}×
                            </button>
                        ))}
                    </div>
                    {unweighedCount > 0 && (
                        <p className="mt-2 text-[10px] text-muted-foreground">
                            Estimate — {unweighedCount} of {weightTotalCount} ingredients couldn't be weighed.
                        </p>
                    )}
                </>
            )}

            {activeTab === 'servings' && baseServings > 0 && (
                <>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Servings</span>
                        <span className="text-xs font-semibold tabular-nums text-foreground/80">{pendingServings}</span>
                    </div>
                    <input
                        type="range"
                        min={1}
                        max={Math.max(3, baseServings * 3)}
                        step={1}
                        value={Math.min(Math.max(pendingServings, 1), Math.max(3, baseServings * 3))}
                        onChange={e => onPendingGrams((Number(e.target.value) / baseServings) * baseWeight)}
                        className="w-full accent-emerald-500 cursor-pointer mb-2"
                        aria-label="Servings slider"
                    />
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={() => onPendingGrams(((pendingServings - 1) / baseServings) * baseWeight)}
                            className="w-8 h-8 rounded-md bg-secondary hover:bg-card flex items-center justify-center cursor-pointer" aria-label="Fewer servings"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                            type="number" min="1" inputMode="numeric"
                            value={pendingServings}
                            onChange={e => onPendingGrams((Number(e.target.value) / baseServings) * baseWeight)}
                            onKeyDown={e => { if (e.key === 'Enter') onApply() }}
                            className="w-16 bg-secondary focus:bg-card border border-border focus:border-accent outline-none rounded-md text-sm tabular-nums text-center px-2 py-1.5"
                        />
                        <button
                            onClick={() => onPendingGrams(((pendingServings + 1) / baseServings) * baseWeight)}
                            className="w-8 h-8 rounded-md bg-secondary hover:bg-card flex items-center justify-center cursor-pointer" aria-label="More servings"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                        {QUICK_SERVES.map(s => (
                            <button
                                key={s}
                                onClick={() => onPendingGrams((s / baseServings) * baseWeight)}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${pendingServings === s ? 'bg-emerald-500 text-white' : 'bg-secondary hover:bg-card border border-transparent hover:border-border text-foreground/80'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {activeTab === 'ingredient' && (
                <>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">I have this much…</span>
                    {selectedIng ? (
                        <>
                            <select
                                value={ingIdx}
                                onChange={e => {
                                    const idx = Number(e.target.value)
                                    setIngIdx(idx)
                                    const draft = ingredientDraft(ingredientOptions[idx], unitSystem)
                                    setHaveUnit(draft.unit)
                                    setHaveQty(draft.qty)
                                }}
                                className="w-full bg-secondary border border-border focus:border-accent outline-none rounded-md text-sm px-2 py-1.5 mb-2 [&>option]:bg-secondary [&>option]:text-foreground"
                                aria-label="Choose ingredient to scale from"
                            >
                                {ingredientOptions.map((opt, i) => (
                                    <option key={`${opt.name}-${i}`} value={i}>
                                        {opt.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-muted-foreground mb-2">
                                Recipe calls for {origInHaveUnit} {haveUnit === 'weight' ? argUnit : selectedIng.unit}
                            </p>
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="number"
                                    value={haveQty}
                                    inputMode="decimal"
                                    step="any"
                                    onChange={e => setHaveQty(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') onApply() }}
                                    min="0"
                                    placeholder={`Amount of ${selectedIng.name} you have`}
                                    className="w-28 bg-secondary focus:bg-card border border-border focus:border-accent outline-none rounded-md text-sm tabular-nums text-center px-2 py-1.5"
                                />
                                <select
                                    value={haveUnit}
                                    onChange={e => switchHaveUnit(e.target.value as 'same' | 'weight')}
                                    className="bg-secondary border border-border focus:border-accent outline-none rounded-md text-sm px-2 py-1.5 cursor-pointer [&>option]:bg-secondary [&>option]:text-foreground"
                                    aria-label="Unit"
                                >
                                    <option value="same">{selectedIng.unit}</option>
                                    {conversion && (
                                        <option value="weight">{argUnit}</option>
                                    )}
                                </select>
                                {selectedIng.qty > 0 && (
                                    <div className="ml-auto flex flex-wrap gap-1.5 justify-end">
                                        {QUICK_MULTIPLES.map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setHaveQty(String(origInHaveUnit * m))}
                                                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${ingredientRatio != null && Math.abs(ingredientRatio - m) < 0.005 ? 'bg-emerald-500 text-white' : 'bg-secondary hover:bg-card border border-transparent hover:border-border text-foreground/80'}`}
                                            >
                                                {m}×
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {haveUnit === 'weight' && conversion != null && conversion.defType === 'each' && (
                                <p className="text-[10px] text-muted-foreground">
                                    Estimate — the item weight is approximate; {conversion.argUnit} and {selectedIng.unit} are compared via grams per item.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground">No ingredients with amounts to scale from.</p>
                    )}
                </>
            )}

            {/* Footer: live preview + actions */}
            <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground tabular-nums min-w-0 truncate">
                    {baseWeight > 0 && (
                        <span>
                            ≈ {pendingServings > 0 ? `${pendingServings} serving${pendingServings === 1 ? '' : 's'} · ` : ''}
                            {previewWeight}
                        </span>
                    )}
                </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={() => {
                                // 1× everywhere: pending grams back to base, and
                                // the "amount you have" back to the recipe amount
                                // (in the preferred unit when systems differ)
                                if (baseWeight > 0) onPendingGrams(baseWeight)
                                if (selectedIng) {
                                    const draft = ingredientDraft(selectedIng, unitSystem)
                                    setHaveUnit(draft.unit)
                                    setHaveQty(draft.qty)
                                }
                            }}                            disabled={!isPendingScaled}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                            Reset to 1×
                        </button>
                    <button
                        onClick={onApply}
                        className={`h-9 px-5 rounded-md text-white text-xs font-bold transition-colors ${isPendingScaled ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-muted-foreground/40 hover:bg-muted-foreground/50'}`}
                    >
                        Apply scale
                    </button>
                </div>
            </div>
        </Modal>
    )
}
