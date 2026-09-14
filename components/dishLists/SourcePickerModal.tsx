import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { X, Loader2, Search, ExternalLink, RefreshCw } from 'lucide-react'
import { CRITERIA_OPTIONS, criterionLabel, criteriaFromUser } from '../../lib/dishLists/criteria'
import { DishListItem, RecipeSourceCandidate } from './types'

interface SourcePickerModalProps {
    isOpen: boolean
    onClose: () => void
    item: DishListItem | null
    listId: string
    onPick: (url: string) => void
}

const token = () => (typeof localStorage !== 'undefined' ? localStorage.getItem('Token') || '' : '')

export function SourcePickerModal({ isOpen, onClose, item, listId, onPick }: SourcePickerModalProps) {
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<RecipeSourceCandidate[]>([])
    const [query, setQuery] = useState('')
    const [selectedCriteria, setSelectedCriteria] = useState<string[]>([])
    const [profileCriteria, setProfileCriteria] = useState<string[]>([])
    const [useProfile, setUseProfile] = useState(true)
    const [manual, setManual] = useState('')
    const searchSeq = useRef(0)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const runSearch = async (criteria: string[]) => {
        if (!item) return
        const seq = ++searchSeq.current
        setLoading(true)
        try {
            const res = await fetch('/api/dishLists/searchSource', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token() },
                body: JSON.stringify({ name: item.name, listId, criteria })
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
            if (seq === searchSeq.current) setLoading(false)
        }
    }

    // Criteria toggles are debounced so quick taps fire one search instead of
    // several back-to-back DuckDuckGo requests (which get rate limited).
    const scheduleSearch = (criteria: string[]) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => runSearch(criteria), 350)
    }

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

    // On open: pull the user's dietary requirements from Settings and use them
    // by default, then search.
    useEffect(() => {
        if (!isOpen || !item) return
        let cancelled = false
        setResults([])
        setManual('')
        setUseProfile(true)
        setProfileCriteria([])
        setSelectedCriteria([])
        ;(async () => {
            let profile: string[] = []
            try {
                const res = await fetch('/api/UserDetails', { headers: { edgetoken: token() } })
                const data = await res.json()
                profile = criteriaFromUser(data.res)
            } catch { /* no profile — search without criteria */ }
            if (cancelled) return
            setProfileCriteria(profile)
            setSelectedCriteria(profile)
            runSearch(profile)
        })()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, item?._id, listId])

    if (!isOpen || !item) return null

    const toggleProfile = () => {
        const nextUse = !useProfile
        const next = nextUse
            ? Array.from(new Set([...selectedCriteria, ...profileCriteria]))
            : selectedCriteria.filter(c => !profileCriteria.includes(c))
        setUseProfile(nextUse)
        setSelectedCriteria(next)
        scheduleSearch(next)
    }

    const toggleCriterion = (value: string) => {
        const next = selectedCriteria.includes(value)
            ? selectedCriteria.filter(c => c !== value)
            : [...selectedCriteria, value]
        setSelectedCriteria(next)
        scheduleSearch(next)
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div className="w-full sm:max-w-2xl bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-card/95 backdrop-blur px-5 py-4 border-b border-border flex items-center justify-between">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold truncate">Find a recipe for {item.name}</h2>
                        <p className="text-xs text-muted-foreground truncate">Search: {query || item.name}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Dietary criteria — appended to the search */}
                    <div className="rounded-2xl bg-secondary/60 border border-border p-3.5 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-bold">My dietary requirements</p>
                                <p className="text-[11px] text-muted-foreground leading-snug">
                                    {profileCriteria.length > 0
                                        ? 'From your settings. Toggle off to ignore them for this search.'
                                        : 'None set in settings — add criteria below.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={useProfile}
                                onClick={toggleProfile}
                                disabled={profileCriteria.length === 0}
                                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40 ${useProfile && profileCriteria.length > 0 ? 'bg-accent' : 'bg-border'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${useProfile && profileCriteria.length > 0 ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
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

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{selectedCriteria.length === 0 ? 'No criteria applied' : `Applied: ${selectedCriteria.map(criterionLabel).join(', ')}`}</span>
                            <button type="button" onClick={() => runSearch(selectedCriteria)} className="inline-flex items-center gap-1 font-semibold hover:text-accent">
                                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Re-search
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="animate-spin" size={22} />
                        </div>
                    ) : results.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No results found. Try removing a criterion, or paste a recipe URL below.</p>
                    ) : (
                        <div className="space-y-2">
                            {results.map(r => (
                                <div key={r.url} className="flex items-start gap-3 p-3 rounded-xl bg-secondary border border-border">
                                    <div className="min-w-0 flex-1">
                                        <a href={r.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-foreground hover:text-accent inline-flex items-center gap-1">
                                            {r.title} <ExternalLink size={12} />
                                        </a>
                                        <p className="text-[11px] text-muted-foreground truncate">{r.url}</p>
                                        {r.snippet && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.snippet}</p>}
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={() => onPick(r.url)}>Import</Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="pt-2 border-t border-border space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1">Or paste a recipe URL</label>
                        <div className="flex gap-2">
                            <input
                                value={manual}
                                onChange={e => setManual(e.target.value)}
                                placeholder="https://…"
                                className="flex-1 h-11 rounded-xl bg-secondary border border-border px-3 text-sm focus:outline-none focus:border-accent"
                            />
                            <Button disabled={!manual.trim()} onClick={() => onPick(manual.trim())}>Import</Button>
                        </div>
                        {item.recipeSourceUrl && (
                            <Button variant="outline" className="w-full" onClick={() => onPick(item.recipeSourceUrl as string)}>
                                Use TasteAtlas authentic recipe
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
