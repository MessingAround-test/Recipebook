import { useEffect, useState } from 'react'
import { useAdminGuard } from '../../lib/useAdminGuard'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { Check, X, Loader2 } from 'lucide-react'

type MigrationRow = {
    _id: string
    name: string
    hasImage: boolean
    legacy: boolean
    legacyBytes: number
}

type TraceStatus = 'migrated' | 'skipped' | 'failed'
type Trace = {
    id: string
    name: string | null
    status: TraceStatus
    bytesBefore?: number
    error?: string
}

const fmtKB = (bytes: number) => bytes > 0 ? `${(bytes / 1024).toFixed(0)} KB` : '—'

export default function MigrateRecipeImages() {
    const isAuthorized = useAdminGuard()
    const [recipes, setRecipes] = useState<MigrationRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [running, setRunning] = useState(false)
    const [status, setStatus] = useState<Record<string, 'running' | 'migrated' | 'skipped' | 'failed'>>({})
    const [trace, setTrace] = useState<Trace[]>([])
    const [summary, setSummary] = useState('')

    useEffect(() => {
        if (!isAuthorized) return
        fetchRecipes()
    }, [isAuthorized])

    const fetchRecipes = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/migrateRecipeImages', {
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

    const pending = recipes.filter(r => r.legacy)

    const allSelected = pending.length > 0 && pending.every(r => selected.has(r._id))
    const toggleSelectAll = () => {
        if (allSelected) setSelected(new Set())
        else setSelected(new Set(pending.map(r => r._id)))
    }
    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    const selectAllLegacy = () => {
        const rows = recipes.filter(r => r.legacy)
        if (rows.length === 0) alert('Every recipe is already migrated')
        else setSelected(new Set(rows.map(r => r._id)))
    }

    const selectedIds = recipes.filter(r => selected.has(r._id)).map(r => r._id)

    const runMigration = async () => {
        if (selectedIds.length === 0) return
        if (!confirm(
            `Migrate inline images to the image collection for ${selectedIds.length} recipe(s)?\n\n` +
            'This reads each recipe\'s base64 image, stores full + thumbnail copies, and removes the inline field. This cannot be undone.'
        )) return

        setRunning(true)
        setTrace([])
        setSummary('')

        try {
            const res = await fetch('/api/admin/migrateRecipeImages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': localStorage.getItem('Token') || ''
                },
                body: JSON.stringify({ recipeIds: selectedIds })
            })
            const data = await res.json()
            if (data.success && Array.isArray(data.data)) {
                setTrace(data.data as Trace[])
                setSummary(data.message || '')
                const nextStatus: Record<string, TraceStatus> = {}
                for (const t of data.data) nextStatus[t.id] = t.status
                setStatus(prev => ({ ...prev, ...nextStatus }))
            } else {
                setError(data.message || 'Migration failed')
            }
        } catch (e: any) {
            setError(e.message || 'Migration failed')
        }

        setRunning(false)
        fetchRecipes()
    }

    if (!isAuthorized) return null

    return (
        <Layout title="Migrate Recipe Images" description="Move inline base64 recipe images into the linked image collection (full + thumbnail)">
            <div className="max-w-6xl mx-auto mt-8 px-4 pb-16">
                <PageHeader title="Migrate Recipe Images" />

                <div className="flex flex-wrap items-center gap-3 my-4">
                    <button
                        onClick={runMigration}
                        disabled={loading || running || selectedIds.length === 0}
                        className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {running && <Loader2 size={14} className="animate-spin" />}
                        Migrate Selected
                    </button>
                    <span className="text-xs text-muted-foreground">
                        {running ? `Running… (${selectedIds.length} selected)` : `${selectedIds.length} selected`}
                    </span>
                    <button
                        onClick={selectAllLegacy}
                        disabled={running}
                        className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-white disabled:opacity-40"
                        title="Select every recipe that still has an inline image"
                    >
                        Select all with legacy image
                    </button>
                    <button
                        onClick={fetchRecipes}
                        disabled={running}
                        className="ml-auto text-xs text-muted-foreground underline hover:text-white disabled:opacity-40"
                    >
                        Refresh
                    </button>
                </div>

                {error && <div className="my-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>}
                {summary && <div className="my-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">{summary}</div>}

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
                                            aria-label="Select all pending recipes"
                                        />
                                    </th>
                                    <th className="px-3 py-2.5">Recipe</th>
                                    <th
                                        onClick={selectAllLegacy}
                                        title="Click to select all recipes with a legacy inline image"
                                        className="px-3 py-2.5 w-28 text-center cursor-pointer select-none underline decoration-dotted underline-offset-4 hover:text-white transition-colors"
                                    >Legacy Image</th>
                                    <th className="px-3 py-2.5 w-24 text-center">Inline Size</th>
                                    <th className="px-3 py-2.5 w-24 text-center">In Collection</th>
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
                                                disabled={!recipe.legacy}
                                                className="accent-emerald-500 cursor-pointer"
                                                aria-label={`Select ${recipe.name}`}
                                            />
                                        </td>
                                        <td className="px-3 py-2 font-semibold">{recipe.name}</td>
                                        <td className="px-3 py-2 text-center">
                                            {recipe.legacy
                                                ? <Check size={16} className="inline text-emerald-400" strokeWidth={3} />
                                                : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{fmtKB(recipe.legacyBytes)}</td>
                                        <td className="px-3 py-2 text-center">
                                            {recipe.hasImage
                                                ? <Check size={16} className="inline text-emerald-400" strokeWidth={3} />
                                                : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {status[recipe._id] === 'running' && <Loader2 size={14} className="inline animate-spin text-primary" />}
                                            {status[recipe._id] === 'migrated' && <Check size={14} className="inline text-emerald-400" strokeWidth={3} />}
                                            {status[recipe._id] === 'skipped' && <X size={14} className="inline text-amber-400" strokeWidth={3} />}
                                            {status[recipe._id] === 'failed' && <X size={14} className="inline text-rose-400" strokeWidth={3} />}
                                        </td>
                                    </tr>
                                ))}
                                {recipes.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No recipes found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {trace.length > 0 && (
                    <div className="mt-6 rounded-xl border border-white/10 overflow-hidden">
                        <div className="px-3 py-2 bg-white/[0.04] text-[10px] uppercase tracking-widest text-muted-foreground">Last run trace</div>
                        <div className="divide-y divide-white/5">
                            {trace.map(t => (
                                <div key={t.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                                    {t.status === 'migrated' && <Check size={14} className="text-emerald-400" strokeWidth={3} />}
                                    {t.status === 'skipped' && <X size={14} className="text-amber-400" strokeWidth={3} />}
                                    {t.status === 'failed' && <X size={14} className="text-rose-400" strokeWidth={3} />}
                                    <span className="font-semibold">{t.name || t.id}</span>
                                    <span className="text-muted-foreground text-xs">
                                        {t.status === 'migrated' && t.bytesBefore ? `moved ${(t.bytesBefore / 1024).toFixed(0)} KB` : t.error || t.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                    Legacy means the recipe still carries a base64 image inside its recipe document. Migration stores a
                    full-res copy and a thumbnail in the image collection, then removes the inline blob. Recipes already
                    in the collection show a tick under "In Collection". Nothing runs until you pick rows and click Migrate Selected.
                </p>
            </div>
        </Layout>
    )
}
