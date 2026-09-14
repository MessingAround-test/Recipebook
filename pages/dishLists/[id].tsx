import { useEffect, useMemo, useState } from 'react'
import Router, { useRouter } from 'next/router'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useAuthGuard } from '../../lib/useAuthGuard'
import { useIsAdmin } from '../../lib/useIsAdmin'
import { ArrowLeft, ClipboardPaste, Loader2, Search, Sparkles, MapPin, ExternalLink, ListChecks, Trash2, Compass, Lock } from 'lucide-react'
import { PasteModal } from '../../components/dishLists/PasteModal'
import { ItemEditModal } from '../../components/dishLists/ItemEditModal'
import { DishListTable } from '../../components/dishLists/DishListTable'
import { DishListItem, DishListSummary } from '../../components/dishLists/types'
import { needsLocationWork, hasPoint } from '../../lib/dishLists/locationStatus'

export default function DishListDetail() {
    const isAuthed = useAuthGuard()
    const isAdmin = useIsAdmin()
    const router = useRouter()
    const listId = typeof router.query.id === 'string' ? router.query.id : ''

    const [list, setList] = useState<DishListSummary | null>(null)
    const [items, setItems] = useState<DishListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'uncooked' | 'cooked'>('uncooked')
    const [filterCountry, setFilterCountry] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [filterIssues, setFilterIssues] = useState(false)
    const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

    const [pasteOpen, setPasteOpen] = useState(false)
    const [editItem, setEditItem] = useState<DishListItem | null>(null)

    const [enriching, setEnriching] = useState(false)
    const [enrichRemaining, setEnrichRemaining] = useState<number | null>(null)
    const [geocoding, setGeocoding] = useState(false)
    const [geocodeRemaining, setGeocodeRemaining] = useState<number | null>(null)
    const [deleting, setDeleting] = useState(false)

    const token = () => localStorage.getItem('Token') || ''

    const load = async (silent = false) => {
        if (!listId) return
        if (!silent) setLoading(true)
        try {
            const res = await fetch(`/api/dishLists/${listId}`, { headers: { edgetoken: token() } })
            const data = await res.json()
            if (data.success) {
                setList(data.data.list)
                setItems(data.data.items || [])
            }
        } finally {
            if (!silent) setLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthed && listId) load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed, listId])

    // Arriving from the map with ?country=... pre-filters the list to that
    // country (and shows all dishes, not just uncooked, so the set is complete).
    useEffect(() => {
        const country = typeof router.query.country === 'string' ? router.query.country : ''
        if (country) {
            setFilterCountry(country)
            setFilter('all')
        }
    }, [router.query.country])

    const countryOptions = useMemo(() => {
        const set = new Set<string>()
        for (const item of items) {
            const country = (item.location?.country || '').trim()
            if (country) set.add(country)
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [items])

    const categoryOptions = useMemo(() => {
        const set = new Set<string>()
        for (const item of items) {
            const category = (item.category || '').trim()
            if (category) set.add(category)
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [items])

    const hasActiveFilters = filter !== 'uncooked' || filterCountry !== '' || filterCategory !== '' || filterIssues || search.trim() !== ''

    const clearFilters = () => {
        setFilter('uncooked')
        setFilterCountry('')
        setFilterCategory('')
        setFilterIssues(false)
        setSearch('')
    }

    const filtered = useMemo(() => {
        return items.filter(item => {
            if (filter === 'cooked' && !item.cooked) return false
            if (filter === 'uncooked' && item.cooked) return false
            if (filterCountry && (item.location?.country || '') !== filterCountry) return false
            if (filterCategory && (item.category || '') !== filterCategory) return false
            // Location issues: the dish has no usable map point yet, so it
            // isn't showing on the world map.
            if (filterIssues && hasPoint(item.location)) return false
            if (search.trim()) {
                const term = search.toLowerCase()
                const haystack = [item.name, item.category, item.location?.country, item.location?.city, item.location?.region].join(' ').toLowerCase()
                if (!haystack.includes(term)) return false
            }
            return true
        })
    }, [items, filter, filterCountry, filterCategory, filterIssues, search])

    const cookedCount = items.filter(i => i.cooked).length
    const issueCount = items.filter(i => !hasPoint(i.location)).length

    const markBusy = (id: string, on: boolean) => {
        setBusyIds(prev => {
            const next = new Set(prev)
            if (on) next.add(id)
            else next.delete(id)
            return next
        })
    }

    const toggleCooked = async (item: DishListItem) => {
        const next = !item.cooked
        setItems(prev => prev.map(i => i._id === item._id ? { ...i, cooked: next } : i))
        markBusy(item._id, true)
        try {
            const res = await fetch('/api/dishLists/items', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', edgetoken: token() },
                body: JSON.stringify({ itemId: item._id, cooked: next })
            })
            const data = await res.json()
            if (!data.success) setItems(prev => prev.map(i => i._id === item._id ? { ...i, cooked: item.cooked } : i))
        } catch {
            setItems(prev => prev.map(i => i._id === item._id ? { ...i, cooked: item.cooked } : i))
        } finally {
            markBusy(item._id, false)
        }
    }

    const runEnrich = async () => {
        if (enriching) return
        setEnriching(true)
        try {
            let remaining = 1
            let guard = 0
            while (remaining > 0 && guard < 40) {
                guard++
                const res = await fetch(`/api/dishLists/${listId}/enrich`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', edgetoken: token() },
                    body: JSON.stringify({ limit: 6 })
                })
                const data = await res.json()
                if (!data.success) break
                remaining = data.data.remaining
                setEnrichRemaining(remaining)
                if (data.data.processed === 0) break
            }
            await load()
        } finally {
            setEnriching(false)
            setEnrichRemaining(null)
        }
    }

    const runGeocode = async () => {
        if (geocoding) return
        // Deterministic worklist: every dish that still needs coords or a
        // region/city refinement (country-only pins included).
        const pendingIds = items.filter(i => needsLocationWork(i.location)).map(i => i._id)
        if (pendingIds.length === 0) {
            alert('Every dish already has a region/city — nothing left to refine.')
            return
        }
        setGeocoding(true)
        setGeocodeRemaining(pendingIds.length)
        try {
            // Small batches keep each request short and let us persist progress
            // batch-by-batch, so a failure part-way through keeps the rest.
            const batchSize = 4
            for (let i = 0; i < pendingIds.length; i += batchSize) {
                const chunk = pendingIds.slice(i, i + batchSize)
                let data
                try {
                    const res = await fetch('/api/dishLists/geocode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', edgetoken: token() },
                        body: JSON.stringify({ listId, itemIds: chunk })
                    })
                    data = await res.json()
                } catch {
                    break
                }
                if (!data.success) break
                // Reflect saved values immediately so they're never re-extracted.
                await load(true)
                setGeocodeRemaining(data.data.remaining ?? Math.max(0, pendingIds.length - (i + chunk.length)))
                if (data.data.remaining === 0) break
            }
        } finally {
            setGeocoding(false)
            setGeocodeRemaining(null)
            await load(true)
        }
    }

    const deleteList = async () => {
        if (deleting) return
        const importedCount = items.filter(i => i.recipeId).length
        const msg = importedCount > 0
            ? `Delete "${list?.name}"? The ${importedCount} recipe${importedCount === 1 ? '' : 's'} imported from it will stay in your recipe book.`
            : `Delete "${list?.name}"? This removes the list and its dishes.`
        if (!confirm(msg)) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/dishLists/${listId}`, { method: 'DELETE', headers: { edgetoken: token() } })
            const data = await res.json()
            if (data.success) {
                Router.push('/dishLists')
            } else {
                alert(data.message || 'Could not delete list')
                setDeleting(false)
            }
        } catch {
            setDeleting(false)
        }
    }

    const toggleSystem = async () => {
        if (!list) return
        const next = !list.isSystem
        if (next && !confirm('Mark this as a system list? System lists are the app\'s official lists.')) return
        const res = await fetch(`/api/dishLists/${listId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', edgetoken: token() },
            body: JSON.stringify({ isSystem: next })
        })
        const data = await res.json()
        if (data.success) {
            setList(prev => prev ? { ...prev, isSystem: next } : prev)
        } else {
            alert(data.message || 'Could not update list')
        }
    }

    if (!isAuthed) return null

    return (
        <Layout title={list?.name || 'Dish list'} description="Dish list" hideMobileToolbar>
            <div className="relative min-h-screen pb-28">
                <header className="sticky top-0 z-40 px-4 sm:px-8 py-3 bg-background/80 backdrop-blur-xl shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => Router.push('/dishLists')} className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-lg font-black tracking-tight truncate">{list?.name || '…'}</h1>
                            <p className="text-[11px] text-muted-foreground">
                                {cookedCount}/{items.length} cooked
                                {list?.sourceUrl && (
                                    <>
                                        {' · '}
                                        <a href={list.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-accent">
                                            Source <ExternalLink size={10} />
                                        </a>
                                    </>
                                )}
                            </p>
                        </div>
                        <button
                            onClick={() => Router.push(`/map?listId=${listId}&from=/dishLists/${listId}`)}
                            title="View this list on the world map"
                            aria-label="World map"
                            className="p-2 rounded-lg text-muted-foreground hover:text-accent hover:bg-secondary transition-colors shrink-0"
                        >
                            <Compass size={17} />
                        </button>
                        {isAdmin && (
                            <button
                                onClick={deleteList}
                                disabled={deleting}
                                title="Delete list (recipes are kept)"
                                aria-label="Delete list"
                                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors shrink-0 disabled:opacity-50"
                            >
                                {deleting ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                            </button>
                        )}
                    </div>

                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-3">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${items.length ? (cookedCount / items.length) * 100 : 0}%` }} />
                    </div>

                    {isAdmin && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <Button size="sm" onClick={() => setPasteOpen(true)} className="rounded-xl">
                                <ClipboardPaste size={14} /> Add dishes
                            </Button>
                            <Button size="sm" variant="secondary" onClick={runEnrich} disabled={enriching || items.length === 0} className="rounded-xl">
                                {enriching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                {enriching ? `Blurbs & images${enrichRemaining != null ? ` (${enrichRemaining} left)` : ''}` : 'Blurbs & images'}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={runGeocode} disabled={geocoding || items.length === 0} className="rounded-xl" title="Guess each dish's region/city and resolve map coordinates (slow)">
                                {geocoding ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                                {geocoding ? `Locations${geocodeRemaining != null ? ` (${geocodeRemaining} left)` : '…'}` : 'Locations'}
                            </Button>
                            <label
                                title="Dishes whose location has a problem, so they're not showing on the map"
                                className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-xs font-semibold select-none transition-colors ${issueCount === 0
                                    ? 'opacity-40 cursor-not-allowed border-border bg-secondary text-muted-foreground'
                                    : filterIssues
                                        ? 'cursor-pointer bg-amber-500/15 border-amber-500/50 text-amber-500'
                                        : 'cursor-pointer bg-secondary border-border text-muted-foreground hover:text-amber-500 hover:border-amber-500/40'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={filterIssues}
                                    disabled={issueCount === 0}
                                    onChange={e => { const next = e.target.checked; setFilterIssues(next); if (next) setFilter('all') }}
                                    className={`h-3.5 w-3.5 rounded border-border accent-amber-500 ${issueCount === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                />
                                Location issues{issueCount > 0 ? ` (${issueCount})` : ''}
                            </label>
                            <label
                                title="Mark this list as one of the app's official system lists"
                                className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-xs font-semibold select-none cursor-pointer transition-colors ${list?.isSystem
                                    ? 'bg-accent/15 border-accent/50 text-accent'
                                    : 'bg-secondary border-border text-muted-foreground hover:text-accent hover:border-accent/40'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={!!list?.isSystem}
                                    onChange={toggleSystem}
                                    className="h-3.5 w-3.5 rounded border-border accent-accent cursor-pointer"
                                />
                                <Lock size={12} /> System list
                            </label>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        <div className="relative flex-1 min-w-[10rem]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes…" className="pl-9 h-9" />
                        </div>

                        <select
                            value={filterCountry}
                            onChange={e => setFilterCountry(e.target.value)}
                            className="h-9 rounded-xl bg-secondary border border-border px-3 text-xs font-semibold focus:outline-none focus:border-accent max-w-[11rem]"
                            title="Filter by country"
                        >
                            <option value="">All countries</option>
                            {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <select
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                            className="h-9 rounded-xl bg-secondary border border-border px-3 text-xs font-semibold focus:outline-none focus:border-accent max-w-[11rem]"
                            title="Filter by category"
                        >
                            <option value="">All categories</option>
                            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <div className="flex rounded-xl border border-border overflow-hidden">
                            {(['all', 'uncooked', 'cooked'] as const).map(f => (
                                <button key={f} onClick={() => setFilter(f)}
                                    className={`px-3 h-9 text-xs font-semibold capitalize transition-colors ${filter === f ? 'bg-accent text-accent-foreground' : 'bg-secondary hover:bg-border'}`}>
                                    {f}
                                </button>
                            ))}
                        </div>

                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-rose-500 transition-colors">
                                Clear
                            </button>
                        )}
                    </div>
                </header>

                <div className="px-4 sm:px-8 py-4 mx-auto w-full max-w-7xl">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <Loader2 className="animate-spin text-accent" size={30} />
                            <p className="text-sm text-muted-foreground">Loading dishes…</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                <ListChecks size={12} /> {filtered.length} {filtered.length === 1 ? 'dish' : 'dishes'}
                            </div>
                            <DishListTable
                                items={filtered}
                                busyIds={busyIds}
                                canEdit={isAdmin}
                                onToggle={toggleCooked}
                                onEdit={(item) => setEditItem(item)}
                            />
                        </>
                    )}
                </div>
            </div>

            {list && <PasteModal isOpen={pasteOpen} onClose={() => setPasteOpen(false)} list={list} onDone={load} />}

            <ItemEditModal
                isOpen={!!editItem}
                onClose={() => setEditItem(null)}
                item={editItem}
                onSaved={(saved) => setItems(prev => prev.map(i => i._id === saved._id ? { ...i, ...saved } : i))}
            />
        </Layout>
    )
}
