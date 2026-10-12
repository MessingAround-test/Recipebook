import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent, FormEvent } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { COUNTRIES, canonicalCountry } from '../../lib/dishLists/countries'
import { continentOf } from '../../lib/dishLists/locationStatus'
import { fileToCompressedBase64 } from '../../lib/recipeImage'
import { DishListItem } from './types'
import {
    Globe2, CheckCircle2, Circle, ChevronDown, ChevronUp, Search,
    ExternalLink, Loader2, Plus, Pencil, Upload, X
} from 'lucide-react'

interface CountryGridProps {
    listId: string
    items: DishListItem[]
    canEdit: boolean
    onAdded: (item: DishListItem) => void
    onEdit: (item: DishListItem) => void
    /** Hide the collapse chevron (e.g. embedded in the Add dishes popup). */
    collapsible?: boolean
}

type View = 'missing' | 'covered' | 'all'

const CONTINENT_ORDER = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania', 'Other']

const normalizeLink = (value: string): string => {
    const trimmed = value.trim()
    if (!trimmed) return ''
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

interface Cell {
    country: string
    continent: string
    dishes: DishListItem[]
}

function CountryCard({ cell, canEdit, listId, onAdded, onEdit }: {
    cell: Cell
    canEdit: boolean
    listId: string
    onAdded: (item: DishListItem) => void
    onEdit: (item: DishListItem) => void
}) {
    const [name, setName] = useState('')
    const [link, setLink] = useState('')
    const [image, setImage] = useState('')
    const [pendingImage, setPendingImage] = useState<string | null>(null)
    const [imageStatus, setImageStatus] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const covered = cell.dishes.length > 0

    const applyImageFile = async (file: File | null | undefined) => {
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setError('That file is not an image')
            return
        }
        setError(null)
        try {
            const dataUrl = await fileToCompressedBase64(file, setImageStatus)
            setPendingImage(dataUrl)
            setImage('')
        } catch {
            setError('Could not read image')
        }
    }

    const pickImage = async (e: ChangeEvent<HTMLInputElement>) => {
        await applyImageFile(e.target.files?.[0])
        e.target.value = ''
    }

    const onImagePaste = async (e: ClipboardEvent<HTMLInputElement>) => {
        const items = e.clipboardData?.items
        if (items) {
            for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault()
                    await applyImageFile(item.getAsFile())
                    return
                }
            }
        }
        // Plain-text paste (URL or data URI) falls through to the input.
    }

    const save = async (e?: FormEvent) => {
        e?.preventDefault()
        if (busy || imageStatus || !name.trim()) return
        setBusy(true)
        setError(null)
        try {
            const imageValue = pendingImage || image.trim()
            const res = await fetch(`/api/dishLists/${listId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
                body: JSON.stringify({
                    name: name.trim(),
                    country: cell.country,
                    sourceUrl: normalizeLink(link),
                    imageUrl: imageValue ? (/^data:/i.test(imageValue) ? imageValue : normalizeLink(imageValue)) : undefined
                })
            })
            const data = await res.json()
            if (data.success) {
                const imageWanted = !!imageValue
                setName('')
                setLink('')
                setImage('')
                setPendingImage(null)
                if (imageWanted && !data.data?.hasImage) {
                    setError('Dish saved, but the image could not be loaded — edit the dish to retry.')
                }
                onAdded(data.data)
            } else {
                setError(data.message || 'Could not save')
            }
        } catch {
            setError('Request failed')
        } finally {
            setBusy(false)
        }
    }

    if (covered) {
        return (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 p-3.5 flex flex-col gap-2 min-h-[9.5rem]">
                <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span className="text-sm font-bold truncate">{cell.country}</span>
                    {cell.dishes.length > 1 && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-bold shrink-0">
                            {cell.dishes.length}
                        </span>
                    )}
                </div>
                <div className="space-y-1.5 flex-1">
                    {cell.dishes.map(d => (
                        <div key={d._id} className="flex items-center gap-1.5 rounded-lg bg-background/60 px-2 py-1.5 min-w-0">
                            {d.image ? (
                                <a href={`/dishLists/items/${d._id}`} title="View dish" className="shrink-0">
                                    <img src={d.image} alt={d.name} loading="lazy" className="h-8 w-8 rounded-md object-cover" />
                                </a>
                            ) : null}
                            <span className="text-xs truncate flex-1 min-w-0">{d.name}</span>
                            {d.sourceUrl && (
                                <a
                                    href={d.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open link"
                                    className="text-muted-foreground hover:text-accent shrink-0"
                                >
                                    <ExternalLink size={12} />
                                </a>
                            )}
                            {canEdit && (
                                <button
                                    onClick={() => onEdit(d)}
                                    title="Edit dish"
                                    className="text-muted-foreground hover:text-accent shrink-0"
                                >
                                    <Pencil size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-2xl bg-card border border-dashed border-border p-3.5 flex flex-col gap-2 min-h-[9.5rem]">
            <div className="flex items-center gap-1.5 min-w-0">
                <Circle size={12} className="text-muted-foreground shrink-0" />
                <span className="text-sm font-bold text-muted-foreground truncate">{cell.country}</span>
            </div>
            {canEdit && (
                <form onSubmit={save} className="mt-auto flex flex-col gap-1.5">
                    <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Dish name"
                        className="h-8 text-xs"
                        disabled={busy}
                    />
                    <div className="flex items-center gap-1.5">
                        {pendingImage && (
                            <div className="relative shrink-0">
                                <img src={pendingImage} alt="Dish" className="h-8 w-8 rounded-md object-cover border border-border" />
                                <button
                                    type="button"
                                    onClick={() => setPendingImage(null)}
                                    title="Remove image"
                                    className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        )}
                        <Input
                            value={image}
                            onChange={e => setImage(e.target.value)}
                            onPaste={onImagePaste}
                            placeholder={pendingImage ? 'Image added' : 'Image: link or paste'}
                            className="h-8 text-xs min-w-0"
                            disabled={busy || !!pendingImage}
                        />
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            title="Upload image"
                            disabled={busy}
                            className="h-8 w-8 shrink-0 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-accent hover:border-accent flex items-center justify-center"
                        >
                            <Upload size={13} />
                        </button>
                    </div>
                    {imageStatus && <p className="text-[10px] text-muted-foreground">{imageStatus}</p>}
                    <div className="flex gap-1.5">
                        <Input
                            value={link}
                            onChange={e => setLink(e.target.value)}
                            placeholder="Link (optional)"
                            className="h-8 text-xs min-w-0"
                            disabled={busy}
                        />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={busy || !!imageStatus || !name.trim()}
                            title={`Add dish for ${cell.country}`}
                            className="h-8 px-2.5 rounded-xl shrink-0"
                        >
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        </Button>
                    </div>
                    {error && <p className="text-[10px] text-rose-500">{error}</p>}
                </form>
            )}
        </div>
    )
}

export function CountryGrid({ listId, items, canEdit, onAdded, onEdit, collapsible = true }: CountryGridProps) {
    const [collapsed, setCollapsed] = useState(false)
    const [view, setView] = useState<View>('missing')
    const [continent, setContinent] = useState('')
    const [search, setSearch] = useState('')

    const cells = useMemo<Cell[]>(() => {
        const byCountry = new Map<string, DishListItem[]>()
        for (const item of items) {
            const key = canonicalCountry(item.location?.country)
            if (!key) continue
            const arr = byCountry.get(key)
            if (arr) arr.push(item)
            else byCountry.set(key, [item])
        }
        return COUNTRIES.map(country => ({
            country,
            continent: continentOf(country),
            dishes: byCountry.get(country) || []
        }))
    }, [items])

    const coveredCount = useMemo(() => cells.filter(c => c.dishes.length > 0).length, [cells])

    const searched = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return cells
        return cells.filter(c => c.country.toLowerCase().includes(term))
    }, [cells, search])

    const filtered = useMemo(() => searched.filter(c => {
        if (view === 'missing' && c.dishes.length > 0) return false
        if (view === 'covered' && c.dishes.length === 0) return false
        if (continent && c.continent !== continent) return false
        return true
    }), [searched, view, continent])

    const continentChips = useMemo(() => {
        const counts = new Map<string, number>()
        for (const c of searched) counts.set(c.continent, (counts.get(c.continent) || 0) + 1)
        return CONTINENT_ORDER
            .filter(name => (counts.get(name) || 0) > 0)
            .map(name => ({ name, count: counts.get(name) || 0 }))
    }, [searched])

    const groups = useMemo(() => {
        const map = new Map<string, Cell[]>()
        for (const c of filtered) {
            const arr = map.get(c.continent)
            if (arr) arr.push(c)
            else map.set(c.continent, [c])
        }
        return CONTINENT_ORDER
            .filter(name => map.has(name))
            .map(name => ({ name, cells: map.get(name)! }))
    }, [filtered])

    const missingCount = cells.length - coveredCount

    return (
        <div className="rounded-2xl bg-card border border-border overflow-hidden mb-6">
            <div className="flex items-center gap-2 px-4 py-3">
                {collapsible && (
                    <button
                        onClick={() => setCollapsed(v => !v)}
                        title={collapsed ? 'Show country grid' : 'Hide country grid'}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                        {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                )}
                <Globe2 size={16} className="text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-black leading-tight">Country grid</h2>
                    <p className="text-[11px] text-muted-foreground">
                        {coveredCount}/{cells.length} countries · {missingCount} left
                    </p>
                </div>
                <div className="hidden sm:block w-32 md:w-48">
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${cells.length ? (coveredCount / cells.length) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            </div>

            {!collapsed && (
                <>
                    <div className="h-1.5 bg-secondary sm:hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${cells.length ? (coveredCount / cells.length) * 100 : 0}%` }}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
                        <div className="flex rounded-xl border border-border overflow-hidden">
                            {(['missing', 'covered', 'all'] as const).map(v => (
                                <button
                                    key={v}
                                    onClick={() => setView(v)}
                                    className={`px-3 h-8 text-xs font-semibold capitalize transition-colors ${view === v ? 'bg-accent text-accent-foreground' : 'bg-secondary hover:bg-border'}`}
                                >
                                    {v}{v === 'missing' ? ` (${missingCount})` : v === 'covered' ? ` (${coveredCount})` : ''}
                                </button>
                            ))}
                        </div>

                        <select
                            value={continent}
                            onChange={e => setContinent(e.target.value)}
                            className="h-8 rounded-xl bg-secondary border border-border px-2 text-xs font-semibold focus:outline-none focus:border-accent"
                            title="Filter by continent"
                        >
                            <option value="">All continents</option>
                            {continentChips.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
                        </select>

                        <div className="relative flex-1 min-w-[9rem] max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search countries…"
                                className="pl-8 h-8 text-xs"
                            />
                        </div>
                    </div>

                    <div className="p-4 space-y-5">
                        {groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                No countries match this view.
                            </p>
                        ) : (
                            groups.map(group => (
                                <div key={group.name}>
                                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        {group.name}
                                        <span className="px-1.5 py-0.5 rounded-full bg-secondary">{group.cells.length}</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {group.cells.map(cell => (
                                            <CountryCard
                                                key={cell.country}
                                                cell={cell}
                                                canEdit={canEdit}
                                                listId={listId}
                                                onAdded={onAdded}
                                                onEdit={onEdit}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
