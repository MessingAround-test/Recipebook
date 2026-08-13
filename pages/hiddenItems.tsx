import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Router from 'next/router'
import { Layout } from '../components/Layout'
import { useAuthGuard } from '../lib/useAuthGuard'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'

interface HiddenItemResult {
    id?: string
    name: string
    source?: string
    price?: number
    unit_price?: number
    unit_price_converted?: number
    quantity?: number
    quantity_unit?: string
    search_term?: string
    total_price?: number
    rank?: number
    hidden?: boolean
    hiddenBy?: string[]
    grams_per_each?: number
    conversion_source?: string
    [key: string]: any
}

type StatusFilter = 'all' | 'visible' | 'hidden'

const EXAMPLE_TERMS = ['watermelon', 'kombucha', 'banana', 'avocado']

export default function HiddenItemsPage() {
    const isAuthed = useAuthGuard()

    const [patterns, setPatterns] = useState<string[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [results, setResults] = useState<HiddenItemResult[]>([])
    const [hasSearched, setHasSearched] = useState(false)
    const [searching, setSearching] = useState(false)
    const [saving, setSaving] = useState(false)
    const [bulkWord, setBulkWord] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [error, setError] = useState('')

    const token = typeof window !== 'undefined' ? localStorage.getItem('Token') || '' : ''

    const tagResults = useCallback((list: HiddenItemResult[], pats: string[]): HiddenItemResult[] => {
        return list.map(item => {
            const lower = String(item?.name || '').toLowerCase()
            const hiddenBy = pats.filter(p => lower.includes(p))
            return { ...item, hidden: hiddenBy.length > 0, hiddenBy }
        })
    }, [])

    const loadPatterns = useCallback(async () => {
        try {
            const res = await fetch('/api/HiddenItems', { headers: { 'edgetoken': token } })
            const data = await res.json()
            setPatterns(data.success ? data.data : [])
        } catch (err) {
            console.error('Failed to load hidden item patterns:', err)
        }
    }, [token])

    useEffect(() => {
        if (isAuthed) loadPatterns()
    }, [isAuthed, loadPatterns])

    const isNameHidden = useCallback((name: string) => {
        const lower = String(name || '').toLowerCase()
        return patterns.some(p => lower.includes(p))
    }, [patterns])

    const matchingPatternsFor = useCallback((name: string) => {
        const lower = String(name || '').toLowerCase()
        return patterns.filter(p => lower.includes(p))
    }, [patterns])

    const countForPattern = useCallback((pattern: string) => {
        return results.filter(p => String(p?.name || '').toLowerCase().includes(pattern)).length
    }, [results])

    const runSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        const term = searchTerm.trim()
        if (!term) return
        setSearching(true)
        setError('')
        try {
            const url = `/api/Ingredients?name=${encodeURIComponent(term)}&supplier=WW,Coles,Aldi,IGA,Panetta&includeHidden=true`
            const res = await fetch(url, { headers: { 'edgetoken': token } })
            const data = await res.json()
            if (data.success === false) {
                setError(data.message || 'Search failed')
                setResults([])
            } else {
                setResults(tagResults(data.res || [], patterns))
            }
            setHasSearched(true)
        } catch (err) {
            console.error('Search failed:', err)
            setError('Search failed')
        } finally {
            setSearching(false)
        }
    }

    const savePatterns = async (action: 'add' | 'remove', newPatterns: string[]) => {
        if (!newPatterns || newPatterns.length === 0) return
        setSaving(true)
        try {
            const res = await fetch('/api/HiddenItems', {
                method: action === 'add' ? 'POST' : 'DELETE',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({ patterns: newPatterns })
            })
            const data = await res.json()
            if (data.success) {
                setPatterns(data.data)
                setResults(prev => tagResults(prev, data.data))
            } else {
                alert('Failed to update hidden items: ' + (data.message || 'unknown error'))
            }
        } catch (err) {
            console.error('Error updating hidden items:', err)
            alert('Error updating hidden items')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleItem = async (name: string) => {
        if (!isNameHidden(name)) {
            await savePatterns('add', [name.toLowerCase()])
            return
        }
        const covering = matchingPatternsFor(name)
        if (covering.length === 0) return
        const affected = covering.reduce((sum, p) => sum + countForPattern(p), 0)
        if (affected > covering.length) {
            const ok = confirm(
                `"${name}" is hidden by ${covering.length} pattern(s): ${covering.map(c => `"${c}"`).join(', ')}.\n` +
                `Removing them will unhide ${affected} product(s) in total for this search. Continue?`
            )
            if (!ok) return
        }
        await savePatterns('remove', covering)
    }

    const handleHideAllMatching = () => {
        const word = bulkWord.trim().toLowerCase()
        if (!word) return
        savePatterns('add', [word])
    }

    const handleUnhideAllMatching = () => {
        const word = bulkWord.trim().toLowerCase()
        if (!word) return
        savePatterns('remove', [word])
    }

    const visibleCount = useMemo(() => results.filter(r => !r.hidden).length, [results])
    const hiddenCount = useMemo(() => results.filter(r => r.hidden).length, [results])

    const shownResults = useMemo(() => {
        if (statusFilter === 'hidden') return results.filter(r => r.hidden)
        if (statusFilter === 'visible') return results.filter(r => !r.hidden)
        return results
    }, [results, statusFilter])

    const formatUnitPrice = (p: HiddenItemResult) => {
        const val = p.unit_price_converted
        if (val === undefined || val === null) return null
        return val < 1 ? `${(val * 100).toFixed(2)}¢` : `$${Number(val).toFixed(2)}`
    }

    if (!isAuthed) return null

    return (
        <Layout title="Hidden Item Manager">
            <div className="max-w-5xl mx-auto px-4 py-8">
                <PageHeader title="Hidden Item Manager">
                    <Button variant="outline" onClick={() => Router.push('/ingredientResearch')}>
                        ← Back to Ingredients
                    </Button>
                </PageHeader>

                <div className="glass-card p-6 mb-8">
                    <p className="text-xs text-muted-foreground mb-5">
                        Search for any term (e.g. "watermelon") to preview exactly which products and prices a
                        normal search returns. Products matching a hidden word are excluded from real search
                        results — hide the ones that don't actually match what you searched for.
                    </p>

                    <form onSubmit={runSearch} className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search term, e.g. watermelon"
                            className="flex-1 h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        <Button type="submit" size="lg" disabled={searching || !searchTerm.trim()}>
                            {searching ? 'Searching...' : '🔍 Search'}
                        </Button>
                    </form>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Try:</span>
                        {EXAMPLE_TERMS.map(term => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => {
                                    setSearchTerm(term)
                                    setStatusFilter('all')
                                }}
                                className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-muted-foreground border border-white/10"
                            >
                                {term}
                            </button>
                        ))}
                    </div>

                    {hasSearched && !searching && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${visibleCount > 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-white/5 text-muted-foreground'}`}>
                                {visibleCount} shown
                            </span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${hiddenCount > 0 ? 'bg-destructive/15 text-destructive' : 'bg-white/5 text-muted-foreground'}`}>
                                {hiddenCount} hidden
                            </span>
                            <span className="text-xs text-muted-foreground">
                                of {results.length} product(s) for "{searchTerm.trim()}"
                            </span>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mb-8 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                        {error}
                    </div>
                )}

                {/* Results */}
                <div className="glass-card p-0 overflow-hidden mb-8">
                    <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border">
                        <div className="flex gap-1.5">
                            {(['all', 'visible', 'hidden'] as StatusFilter[]).map(f => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setStatusFilter(f)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors border ${
                                        statusFilter === f
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        <div className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
                            Prices for 1 {results[0]?.quantity_unit || 'each'}
                        </div>
                    </div>

                    {!hasSearched && (
                        <div className="p-10 text-center text-sm text-muted-foreground">
                            Search above to preview what a real search returns and which products are hidden.
                        </div>
                    )}

                    {hasSearched && searching && (
                        <div className="p-10 text-center text-sm text-muted-foreground">Searching...</div>
                    )}

                    {hasSearched && !searching && shownResults.length === 0 && (
                        <div className="p-10 text-center text-sm text-muted-foreground">
                            No {statusFilter !== 'all' ? statusFilter + ' ' : ''}products found for this search.
                        </div>
                    )}

                    {hasSearched && !searching && shownResults.map((p) => {
                        const hidden = !!p.hidden
                        const covering = p.hiddenBy || []
                        const unitPrice = formatUnitPrice(p)
                        return (
                            <div
                                key={p.id || `${p.name}|${p.source}|${p.price}`}
                                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 border-b border-border last:border-b-0 text-sm ${hidden ? 'opacity-70 bg-destructive/5' : ''}`}
                            >
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={hidden ? 'outline' : 'ghost'}
                                    className={`h-7 text-[10px] shrink-0 ${hidden ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-destructive hover:bg-destructive/10'}`}
                                    onClick={() => handleToggleItem(p.name)}
                                    disabled={saving}
                                >
                                    {hidden ? 'Show' : 'Hide'}
                                </Button>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{p.name}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {hidden ? (
                                            <span className="text-destructive">hidden by: {covering.map(c => `"${c}"`).join(', ')}</span>
                                        ) : (
                                            <span>shown in results</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                                    {p.source && (
                                        <div className="flex items-center gap-1.5">
                                            <img src={`/${p.source}.png`} alt="" className="w-3 h-3 object-contain" />
                                            <span className="text-[10px] text-muted-foreground">{p.source}</span>
                                        </div>
                                    )}
                                    <div className="text-right">
                                        <span className="text-xs font-bold whitespace-nowrap">
                                            ${Number(p.total_price ?? p.price).toFixed(2)}
                                        </span>
                                        {unitPrice && (
                                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {unitPrice} / {p.quantity_unit || 'unit'}
                                            </div>
                                        )}
                                        {p.quantity !== undefined && (
                                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {p.quantity} {p.quantity_unit}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Bulk actions */}
                <div className="glass-card p-6 mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground mb-1">Bulk hide / unhide</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                        Hide or unhide every product whose name contains a word. Hidden words apply to every search.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={bulkWord}
                            onChange={(e) => setBulkWord(e.target.value)}
                            placeholder="Word to match in product names (e.g. kombucha)"
                            className="flex-1 h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="flex-1 sm:flex-none"
                                onClick={handleHideAllMatching}
                                disabled={saving || !bulkWord.trim()}
                            >
                                Hide all matching
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="flex-1 sm:flex-none"
                                onClick={handleUnhideAllMatching}
                                disabled={saving || !bulkWord.trim()}
                            >
                                Unhide all matching
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Active patterns */}
                <div className="glass-card p-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Hidden by ({patterns.length}):
                        </span>
                        {patterns.length === 0 && (
                            <span className="text-xs text-muted-foreground">Nothing hidden yet.</span>
                        )}
                        {patterns.map(p => (
                            <span
                                key={p}
                                className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30 px-2.5 py-1 text-xs font-medium"
                            >
                                {p}
                                {hasSearched && <span className="opacity-60">({countForPattern(p)})</span>}
                                <button
                                    type="button"
                                    className="hover:opacity-70"
                                    onClick={() => savePatterns('remove', [p])}
                                    disabled={saving}
                                    title={`Unhide all products matching "${p}"`}
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </Layout>
    )
}
