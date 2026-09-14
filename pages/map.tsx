import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/router'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { useAuthGuard } from '../lib/useAuthGuard'
import { useIsAdmin } from '../lib/useIsAdmin'
import { ArrowLeft, Loader2, MapPin, Plus, Minus, Compass, UtensilsCrossed, Check, Maximize2, List, Wand2 } from 'lucide-react'
import { buildViewportTiles, projectToPercent, tileZoomForScale } from '../lib/dishLists/mercator'
import { hasRegionArea } from '../lib/dishLists/locationStatus'

interface MapPoint {
    _id: string
    source?: 'dish' | 'recipe'
    name: string
    category?: string
    country?: string
    region?: string
    city?: string
    lat: number
    lng: number
    cooked: boolean
    listId: string
    listName: string
    recipeId?: string
    recipeIds?: string[]
    hasImage?: boolean
    imageUrl?: string
    sourceUrl?: string
}

interface Marker {
    key: string
    kind: 'dish' | 'cluster'
    label: string
    city?: string
    country?: string
    points: MapPoint[]
    lat: number
    lng: number
}

interface View {
    scale: number
    tx: number
    ty: number
}

const MIN_SCALE = 1
const MAX_SCALE = 32
// Past this zoom (1000%) we switch from country clusters to individual city pins.
const CITY_PIN_SCALE = 10
// Sentinel values for the source filters in the list dropdown (never real ids).
const ALL_RECIPES = '__recipes__'
const EVERYTHING = '__everything__'
const isRecipe = (p: MapPoint): boolean => p.source === 'recipe'
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const clampView = (scale: number, tx: number, ty: number, size: number): View => {
    if (!size) return { scale, tx, ty }
    const min = size - size * scale
    return { scale, tx: clamp(tx, min, 0), ty: clamp(ty, min, 0) }
}

const thumbUrl = (p: MapPoint): string | undefined => {
    if (p.imageUrl) return p.imageUrl
    if (isRecipe(p)) return undefined
    return p.hasImage ? `/api/dishLists/items/${p._id}/image?q=thumb` : undefined
}

/** All recipes linked to a dish (new array field, or the legacy single id). */
const recipeIdsOf = (p: MapPoint): string[] =>
    p.recipeIds && p.recipeIds.length ? p.recipeIds : (p.recipeId ? [p.recipeId] : [])

/**
 * Country clusters when zoomed out. Once zoomed in, dishes that have a
 * region/city become their own pin at their exact position; dishes without one
 * still cluster on the country's middle point.
 */
const buildMarkers = (points: MapPoint[], detailed: boolean): Marker[] => {
    const markers: Marker[] = []
    const clusters = new Map<string, Marker>()

    for (const p of points) {
        const area = (p.city || p.region || '').trim()
        if (detailed && area) {
            markers.push({
                key: `d:${p._id}`,
                kind: 'dish',
                label: p.name,
                city: area,
                country: p.country,
                points: [p],
                lat: p.lat,
                lng: p.lng
            })
            continue
        }
        const label = (p.country || p.region || p.city || 'Unknown').trim()
        const key = label.toLowerCase()
        let c = clusters.get(key)
        if (!c) {
            c = { key: `c:${key}`, kind: 'cluster', label, points: [], lat: 0, lng: 0 }
            clusters.set(key, c)
        }
        c.points.push(p)
    }

    for (const c of Array.from(clusters.values())) {
        c.points.sort((a, b) => a.name.localeCompare(b.name))
        c.lat = c.points.reduce((s, p) => s + p.lat, 0) / c.points.length
        c.lng = c.points.reduce((s, p) => s + p.lng, 0) / c.points.length
    }
    return [...markers, ...Array.from(clusters.values())]
}

const markerTone = (marker: Marker): string => {
    const cooked = marker.points.filter(p => p.cooked).length
    if (cooked === marker.points.length) return 'bg-emerald-500'
    if (cooked === 0) return 'bg-rose-500'
    return 'bg-amber-500'
}

const placeLine = (p: MapPoint): string =>
    [p.city || p.region, p.country].filter(Boolean).join(', ') || 'Unknown origin'

/** Deep link back into the dish's list, optionally pre-filtered to its country. */
const listUrl = (p: MapPoint): string =>
    `/dishLists/${p.listId}${p.country ? `?country=${encodeURIComponent(p.country)}` : ''}`

/** Where a pin links to: the recipe page for recipes, its list for dishes. */
const itemUrl = (p: MapPoint): string =>
    isRecipe(p) ? `/recipes/${p._id}` : listUrl(p)

export default function WorldMap() {
    const isAuthed = useAuthGuard()
    const isAdmin = useIsAdmin()
    const router = useRouter()
    const queryListId = typeof router.query.listId === 'string' ? router.query.listId : ''
    const fromParam = typeof router.query.from === 'string' ? router.query.from : ''

    const [points, setPoints] = useState<MapPoint[]>([])
    const [recipePoints, setRecipePoints] = useState<MapPoint[]>([])
    const [pendingIds, setPendingIds] = useState<string[]>([])
    const [recipePending, setRecipePending] = useState<string[]>([])
    const [total, setTotal] = useState(0)
    const [located, setLocated] = useState(0)
    const [recipeTotal, setRecipeTotal] = useState(0)
    const [recipeLocated, setRecipeLocated] = useState(0)
    const [loading, setLoading] = useState(true)
    const [geocoding, setGeocoding] = useState(false)
    const [geocodeRemaining, setGeocodeRemaining] = useState<number | null>(null)
    const [listFilter, setListFilter] = useState('')
    const [selectedKey, setSelectedKey] = useState<string | null>(null)
    const [hoveredKey, setHoveredKey] = useState<string | null>(null)
    const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
    const [size, setSize] = useState(0)

    const mapRef = useRef<HTMLDivElement | null>(null)
    const viewRef = useRef(view)
    const sizeRef = useRef(size)
    const pointersRef = useRef(new Map<number, { x: number; y: number }>())
    const gestureRef = useRef<any>({})
    const draggedRef = useRef(false)

    useEffect(() => { viewRef.current = view }, [view])
    useEffect(() => { sizeRef.current = size }, [size])

    const token = () => localStorage.getItem('Token') || ''

    const load = async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            const res = await fetch('/api/dishLists/map', { headers: { edgetoken: token() } })
            const data = await res.json()
            if (data.success) {
                setPoints(data.data.points || [])
                setRecipePoints(data.data.recipePoints || [])
                setPendingIds(data.data.pending || [])
                setRecipePending(data.data.recipePending || [])
                setTotal(data.data.total || 0)
                setLocated(data.data.located || 0)
                setRecipeTotal(data.data.recipeTotal || 0)
                setRecipeLocated(data.data.recipeLocated || 0)
            }
        } finally {
            if (!silent) setLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthed) load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed])

    useEffect(() => {
        if (queryListId) setListFilter(queryListId)
    }, [queryListId])

    // Deep link from the recipes page: open pre-filtered to All Recipes.
    useEffect(() => {
        if (router.query.recipes) setListFilter(ALL_RECIPES)
    }, [router.query.recipes])

    // Measure the (square) map container so pins/tiles can be positioned in px.
    useEffect(() => {
        const el = mapRef.current
        if (!el) return
        const update = () => setSize(el.clientWidth)
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [loading, located])

    // Native wheel zoom (non-passive so we can preventDefault the page scroll).
    useEffect(() => {
        const el = mapRef.current
        if (!el) return
        const onWheel = (e: WheelEvent) => {
            if ((e.target as HTMLElement)?.closest?.('[data-no-zoom]')) return
            e.preventDefault()
            const rect = el.getBoundingClientRect()
            const px = e.clientX - rect.left
            const py = e.clientY - rect.top
            const factor = Math.exp(-e.deltaY * 0.0015)
            setView(v => {
                const nextScale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
                const k = nextScale / v.scale
                return clampView(nextScale, px - (px - v.tx) * k, py - (py - v.ty) * k, sizeRef.current)
            })
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [loading, located])

    const zoomAround = (factor: number, px: number, py: number) => {
        setView(v => {
            const nextScale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
            const k = nextScale / v.scale
            return clampView(nextScale, px - (px - v.tx) * k, py - (py - v.ty) * k, sizeRef.current)
        })
    }

    const zoomButton = (factor: number) => zoomAround(factor, sizeRef.current / 2, sizeRef.current / 2)
    const resetView = () => setView({ scale: 1, tx: 0, ty: 0 })

    // Return to wherever we came from. Callers can pass ?from=/path (e.g. the
    // recipes page); otherwise fall back to real browser history.
    const goBack = () => {
        if (fromParam && fromParam.startsWith('/')) {
            router.push(fromParam)
        } else if (window.history.length > 1) {
            router.back()
        } else {
            router.push('/dishLists')
        }
    }

    // ---- Pointer gestures: one finger/mouse drags, two fingers pinch ----
    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement)?.closest?.('[data-no-zoom]')) return
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        draggedRef.current = false
        const pts = Array.from(pointersRef.current.values())
        if (pts.length === 1) {
            gestureRef.current = { mode: 'pan', startPointer: { ...pts[0] }, startView: { ...viewRef.current } }
        } else if (pts.length === 2) {
            const [a, b] = pts
            gestureRef.current = {
                mode: 'pinch',
                startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
                startScale: viewRef.current.scale,
                startView: { ...viewRef.current }
            }
        }
    }

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!pointersRef.current.has(e.pointerId)) return
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const g = gestureRef.current
        const pts = Array.from(pointersRef.current.values())

        if (g.mode === 'pan' && pts.length === 1) {
            const dx = pts[0].x - g.startPointer.x
            const dy = pts[0].y - g.startPointer.y
            if (Math.abs(dx) + Math.abs(dy) > 3) draggedRef.current = true
            setView(clampView(g.startView.scale, g.startView.tx + dx, g.startView.ty + dy, sizeRef.current))
        } else if (g.mode === 'pinch' && pts.length >= 2 && mapRef.current) {
            const rect = mapRef.current.getBoundingClientRect()
            const [a, b] = pts
            const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
            draggedRef.current = true
            const nextScale = clamp(g.startScale * (dist / g.startDist), MIN_SCALE, MAX_SCALE)
            const k = nextScale / g.startScale
            const midX = (a.x + b.x) / 2 - rect.left
            const midY = (a.y + b.y) / 2 - rect.top
            const startMidX = g.startMid.x - rect.left
            const startMidY = g.startMid.y - rect.top
            setView(clampView(
                nextScale,
                midX - (startMidX - g.startView.tx) * k,
                midY - (startMidY - g.startView.ty) * k,
                sizeRef.current
            ))
        }
    }

    const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
        pointersRef.current.delete(e.pointerId)
        const pts = Array.from(pointersRef.current.values())
        if (pts.length === 1) {
            gestureRef.current = { mode: 'pan', startPointer: { ...pts[0] }, startView: { ...viewRef.current } }
        } else if (pts.length === 0) {
            gestureRef.current = {}
        }
    }

    const listOptions = useMemo(() => {
        const map = new Map<string, string>()
        for (const p of points) if (p.listName) map.set(p.listId, p.listName)
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
    }, [points])

    const visible = useMemo(() => {
        if (listFilter === ALL_RECIPES) return recipePoints
        if (listFilter === EVERYTHING) return [...points, ...recipePoints]
        if (listFilter) return points.filter(p => p.listId === listFilter)
        return points
    }, [points, recipePoints, listFilter])

    // Header stats follow the active filter.
    const stats = useMemo(() => {
        if (listFilter === ALL_RECIPES) return { located: recipeLocated, total: recipeTotal }
        if (listFilter === EVERYTHING) return { located: located + recipeLocated, total: total + recipeTotal }
        return { located, total }
    }, [listFilter, located, total, recipeLocated, recipeTotal])

    const detailed = view.scale >= CITY_PIN_SCALE
    const markers = useMemo(() => buildMarkers(visible, detailed), [visible, detailed])
    const markerByKey = useMemo(() => new Map(markers.map(m => [m.key, m])), [markers])
    const countryCount = useMemo(
        () => new Set(visible.map(p => (p.country || '').trim()).filter(Boolean)).size,
        [visible]
    )

    // Detail adapts to the zoom: continents → countries → regions.
    const tileZoom = tileZoomForScale(view.scale)

    const toScreen = (lat: number, lng: number) => {
        const pct = projectToPercent(lat, lng)
        return {
            x: (pct.x / 100) * size * view.scale + view.tx,
            y: (pct.y / 100) * size * view.scale + view.ty
        }
    }

    const tiles = useMemo(
        () => buildViewportTiles(tileZoom, view.tx, view.ty, size * view.scale, size, 160),
        [tileZoom, view, size]
    )

    const popupStyle = (sx: number, sy: number): CSSProperties => {
        const tx = sx < size * 0.2 ? '0%' : sx > size * 0.8 ? '-100%' : '-50%'
        const ty = sy < size * 0.3 ? '16px' : 'calc(-100% - 16px)'
        return { left: `${sx}px`, top: `${sy}px`, transform: `translate(${tx}, ${ty})` }
    }

    const runGeocode = async () => {
        if (geocoding) return
        // Which worklists the active filter covers.
        const jobs: { source: 'dish' | 'recipe'; ids: string[] }[] = []
        if (listFilter === ALL_RECIPES || listFilter === EVERYTHING) jobs.push({ source: 'recipe', ids: recipePending })
        if (listFilter !== ALL_RECIPES) jobs.push({ source: 'dish', ids: pendingIds })
        const pendingCount = jobs.reduce((sum, job) => sum + job.ids.length, 0)
        if (pendingCount === 0) {
            alert('Everything here already has a region/city — nothing left to refine.')
            return
        }
        setGeocoding(true)
        setGeocodeRemaining(pendingCount)
        try {
            // Small batches keep each request short and let us persist progress
            // batch-by-batch, so a failure part-way through keeps the rest.
            const batchSize = 4
            let done = 0
            let failed = false
            for (const job of jobs) {
                if (failed) break
                for (let i = 0; i < job.ids.length; i += batchSize) {
                    const chunk = job.ids.slice(i, i + batchSize)
                    let data
                    try {
                        const res = await fetch('/api/dishLists/map', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', edgetoken: token() },
                            body: JSON.stringify({ source: job.source, itemIds: chunk })
                        })
                        data = await res.json()
                    } catch {
                        failed = true
                        break
                    }
                    if (!data.success) { failed = true; break }
                    done += chunk.length
                    // Reflect saved values immediately so they're never re-extracted.
                    await load(true)
                    setGeocodeRemaining(Math.max(0, pendingCount - done))
                }
            }
        } finally {
            setGeocoding(false)
            setGeocodeRemaining(null)
            await load(true)
        }
    }

    if (!isAuthed) return null

    const selected = selectedKey ? markerByKey.get(selectedKey) || null : null
    const hovered = hoveredKey ? markerByKey.get(hoveredKey) || null : null
    const showPopup = Boolean(selected && (!hovered || hovered.key === selected.key))
    const preview = !showPopup && hovered ? hovered : null

    return (
        <Layout title="World view" description="Where every dish comes from" hideMobileToolbar>
            <div className="flex flex-col min-h-[calc(100vh-8rem)]">
                <header className="shrink-0 px-4 sm:px-8 py-3 bg-background/80 backdrop-blur-xl shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={goBack} className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                                <Compass size={18} className="text-accent" /> World view
                            </h1>
                            <p className="text-[11px] text-muted-foreground">
                                {stats.located} of {stats.total} located · {countryCount} countries
                            </p>
                        </div>
                        {isAdmin && (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={runGeocode}
                                disabled={geocoding || loading}
                                className="rounded-xl shrink-0"
                                title="Guess each item's region/city and resolve map coordinates (slow)"
                            >
                                {geocoding ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                                {geocoding ? `Locations${geocodeRemaining != null ? ` (${geocodeRemaining} left)` : '…'}` : 'Locations'}
                            </Button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        <select
                            value={listFilter}
                            onChange={e => { setListFilter(e.target.value); setSelectedKey(null) }}
                            className="h-9 rounded-xl bg-secondary border border-border px-3 text-xs font-semibold focus:outline-none focus:border-accent max-w-[16rem]"
                        >
                            <option value="">All lists</option>
                            <option value={ALL_RECIPES}>All Recipes</option>
                            <option value={EVERYTHING}>Everything</option>
                            {listOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </select>

                        <span className="inline-flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-semibold text-muted-foreground ml-1">
                            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Not cooked</span>
                            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Mixed</span>
                            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Cooked</span>
                        </span>

                        <div className="ml-auto flex items-center gap-1">
                            <Button size="icon-sm" variant="secondary" onClick={() => zoomButton(1 / 1.5)} disabled={view.scale <= MIN_SCALE} title="Zoom out">
                                <Minus size={15} />
                            </Button>
                            <span className="w-12 text-center text-xs font-bold tabular-nums text-muted-foreground">{Math.round(view.scale * 100)}%</span>
                            <Button size="icon-sm" variant="secondary" onClick={() => zoomButton(1.5)} disabled={view.scale >= MAX_SCALE} title="Zoom in">
                                <Plus size={15} />
                            </Button>
                            <Button size="icon-sm" variant="secondary" onClick={resetView} title="Reset view">
                                <Maximize2 size={14} />
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex items-center justify-center px-4 py-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-4">
                            <Loader2 className="animate-spin text-accent" size={30} />
                            <p className="text-sm text-muted-foreground">Plotting dishes…</p>
                        </div>
                    ) : located + recipeLocated === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-3xl bg-secondary/40 max-w-md">
                            <MapPin className="mb-3 text-muted-foreground" size={32} />
                            <p className="text-sm font-semibold">No located items yet</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                                Add a list or recipe, then hit <strong>Locations</strong> to resolve each place into map coordinates.
                            </p>
                        </div>
                    ) : (
                        <div
                            ref={mapRef}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={endPointer}
                            onPointerCancel={endPointer}
                            onClick={() => { if (!draggedRef.current) setSelectedKey(null) }}
                            className="relative aspect-square rounded-2xl overflow-hidden border border-border bg-[#d5dbe0] shadow-xl select-none cursor-grab active:cursor-grabbing"
                            style={{ width: 'min(92vw, 72vh, 880px)', touchAction: 'none' }}
                        >
                            {/* Tiles */}
                            {tiles.map(t => (
                                <img
                                    key={t.key}
                                    src={t.url}
                                    alt=""
                                    draggable={false}
                                    className="absolute pointer-events-none"
                                    style={{ left: `${t.left}px`, top: `${t.top}px`, width: `${t.size}px`, height: `${t.size}px` }}
                                />
                            ))}

                            {/* Markers (country clusters, then individual cities when zoomed in) */}
                            {markers.map(marker => {
                                const { x, y } = toScreen(marker.lat, marker.lng)
                                if (x < -60 || y < -60 || x > size + 60 || y > size + 60) return null
                                const count = marker.points.length
                                const isActive = marker.key === selected?.key || marker.key === hovered?.key
                                const tone = markerTone(marker)
                                return (
                                    <button
                                        key={marker.key}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => { e.stopPropagation(); setSelectedKey(marker.key) }}
                                        onMouseEnter={() => setHoveredKey(marker.key)}
                                        onMouseLeave={() => setHoveredKey(k => (k === marker.key ? null : k))}
                                        aria-label={marker.kind === 'dish' ? `${marker.label} — ${marker.city}` : `${marker.label} — ${count} dishes`}
                                        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                                        style={{ left: `${x}px`, top: `${y}px` }}
                                    >
                                        {count > 1 ? (
                                            <span className={`flex items-center justify-center min-w-[24px] h-[24px] px-1 rounded-full border-2 border-white shadow-md text-white text-[11px] font-black tabular-nums transition-transform ${tone} ${isActive ? 'scale-125 ring-2 ring-accent' : 'hover:scale-110'}`}>
                                                {count}
                                            </span>
                                        ) : (
                                            <span className={`block w-3 h-3 rounded-full border-2 border-white shadow-md transition-transform ${tone} ${isActive ? 'scale-150 ring-2 ring-accent' : 'hover:scale-150'}`} />
                                        )}
                                    </button>
                                )
                            })}

                            {/* Hover preview */}
                            {preview && (() => {
                                const { x, y } = toScreen(preview.lat, preview.lng)
                                const first = preview.points[0]
                                return (
                                    <div className="absolute z-20 w-52 max-w-[70vw] rounded-xl bg-card border border-border shadow-2xl p-2.5 pointer-events-none" style={popupStyle(x, y)}>
                                        <div className="flex items-center gap-2.5">
                                            {thumbUrl(first) ? (
                                                <img src={thumbUrl(first) as string} alt="" className="w-11 h-11 rounded-lg object-cover bg-secondary shrink-0" />
                                            ) : (
                                                <div className="w-11 h-11 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0"><UtensilsCrossed size={16} /></div>
                                            )}
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-bold leading-tight truncate">{first.name}</h3>
                                                <p className="text-[11px] text-muted-foreground truncate inline-flex items-center gap-1">
                                                    <MapPin size={10} /> {preview.kind === 'dish' ? [preview.city, preview.country].filter(Boolean).join(', ') : preview.label}
                                                </p>
                                                {preview.kind === 'cluster' && preview.points.length > 1 && (
                                                    <p className="text-[10px] font-semibold text-accent mt-0.5">+{preview.points.length - 1} more</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Click popup */}
                            {showPopup && selected && (() => {
                                const { x, y } = toScreen(selected.lat, selected.lng)

                                // Single dish (zoomed in, has a city/region)
                                if (selected.kind === 'dish') {
                                    const p = selected.points[0]
                                    return (
                                        <div
                                            data-no-zoom
                                            className="absolute z-30 w-64 max-w-[80vw] rounded-2xl bg-card border border-border shadow-2xl p-3"
                                            style={{ ...popupStyle(x, y), touchAction: 'auto' }}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {thumbUrl(p) && <img src={thumbUrl(p) as string} alt="" className="w-full h-28 object-cover rounded-xl bg-secondary mb-2" />}
                                            <h3 className="text-sm font-black leading-tight">{p.name}</h3>
                                            <p className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                                                <MapPin size={11} /> {placeLine(p)}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                                {p.category && <span className="uppercase tracking-wide font-bold">{p.category}</span>}
                                                <span className={`inline-flex items-center gap-0.5 font-semibold ${p.cooked ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {p.cooked && <Check size={9} />} {p.cooked ? 'Cooked' : 'Not cooked'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/60">
                                                {isRecipe(p) ? (
                                                    <a href={itemUrl(p)} className="inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-accent text-accent-foreground text-[11px] font-bold hover:opacity-90 transition-opacity">
                                                        <UtensilsCrossed size={12} /> View recipe
                                                    </a>
                                                ) : (
                                                    <>
                                                        <a href={listUrl(p)} className="inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-accent text-accent-foreground text-[11px] font-bold hover:opacity-90 transition-opacity">
                                                            <List size={12} /> View in list
                                                        </a>
                                                        {recipeIdsOf(p).length > 0 ? (
                                                            <a href={`/recipes?ids=${recipeIdsOf(p).join(',')}`} className="inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-secondary text-[11px] font-bold hover:bg-border transition-colors">
                                                                <UtensilsCrossed size={12} /> Recipe{recipeIdsOf(p).length > 1 ? 's' : ''}
                                                            </a>
                                                        ) : (
                                                            <a href={`/dishLists/items/${p._id}`} className="inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-secondary text-[11px] font-bold hover:bg-border transition-colors">
                                                                <Wand2 size={12} /> Create recipe
                                                            </a>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                }

                                // Country cluster list
                                return (
                                    <div
                                        data-no-zoom
                                        className="absolute z-30 w-72 max-w-[80vw] rounded-2xl bg-card border border-border shadow-2xl p-3"
                                        style={{ ...popupStyle(x, y), touchAction: 'auto' }}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <h3 className="text-base font-black text-center leading-tight">{selected.label}</h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center mt-0.5">
                                            {selected.points.length} item{selected.points.length === 1 ? '' : 's'}
                                        </p>
                                        {!isRecipe(selected.points[0]) && new Set(selected.points.map(p => p.listId)).size === 1 && (
                                            <a href={listUrl(selected.points[0])} className="mt-2 w-full inline-flex items-center justify-center gap-1 px-2 h-8 rounded-lg bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 transition-opacity">
                                                <List size={13} /> View in list
                                            </a>
                                        )}
                                        <div className="mt-2.5 max-h-60 overflow-y-auto -mr-1 pr-1 divide-y divide-border/60">
                                            {selected.points.map(p => (
                                                <div key={p._id} className="flex items-center gap-2.5 py-2">
                                                    {thumbUrl(p) ? (
                                                        <img src={thumbUrl(p) as string} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover bg-secondary shrink-0" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0"><UtensilsCrossed size={14} /></div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className={`text-xs font-bold leading-tight truncate ${p.cooked ? 'text-muted-foreground' : ''}`}>{p.name}</div>
                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                            {hasRegionArea(p) && <span className="truncate">{p.city || p.region}</span>}
                                                            <span className={`inline-flex items-center gap-0.5 font-semibold ${p.cooked ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {p.cooked && <Check size={9} />} {p.cooked ? 'Cooked' : 'Not cooked'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                        {isRecipe(p) ? (
                                                            <a href={itemUrl(p)} title="Open recipe" className="p-1.5 rounded-lg text-accent hover:bg-secondary transition-colors"><UtensilsCrossed size={14} /></a>
                                                        ) : (
                                                            <>
                                                                {recipeIdsOf(p).length > 0 && (
                                                                    <a href={`/recipes?ids=${recipeIdsOf(p).join(',')}`} title="Show recipes" className="p-1.5 rounded-lg text-accent hover:bg-secondary transition-colors"><UtensilsCrossed size={14} /></a>
                                                                )}
                                                                <a href={listUrl(p)} title="View in list" className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-secondary transition-colors"><List size={14} /></a>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}

                            <div className="absolute bottom-1 right-1 z-40 px-1.5 py-0.5 rounded bg-white/80 text-[9px] text-black/70">
                                © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer" className="underline">CARTO</a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
