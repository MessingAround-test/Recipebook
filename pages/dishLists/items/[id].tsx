import { useEffect, useMemo, useRef, useState } from 'react'
import Router, { useRouter } from 'next/router'
import { Layout } from '../../../components/Layout'
import { Button } from '../../../components/ui/button'
import { useAuthGuard } from '../../../lib/useAuthGuard'
import {
    ArrowLeft, Loader2, MapPin, Star, ExternalLink, Search, NotebookPen,
    UtensilsCrossed, Check, Sparkles, ListChecks, ChevronRight, Wand2
} from 'lucide-react'
import { buildViewportTiles, projectToPercent, tileZoomForScale } from '../../../lib/dishLists/mercator'
import { DishListItem } from '../../../components/dishLists/types'
import { RecipeSourceCandidate } from '../../../components/dishLists/types'
import { CRITERIA_OPTIONS, criterionLabel, criteriaFromUser, criteriaInstruction } from '../../../lib/dishLists/criteria'

interface ListInfo {
    _id: string
    name: string
    dietaryFilters: string[]
    sourceUrl?: string
}

interface LinkedRecipe {
    _id: string
    name: string
    timesCooked: number
    image?: string
}

/** Small, non-interactive location map centred on a dish. */
function MiniMap({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
    const ref = useRef<HTMLDivElement | null>(null)
    const [size, setSize] = useState(0)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const update = () => setSize(el.clientWidth)
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const scale = 24
    const zoom = tileZoomForScale(scale)
    const pct = projectToPercent(lat, lng)
    const span = size * scale
    const tx = size / 2 - (pct.x / 100) * span
    const ty = size / 2 - (pct.y / 100) * span
    const tiles = useMemo(
        () => buildViewportTiles(zoom, tx, ty, span, size, 80),
        [zoom, tx, ty, span, size]
    )

    return (
        <div ref={ref} className={`relative rounded-xl overflow-hidden border border-border bg-[#d5dbe0] ${className || 'aspect-[16/10] w-full'}`}>
            {tiles.map(t => (
                <img key={t.key} src={t.url} alt="" draggable={false} className="absolute pointer-events-none"
                    style={{ left: `${t.left}px`, top: `${t.top}px`, width: `${t.size}px`, height: `${t.size}px` }} />
            ))}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow-lg ring-2 ring-black/10" />
            <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded bg-white/80 text-[8px] text-black/70">
                © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OSM</a>
            </div>
        </div>
    )
}

function StepBadge({ n, active, done }: { n: number; active?: boolean; done?: boolean }) {
    return (
        <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${done ? 'bg-emerald-500 text-white' : active ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'}`}>
            {done ? <Check size={14} /> : n}
        </span>
    )
}

export default function PreRecipe() {
    const isAuthed = useAuthGuard()
    const router = useRouter()
    const itemId = typeof router.query.id === 'string' ? router.query.id : ''

    const [loading, setLoading] = useState(true)
    const [item, setItem] = useState<DishListItem | null>(null)
    const [list, setList] = useState<ListInfo | null>(null)
    const [recipes, setRecipes] = useState<LinkedRecipe[]>([])

    const [results, setResults] = useState<RecipeSourceCandidate[]>([])
    const [searching, setSearching] = useState(false)
    const [query, setQuery] = useState('')

    const [manualUrl, setManualUrl] = useState('')
    const [notes, setNotes] = useState('')
    const [profileCriteria, setProfileCriteria] = useState<string[]>([])
    const [selectedCriteria, setSelectedCriteria] = useState<string[]>([])
    const [useProfile, setUseProfile] = useState(true)
    const searchSeq = useRef(0)

    const token = () => localStorage.getItem('Token') || ''

    const load = async () => {
        if (!itemId) return
        setLoading(true)
        try {
            const res = await fetch(`/api/dishLists/items/${itemId}`, { headers: { edgetoken: token() } })
            const data = await res.json()
            if (data.success) {
                setItem(data.data.item)
                setList(data.data.list)
                setRecipes(data.data.recipes || [])
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthed && itemId) load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed, itemId])

    // Pull the user's dietary requirements from Settings and use them by default.
    useEffect(() => {
        if (!isAuthed) return
        let cancelled = false
        ;(async () => {
            let profile: string[] = []
            try {
                const res = await fetch('/api/UserDetails', { headers: { edgetoken: token() } })
                const data = await res.json()
                profile = criteriaFromUser(data.res)
            } catch { /* ignore */ }
            if (cancelled) return
            setProfileCriteria(profile)
            setSelectedCriteria(profile)
        })()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed])

    const runSearch = async (criteria: string[]) => {
        if (!item) return
        const seq = ++searchSeq.current
        setSearching(true)
        try {
            const res = await fetch('/api/dishLists/searchSource', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', edgetoken: token() },
                body: JSON.stringify({ name: item.name, listId: item.listId, criteria })
            })
            const data = await res.json()
            if (seq !== searchSeq.current) return
            if (data.success) {
                setResults(data.data.results || [])
                setQuery(data.data.query || '')
            }
        } catch {
            if (seq === searchSeq.current) setResults([])
        } finally {
            if (seq === searchSeq.current) setSearching(false)
        }
    }

    // DuckDuckGo search runs on load and re-runs as criteria change.
    useEffect(() => {
        if (!item) return
        const t = setTimeout(() => runSearch(selectedCriteria), 300)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item?._id, selectedCriteria])

    const locationParam = item?.location && Object.keys(item.location).length ? JSON.stringify(item.location) : ''

    const goImport = (extra: Record<string, string>) => {
        if (!item) return
        const params = new URLSearchParams({
            listId: item.listId,
            itemId: item._id,
            listName: list?.name || '',
            ...extra
        })
        if (locationParam) params.set('loc', locationParam)
        Router.push(`/createRecipe?${params.toString()}`)
    }

    const useSource = (url: string) => goImport({ sourceUrl: url, autoImport: '1' })

    const useManualUrl = () => {
        const url = manualUrl.trim()
        if (url) useSource(url)
    }

    const toggleProfile = () => {
        const nextUse = !useProfile
        const next = nextUse
            ? Array.from(new Set([...selectedCriteria, ...profileCriteria]))
            : selectedCriteria.filter(c => !profileCriteria.includes(c))
        setUseProfile(nextUse)
        setSelectedCriteria(next)
    }

    const toggleCriterion = (value: string) => {
        setSelectedCriteria(prev => prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value])
    }

    const useNotes = () => {
        const text = notes.trim()
        if (!text) return
        const dietary = criteriaInstruction(selectedCriteria)
        try { sessionStorage.setItem('dishNotesImport', text) } catch { /* ignore */ }
        try { sessionStorage.setItem('dishNotesDietary', dietary) } catch { /* ignore */ }
        goImport({ notesImport: '1' })
    }

    if (!isAuthed) return null

    if (loading) {
        return (
            <Layout title="Dish" hideMobileToolbar>
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="animate-spin text-accent" size={30} />
                    <p className="text-sm text-muted-foreground">Loading dish…</p>
                </div>
            </Layout>
        )
    }

    if (!item) {
        return (
            <Layout title="Dish" hideMobileToolbar>
                <div className="px-4 py-20 text-center">
                    <p className="text-sm font-semibold">Dish not found.</p>
                    <Button variant="secondary" className="mt-4" onClick={() => Router.push('/dishLists')}>Back to lists</Button>
                </div>
            </Layout>
        )
    }

    const place = [item.location?.city || item.location?.region, item.location?.country].filter(Boolean).join(', ')
    const hasCoords = item.location?.lat != null && item.location?.lng != null
    const hasRecipe = recipes.length > 0
    const recipeIdsParam = recipes.map(r => r._id).join(',')

    return (
        <Layout title={item.name} description="Create a recipe for this dish" hideMobileToolbar>
            <div className="mx-auto w-full max-w-5xl px-4 sm:px-0 pb-24">
                {/* Header */}
                <div className="flex items-center gap-3 py-3">
                    <button onClick={() => Router.push(`/dishLists/${item.listId}`)} className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Create recipe</p>
                        <h1 className="text-xl font-black tracking-tight truncate">{item.name}</h1>
                    </div>
                </div>

                {/* Hero */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative rounded-2xl overflow-hidden border border-border bg-secondary aspect-[4/3]">
                        {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <UtensilsCrossed size={34} />
                            </div>
                        )}
                        {item.rank != null && (
                            <div className="absolute top-2.5 left-2.5 min-w-8 h-8 px-2 rounded-lg bg-black/65 backdrop-blur-md text-white text-sm font-black flex items-center justify-center border border-white/10">
                                {item.rank}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            {item.category && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary">{item.category}</span>}
                            {item.rating != null && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
                                    <Star size={12} fill="currentColor" /> {item.rating}
                                </span>
                            )}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.cooked ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}>
                                {item.cooked && <Check size={10} />} {item.cooked ? 'Cooked' : 'Not cooked'}
                            </span>
                        </div>

                        {place && (
                            <p className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                                <MapPin size={13} /> {place}
                            </p>
                        )}
                        {list && (
                            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <ListChecks size={12} /> {list.name}
                            </p>
                        )}

                        <div className="mt-1">
                            {item.description && (
                                <p className="text-sm text-foreground/80 leading-snug">{item.description}</p>
                            )}
                            {item.notes && (
                                <p className="text-xs text-muted-foreground mt-1">Notes: {item.notes}</p>
                            )}
                        </div>

                        {item.sourceUrl && (
                            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-accent inline-flex items-center gap-1 mt-1">
                                View on TasteAtlas <ExternalLink size={11} />
                            </a>
                        )}
                    </div>
                </div>

                {/* Info cards: location + existing recipes (same format, half the description width) */}
                {(hasCoords || hasRecipe) && (
                    <div className="mt-4 flex flex-wrap gap-4">
                        {hasCoords && (
                            <div className="w-full sm:w-1/2 md:w-1/4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Where it's from</p>
                                <div className="rounded-2xl border border-border bg-card p-2">
                                    <MiniMap lat={item.location!.lat as number} lng={item.location!.lng as number} className="aspect-[4/3] w-full rounded-xl" />
                                </div>
                            </div>
                        )}
                        {hasRecipe && (
                            <div className="w-full sm:w-1/2 md:w-1/4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Recipes ({recipes.length})</p>
                                <div className="rounded-2xl border border-border bg-card p-2 space-y-1">
                                    {recipes.map(r => (
                                        <button
                                            key={r._id}
                                            onClick={() => Router.push(`/recipes?ids=${recipeIdsParam}`)}
                                            title="Show these recipes"
                                            className="w-full flex items-center gap-2 p-1.5 rounded-xl hover:bg-secondary transition-colors text-left"
                                        >
                                            {r.image ? (
                                                <img src={r.image} alt="" className="w-9 h-9 rounded-lg object-cover bg-secondary shrink-0" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0"><UtensilsCrossed size={14} /></div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-bold truncate">{r.name}</div>
                                                {r.timesCooked > 0 && <div className="text-[10px] text-muted-foreground">Cooked {r.timesCooked}×</div>}
                                            </div>
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => Router.push(`/recipes?ids=${recipeIdsParam}`)}
                                        className="w-full text-center text-[11px] font-semibold text-accent hover:underline pt-0.5"
                                    >
                                        View in recipes
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Creation flow */}
                <div className="mt-6 rounded-3xl border border-border bg-card overflow-hidden">
                    <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center gap-2">
                        <Wand2 size={16} className="text-accent" />
                        <h2 className="text-base font-black">Recipe creation flow</h2>
                    </div>

                    {/* Dietary requirements — filters sources and adapts AI extraction */}
                    <div className="px-4 sm:px-5 py-3 border-b border-border bg-secondary/40">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-bold">Dietary requirements</p>
                                <p className="text-[11px] text-muted-foreground leading-snug">
                                    Filters the sources below and adapts AI extractions — non-conforming ingredients get substituted.
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={useProfile}
                                onClick={toggleProfile}
                                disabled={profileCriteria.length === 0}
                                title="Use my dietary requirements from settings"
                                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40 ${useProfile && profileCriteria.length > 0 ? 'bg-accent' : 'bg-border'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${useProfile && profileCriteria.length > 0 ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2.5">
                            {CRITERIA_OPTIONS.map(c => {
                                const active = selectedCriteria.includes(c.value)
                                const fromProfile = profileCriteria.includes(c.value)
                                return (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => toggleCriterion(c.value)}
                                        title={fromProfile ? 'From your settings' : undefined}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-accent text-accent-foreground border-accent' : 'bg-background border-border hover:border-accent'}`}
                                    >
                                        {c.label}{fromProfile ? ' •' : ''}
                                    </button>
                                )
                            })}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">
                            {selectedCriteria.length === 0 ? 'No dietary requirements applied.' : `Applied: ${selectedCriteria.map(criterionLabel).join(', ')}`}
                        </p>
                    </div>

                    {/* Step 1 — choose a source (highlighted) */}
                    <div className={`p-4 sm:p-5 border-b border-border ${!hasRecipe ? 'bg-accent/[0.04]' : ''}`}>
                        <div className="flex items-start gap-3">
                            <StepBadge n={1} active={!hasRecipe} done={hasRecipe} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-black">Choose a source</h3>
                                    {!hasRecipe && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-accent text-accent-foreground">Start here</span>}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    We searched the web for “{query || item.name}”. Pick a page to import, then review it in the editor.
                                </p>

                                {searching ? (
                                    <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
                                        <Loader2 className="animate-spin" size={16} /> Searching…
                                    </div>
                                ) : results.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-3">No results — paste a recipe URL or recipe text below.</p>
                                ) : (
                                    <div className="mt-3 space-y-2">
                                        {results.map(r => (
                                            <div key={r.url} className="flex items-start gap-3 p-3 rounded-xl bg-secondary border border-border">
                                                <Search size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <a href={r.url} target="_blank" rel="noreferrer" className="text-sm font-bold hover:text-accent inline-flex items-center gap-1">
                                                        {r.title} <ExternalLink size={11} />
                                                    </a>
                                                    <p className="text-[11px] text-muted-foreground truncate">{r.url}</p>
                                                    {r.snippet && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.snippet}</p>}
                                                </div>
                                                <Button size="sm" onClick={() => useSource(r.url)} className="shrink-0">
                                                    Use this <ChevronRight size={13} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2 mt-3">
                                    <input
                                        value={manualUrl}
                                        onChange={e => setManualUrl(e.target.value)}
                                        placeholder="Or paste a recipe URL…"
                                        className="flex-1 h-10 rounded-xl bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-accent"
                                    />
                                    <Button variant="secondary" disabled={!manualUrl.trim()} onClick={useManualUrl}>Import</Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 2 — AI paste */}
                    <div className="p-4 sm:p-5 border-b border-border">
                        <div className="flex items-start gap-3">
                            <StepBadge n={2} active={hasRecipe} />
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-black inline-flex items-center gap-1.5"><NotebookPen size={14} /> Or paste recipe text</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Copy the ingredients and method from anywhere — AI tidies it up. Great when no good source exists.</p>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Paste ingredients and steps here…"
                                    className="w-full min-h-[120px] mt-3 rounded-xl bg-secondary border border-border p-3 text-sm resize-y focus:outline-none focus:border-accent"
                                />
                                <Button className="mt-2" disabled={!notes.trim()} onClick={useNotes}>
                                    <Sparkles size={14} /> Extract with AI
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Step 3 — review */}
                    <div className="p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                            <StepBadge n={3} />
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-black">Review &amp; save</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    The editor opens pre-filled. Check the ingredients, steps and details, then save — it links straight back to this dish.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
