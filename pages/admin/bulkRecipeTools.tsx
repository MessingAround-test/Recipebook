import { useEffect, useMemo, useState } from 'react'
import { useAdminGuard } from '../../lib/useAdminGuard'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { Check, X, Loader2 } from 'lucide-react'

type RecipeRow = {
    _id: string
    name: string
    ingredCount: number
    prepCount: number
    prepChecked: boolean
    timerCount: number
    timersChecked: boolean
    image?: boolean
}

type OpKind = 'normalize' | 'prep' | 'timers' | 'image'
type RowStatus = 'idle' | 'running' | 'done' | 'error'

const OPS: { op: OpKind; label: string; confirm?: (count: number) => string }[] = [
    {
        op: 'normalize',
        label: 'Normalise Ingredients',
        confirm: (count) => `Rewrite ingredients for ${count} selected recipe(s)?\n\nUnits get resolved to standard keys, prep words (e.g. "chopped") move from the name into the note. Ingredient names change – this cannot be undone.`
    },
    { op: 'prep', label: 'Extract Prep Steps' },
    { op: 'timers', label: 'Extract Timers' },
    {
        op: 'image',
        label: 'Generate Images',
        confirm: (count) => `Generate AI recipes art for ${count} selected recipe(s) via Pollinations (anonymous tier)?\n\nThis runs at ~1 image per 15s, so ${count} recipe(s) may take a while.`
    }
]

export default function BulkRecipeTools() {
    const isAuthorized = useAdminGuard()
    const [recipes, setRecipes] = useState<RecipeRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [status, setStatus] = useState<Record<string, RowStatus>>({})
    const [runningOp, setRunningOp] = useState<OpKind | null>(null)

    useEffect(() => {
        if (!isAuthorized) return
        fetchRecipes()
    }, [isAuthorized])

    const fetchRecipes = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/bulkRecipeOps', {
                headers: { 'edgetoken': localStorage.getItem('Token') || '' }
            })
            const data = await res.json()
            if (data.success && Array.isArray(data.data)) {
                setRecipes(data.data)
            } else {
                setError(data.message || 'Failed to load recipes')
            }
        } catch (e: any) {
            setError(e.message || 'Failed to load recipes')
        }
        setLoading(false)
    }

    const allSelected = recipes.length > 0 && recipes.every(r => selected.has(r._id))

    const toggleSelectAll = () => {
        if (allSelected) setSelected(new Set())
        else setSelected(new Set(recipes.map(r => r._id)))
    }

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const hasPrep = (r: RecipeRow) => r.prepCount > 0 || r.prepChecked === true
    const hasTimers = (r: RecipeRow) => r.timerCount > 0 || r.timersChecked === true
    const hasImage = (r: RecipeRow) => r.image === true

    // Column header click: select every recipe that does NOT have a tick on that column
    const selectMissing = (col: 'ingred' | 'prep' | 'timers' | 'image') => {
        const missing = recipes.filter(r =>
            col === 'ingred' ? r.ingredCount === 0
            : col === 'prep' ? !hasPrep(r)
            : col === 'timers' ? !hasTimers(r)
            : !hasImage(r)
        )
        if (missing.length === 0) {
            alert(`All recipes already have ${col === 'ingred' ? 'ingredients' : col} ticks`)
            return
        }
        setSelected(new Set(missing.map(r => r._id)))
    }

    const selectedIds = useMemo(() => recipes.filter(r => selected.has(r._id)).map(r => r._id), [recipes, selected])

    const runOp = async (op: OpKind) => {
        const targets = selectedIds
        if (targets.length === 0) {
            alert('Select at least one recipe first')
            return
        }
        const opMeta = OPS.find(o => o.op === op)!
        if (opMeta.confirm && !confirm(opMeta.confirm(targets.length))) return

        setRunningOp(op)
        let ok = 0
        let failed = 0
        for (const id of targets) {
            setStatus(prev => ({ ...prev, [id]: 'running' }))
            try {
                const res = await fetch('/api/admin/bulkRecipeOps', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'edgetoken': localStorage.getItem('Token') || ''
                    },
                    body: JSON.stringify({ recipeId: id, op })
                })
                const data = await res.json()
                if (data.success) {
                    ok++
                    setStatus(prev => ({ ...prev, [id]: 'done' }))
                    setRecipes(prev => prev.map(r => r._id === id
                        ? { ...r,
                            ...(data.hasPrep !== undefined ? { prepChecked: data.hasPrep } : {}),
                            ...(data.hasTimers !== undefined ? { timersChecked: data.hasTimers } : {}),
                            ...(data.hasImage !== undefined ? { image: data.hasImage } : {})
                        }
                        : r))
                } else {
                    failed++
                    setStatus(prev => ({ ...prev, [id]: 'error' }))
                    console.error(`Op ${op} failed for recipe ${id}:`, data.message)
                }
            } catch (e: any) {
                failed++
                setStatus(prev => ({ ...prev, [id]: 'error' }))
                console.error(e)
            }
        }
        setRunningOp(null)
        if (failed > 0) alert(`${ok} succeeded, ${failed} failed. Rows marked with an X errored — check the console for details.`)
        fetchRecipes()
    }

    if (!isAuthorized) return null

    return (
        <Layout title="Bulk Recipe Tools" description="Bulk normalise ingredients and extract prep/timers across recipes">
            <div className="max-w-6xl mx-auto mt-8 px-4 pb-16">
                <PageHeader title="Bulk Recipe Tools" />

                <div className="flex flex-wrap items-center gap-3 my-4">
                    {OPS.map(({ op, label }) => (
                        <button
                            key={op}
                            onClick={() => runOp(op)}
                            disabled={loading || runningOp !== null || selectedIds.length === 0}
                            className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {runningOp === op && <Loader2 size={14} className="animate-spin" />}
                            {label}
                        </button>
                    ))}
                    <span className="text-xs text-muted-foreground">
                        {runningOp ? `Running… (${selectedIds.length} selected)` : `${selectedIds.length} selected`}
                    </span>
                    <button
                        onClick={fetchRecipes}
                        disabled={runningOp !== null}
                        className="ml-auto text-xs text-muted-foreground underline hover:text-white disabled:opacity-40"
                    >
                        Refresh
                    </button>
                </div>

                {error && <div className="my-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}

                {loading ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">Loading recipes…</div>
                ) : (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-white/[0.04] text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                                    <th className="px-3 py-2.5 w-10">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleSelectAll}
                                            className="accent-emerald-500 cursor-pointer"
                                            aria-label="Select all recipes"
                                        />
                                    </th>
                                    <th className="px-3 py-2.5">Recipe</th>
                                    <th
                                        onClick={() => selectMissing('ingred')}
                                        title="Click to select all recipes without ingredients"
                                        className="px-3 py-2.5 w-24 text-center cursor-pointer select-none underline decoration-dotted underline-offset-4 hover:text-white transition-colors"
                                    >Ingredients</th>
                                    <th
                                        onClick={() => selectMissing('prep')}
                                        title="Click to select all recipes without prep work"
                                        className="px-3 py-2.5 w-20 text-center cursor-pointer select-none underline decoration-dotted underline-offset-4 hover:text-white transition-colors"
                                    >Prep</th>
                                    <th
                                        onClick={() => selectMissing('timers')}
                                        title="Click to select all recipes without timers"
                                        className="px-3 py-2.5 w-20 text-center cursor-pointer select-none underline decoration-dotted underline-offset-4 hover:text-white transition-colors"
                                    >Timing</th>
                                    <th
                                        onClick={() => selectMissing('image')}
                                        title="Click to select all recipes without an image"
                                        className="px-3 py-2.5 w-20 text-center cursor-pointer select-none underline decoration-dotted underline-offset-4 hover:text-white transition-colors"
                                    >Image</th>
                                    <th className="px-3 py-2.5 w-20 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recipes.map(recipe => (
                                    <tr key={recipe._id} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(recipe._id)}
                                                onChange={() => toggleSelect(recipe._id)}
                                                className="accent-emerald-500 cursor-pointer"
                                                aria-label={`Select ${recipe.name}`}
                                            />
                                        </td>
                                        <td className="px-3 py-2 font-semibold">{recipe.name}</td>
                                        <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{recipe.ingredCount}</td>
                                        <td className="px-3 py-2 text-center">
                                            {hasPrep(recipe)
                                                ? <Check size={16} className="inline text-emerald-400" strokeWidth={3} />
                                                : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {hasTimers(recipe)
                                                ? <Check size={16} className="inline text-emerald-400" strokeWidth={3} />
                                                : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {hasImage(recipe)
                                                ? <Check size={16} className="inline text-emerald-400" strokeWidth={3} />
                                                : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {status[recipe._id] === 'running' && <Loader2 size={14} className="inline animate-spin text-primary" />}
                                            {status[recipe._id] === 'done' && <Check size={14} className="inline text-emerald-400" strokeWidth={3} />}
                                            {status[recipe._id] === 'error' && <X size={14} className="inline text-rose-400" strokeWidth={3} />}
                                        </td>
                                    </tr>
                                ))}
                                {recipes.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No recipes found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                    Prep / Timing / Image ticks mean the recipe already has prep work / timers / AI art saved.
                    Extract ops overwrite existing data. Normalise rewrites ingredient names/units and moves prep words into notes.
                    Click a column heading to select all recipes missing that item.
                    Image generation uses the Pollinations anonymous tier (~15s per image) with Gemini fallback.
                </p>
            </div>
        </Layout>
    )
}
