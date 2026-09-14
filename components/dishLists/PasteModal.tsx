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

// Runs on the TasteAtlas page (same origin, so Cloudflare lets it through).
// It clicks "Load more" until every dish is rendered, then copies the full
// page HTML so the user can paste it here. Falls back to a selectable textarea
// when the async clipboard call is not permitted.
const COPY_LIST_BOOKMARKLET = 'javascript:' + encodeURIComponent(
    `(async()=>{` +
    `const f=()=>document.querySelector('button[hx-get*="food-secondary-list"]');` +
    `let g=0;while(f()&&g++<12){f().click();await new Promise(r=>setTimeout(r,1800));}` +
    `const h=document.documentElement.outerHTML;` +
    `try{await navigator.clipboard.writeText(h);alert('Copied the full list HTML ('+h.length+' characters). Paste it into Recipebook.');}` +
    `catch(e){const t=document.createElement('textarea');t.value=h;` +
    `t.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:2147483647;font:12px monospace;background:#fff;color:#000';` +
    `document.body.appendChild(t);t.focus();t.select();try{document.execCommand('copy');}catch(_){}` +
    `alert('Full HTML is shown selected. Press Ctrl+C to copy, then paste it into Recipebook.');}})();`
)

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
                        TasteAtlas blocks automated fetching, so open the list in your browser, then paste the full page HTML (see the helper below — the page only ships the first 10 dishes until you load the rest) or a newline list of dish URLs/slugs. Names, categories, regions, descriptions and images are pulled in automatically — use <strong>Blurbs &amp; images</strong> afterwards only to fill any gaps.
                    </p>

                    {mode === 'html' && (
                        <div className="rounded-2xl bg-secondary/60 border border-border p-3.5 space-y-2">
                            <p className="text-sm font-bold">Get every dish (TasteAtlas only embeds the first 10)</p>
                            <p className="text-[11px] leading-snug text-muted-foreground">
                                Drag the button below onto your bookmarks bar. Open the TasteAtlas list in your browser, click the saved bookmark once — it loads all remaining dishes and copies the full page HTML. Then paste it above.
                            </p>
                            <a
                                href={COPY_LIST_BOOKMARKLET}
                                onClick={e => e.preventDefault()}
                                draggable
                                title="Drag me to your bookmarks bar"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-semibold cursor-grab active:cursor-grabbing select-none"
                            >
                                <ClipboardPaste size={14} /> Copy full list HTML
                            </a>
                        </div>
                    )}

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
