import { useState } from 'react'
import { Button } from '../ui/button'
import { X, Loader2, ClipboardPaste, Link2 } from 'lucide-react'
import { DishListSummary } from './types'

interface PasteModalProps {
    isOpen: boolean
    onClose: () => void
    list: DishListSummary
    onDone: () => void
}

export function PasteModal({ isOpen, onClose, list, onDone }: PasteModalProps) {
    const [mode, setMode] = useState<'html' | 'urls'>('html')
    const [html, setHtml] = useState('')
    const [urls, setUrls] = useState('')
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<string | null>(null)

    if (!isOpen) return null

    const scraped = async () => {
        const payload = mode === 'html' ? { html } : { urls }
        if (!payload.html && !payload.urls) return
        setBusy(true)
        setResult(null)
        try {
            const res = await fetch(`/api/dishLists/${list._id}/scrape`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
                body: JSON.stringify({ ...payload, dietaryFilters: list.dietaryFilters, sourceUrl: list.sourceUrl })
            })
            const data = await res.json()
            if (data.success) {
                setResult(data.message || 'Done')
                onDone()
            } else {
                setResult(`Error: ${data.message || 'Could not parse'}`)
            }
        } catch (e: any) {
            setResult(`Error: ${e?.message || 'request failed'}`)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div className="w-full sm:max-w-2xl bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-card/95 backdrop-blur px-5 py-4 border-b border-border flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold">Add dishes</h2>
                        <p className="text-xs text-muted-foreground">{list.name}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setMode('html')}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${mode === 'html' ? 'bg-accent text-accent-foreground border-accent' : 'bg-secondary border-border hover:border-accent'}`}>
                            <ClipboardPaste size={14} /> Paste page HTML
                        </button>
                        <button type="button" onClick={() => setMode('urls')}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${mode === 'urls' ? 'bg-accent text-accent-foreground border-accent' : 'bg-secondary border-border hover:border-accent'}`}>
                            <Link2 size={14} /> Paste dish URLs
                        </button>
                    </div>

                    <p className="text-[11px] leading-snug text-muted-foreground">
                        TasteAtlas blocks automated fetching, so open the list in your browser, then paste the page source (View Source → Ctrl+A → Ctrl+C) or a newline list of dish URLs/slugs. Names, categories, regions, descriptions and images are pulled in automatically — use <strong>Blurbs &amp; images</strong> afterwards only to fill any gaps.
                    </p>

                    {mode === 'html' ? (
                        <textarea
                            value={html}
                            onChange={e => setHtml(e.target.value)}
                            placeholder="<html> … paste the TasteAtlas list page source here …"
                            className="w-full min-h-[220px] rounded-xl bg-secondary border border-border p-3 text-xs font-mono resize-y focus:outline-none focus:border-accent"
                        />
                    ) : (
                        <textarea
                            value={urls}
                            onChange={e => setUrls(e.target.value)}
                            placeholder={'https://www.tasteatlas.com/pizza-napoletana\nhttps://www.tasteatlas.com/pasta-carbonara'}
                            className="w-full min-h-[220px] rounded-xl bg-secondary border border-border p-3 text-xs font-mono resize-y focus:outline-none focus:border-accent"
                        />
                    )}

                    {result && <p className="text-sm font-medium text-foreground bg-secondary rounded-xl p-3">{result}</p>}

                    <Button onClick={scraped} disabled={busy || (mode === 'html' ? !html.trim() : !urls.trim())} className="w-full h-11 rounded-xl">
                        {busy ? <><Loader2 size={16} className="animate-spin" /> Parsing…</> : 'Parse & add dishes'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
