import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from './ui/button'

interface HiddenItemsManagerProps {
    onPatternsChanged?: () => void
}

export default function HiddenItemsManager({ onPatternsChanged }: HiddenItemsManagerProps) {
    const [patterns, setPatterns] = useState<string[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [filterText, setFilterText] = useState('')
    const [hideFiltered, setHideFiltered] = useState(false)
    const [bulkWord, setBulkWord] = useState('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const token = typeof window !== 'undefined' ? localStorage.getItem('Token') || '' : ''

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [patternRes, productRes] = await Promise.all([
                fetch('/api/HiddenItems', { headers: { 'edgetoken': token } }),
                fetch('/api/Ingredients', { headers: { 'edgetoken': token } })
            ])
            const patternData = await patternRes.json()
            const productData = await productRes.json()
            setPatterns(patternData.success ? patternData.data : [])
            setProducts(productData.res || [])
        } catch (err) {
            console.error('Failed to load hidden item data:', err)
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        loadData()
    }, [loadData])

    const isNameHidden = useCallback((name: string) => {
        const lower = String(name || '').toLowerCase()
        return patterns.some(p => lower.includes(p))
    }, [patterns])

    const matchingPatternsFor = useCallback((name: string) => {
        const lower = String(name || '').toLowerCase()
        return patterns.filter(p => lower.includes(p))
    }, [patterns])

    const countForPattern = useCallback((pattern: string) => {
        return products.filter(p => String(p?.name || '').toLowerCase().includes(pattern)).length
    }, [products])

    const filteredProducts = useMemo(() => {
        const term = filterText.trim().toLowerCase()
        return products.filter(p => {
            const name = String(p?.name || '').toLowerCase()
            if (term && !name.includes(term)) return false
            if (hideFiltered && !isNameHidden(name)) return false
            return true
        })
    }, [products, filterText, hideFiltered, isNameHidden])

    const savePatterns = async (action: 'add' | 'remove', newPatterns: string[]) => {
        if (newPatterns.length === 0) return
        setSaving(true)
        try {
            const res = await fetch('/api/HiddenItems', {
                method: action === 'add' ? 'POST' : 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': token
                },
                body: JSON.stringify({ patterns: newPatterns })
            })
            const data = await res.json()
            if (data.success) {
                setPatterns(data.data)
                if (onPatternsChanged) onPatternsChanged()
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

    const handleToggleItem = async (name: string) => {
        if (!isNameHidden(name)) {
            await savePatterns('add', [name.toLowerCase()])
            return
        }
        // Hidden: remove the pattern(s) covering this exact item so it becomes visible.
        const covering = matchingPatternsFor(name)
        if (covering.length === 0) return
        const affected = covering.reduce((sum, p) => sum + countForPattern(p), 0)
        if (affected > covering.length) {
            const ok = confirm(
                `"${name}" is hidden by ${covering.length} pattern(s): ${covering.map(c => `"${c}"`).join(', ')}.\n` +
                `Removing them will unhide ${affected} product(s) in total. Continue?`
            )
            if (!ok) return
        }
        await savePatterns('remove', covering)
    }

    return (
        <div className="w-full">
            <div className="flex flex-col gap-4">
                {/* Bulk word controls */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={bulkWord}
                        onChange={(e) => setBulkWord(e.target.value)}
                        placeholder="Word to match in product names (e.g. kombucha)"
                        className="flex-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="flex-1 sm:flex-none"
                            onClick={handleHideAllMatching}
                            disabled={saving || !bulkWord.trim()}
                        >
                            Hide all matching
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="flex-1 sm:flex-none"
                            onClick={handleUnhideAllMatching}
                            disabled={saving || !bulkWord.trim()}
                        >
                            Unhide all matching
                        </Button>
                    </div>
                </div>

                {/* Active patterns */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Hidden by ({patterns.length}):
                    </span>
                    {patterns.length === 0 && (
                        <span className="text-xs text-muted-foreground">Nothing hidden yet. Hide a word or an individual product to get started.</span>
                    )}
                    {patterns.map(p => (
                        <span
                            key={p}
                            className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30 px-2.5 py-1 text-xs font-medium"
                        >
                            {p}
                            <span className="opacity-60">({countForPattern(p)})</span>
                            <button
                                type="button"
                                className="hover:opacity-70"
                                onClick={() => savePatterns('remove', [p])}
                                disabled={saving}
                                title={`Unhide all ${countForPattern(p)} product(s) matching "${p}"`}
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                </div>

                {/* List controls */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="Filter products by name..."
                        className="flex-1 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant={hideFiltered ? 'default' : 'outline'}
                            className="flex-1 sm:flex-none"
                            onClick={() => setHideFiltered(v => !v)}
                        >
                            {hideFiltered ? 'Showing hidden only' : 'Show hidden only'}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={loadData} disabled={loading}>
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Product list */}
                <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
                    {loading && (
                        <div className="p-6 text-center text-sm text-muted-foreground">Loading products...</div>
                    )}
                    {!loading && filteredProducts.length === 0 && (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                            {products.length === 0 ? 'No products found yet. Run a search first.' : 'No products match your filter.'}
                        </div>
                    )}
                    {!loading && filteredProducts.map((p) => {
                        const hidden = isNameHidden(p?.name)
                        const covering = matchingPatternsFor(p?.name)
                        return (
                            <div
                                key={p?.id || p?.name}
                                className={`flex flex-row items-center gap-3 px-4 py-2 border-b border-border last:border-b-0 text-sm ${hidden ? 'opacity-60 bg-destructive/5' : ''}`}
                            >
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={hidden ? 'outline' : 'ghost'}
                                    className={`h-7 text-[10px] shrink-0 ${hidden ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-destructive hover:bg-destructive/10'}`}
                                    onClick={() => handleToggleItem(p?.name)}
                                    disabled={saving}
                                >
                                    {hidden ? 'Show' : 'Hide'}
                                </Button>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{p?.name}</div>
                                    {hidden && covering.length > 0 && (
                                        <div className="text-[10px] text-muted-foreground">
                                            hidden by: {covering.map(c => `"${c}"`).join(', ')}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {p?.source && (
                                        <div className="flex items-center gap-1.5">
                                            <img src={`/${p.source}.png`} alt="" className="w-3 h-3 object-contain" />
                                            <span className="text-[10px] text-muted-foreground">{p.source}</span>
                                        </div>
                                    )}
                                    {p?.price !== undefined && (
                                        <span className="text-xs font-bold whitespace-nowrap">${Number(p.price).toFixed(2)}</span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
