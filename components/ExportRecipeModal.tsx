import { useEffect, useState } from 'react'
import Modal from 'react-modal'
import { ClipboardCopy, FileJson, FileText, Check, Loader2 } from 'lucide-react'
import {
    buildRecipeExport,
    buildRecipeMarkdownExport,
    buildRecipeTextExport,
    downloadRecipeFile,
    downloadTextFile,
    fetchImageAsDataUrl,
    sanitizeRecipeFilename,
    RecipeFileData
} from '../lib/recipeFile'

interface ExportRecipeModalProps {
    isOpen: boolean
    onClose: () => void
    recipe: Partial<RecipeFileData>
    imageSrc?: string
}

const OPTION_CLASS = 'w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-left transition-colors disabled:opacity-60'

type Busy = 'copy' | 'json' | 'md' | null

export default function ExportRecipeModal({ isOpen, onClose, recipe, imageSrc }: ExportRecipeModalProps) {
    const [isPhoneLayout, setIsPhoneLayout] = useState(false)
    const [busy, setBusy] = useState<Busy>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)')
        const update = () => setIsPhoneLayout(mq.matches)
        update()
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', update)
            return () => mq.removeEventListener('change', update)
        }
        mq.addListener(update)
        return () => mq.removeListener(update)
    }, [])

    const copyToClipboard = async () => {
        setBusy('copy')
        try {
            const text = buildRecipeTextExport(recipe)
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text)
            } else {
                const ta = document.createElement('textarea')
                ta.value = text
                ta.style.position = 'fixed'
                ta.style.opacity = '0'
                document.body.appendChild(ta)
                ta.select()
                document.execCommand('copy')
                ta.remove()
            }
            setCopied(true)
            setTimeout(() => {
                setCopied(false)
                onClose()
            }, 900)
        } finally {
            setBusy(null)
        }
    }

    const exportJson = async () => {
        setBusy('json')
        try {
            const image = await fetchImageAsDataUrl(imageSrc || '')
            downloadRecipeFile(buildRecipeExport({ ...recipe, image }))
            onClose()
        } finally {
            setBusy(null)
        }
    }

    const exportMarkdown = () => {
        setBusy('md')
        try {
            downloadTextFile(
                buildRecipeMarkdownExport(recipe),
                `${sanitizeRecipeFilename(recipe.name || '')}.md`,
                'text/markdown;charset=utf-8'
            )
            onClose()
        } finally {
            setBusy(null)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={() => {
                if (!busy) onClose()
            }}
            style={{
                content: isPhoneLayout ? {
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                    borderBottom: 'none',
                    borderRadius: '1.25rem 1.25rem 0 0',
                    padding: '1.25rem',
                    inset: 'auto 0 0 0',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    marginBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
                    boxShadow: '0 -20px 40px rgba(0,0,0,0.4)'
                } : {
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                    maxWidth: '26rem',
                    margin: '0 auto',
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    inset: 'auto',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                },
                overlay: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: isPhoneLayout ? 'flex-end' : 'center',
                    justifyContent: 'center'
                }
            }}
            contentLabel="Export Recipe Modal"
        >
            <div className="flex justify-between items-center mb-1">
                <h2 className="text-lg font-bold">Export Recipe</h2>
                <button
                    onClick={onClose}
                    className="bg-secondary hover:bg-secondary/80 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                    disabled={!!busy}
                >
                    <img src="/cross.png" className="w-4 h-4 invert-[.25] dark:invert" alt="close" />
                </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Choose how you want to export this recipe.</p>

            <div className="flex flex-col gap-3">
                <button
                    onClick={copyToClipboard}
                    className={OPTION_CLASS}
                    disabled={!!busy}
                >
                    <span className="w-10 h-10 rounded-lg bg-secondary border border-border/40 flex items-center justify-center shrink-0">
                        {busy === 'copy' ? <Loader2 className="w-5 h-5 animate-spin" /> : copied ? <Check className="w-5 h-5 text-emerald-500" /> : <ClipboardCopy className="w-5 h-5" />}
                    </span>
                    <span className="min-w-0">
                        <span className="block font-semibold text-sm">{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                            {copied ? 'Closing…' : 'Formatted plain text — headers with spacing, ingredient list, numbered steps'}
                        </span>
                    </span>
                </button>

                <button
                    onClick={exportJson}
                    className={OPTION_CLASS}
                    disabled={!!busy}
                >
                    <span className="w-10 h-10 rounded-lg bg-secondary border border-border/40 flex items-center justify-center shrink-0">
                        {busy === 'json' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileJson className="w-5 h-5" />}
                    </span>
                    <span className="min-w-0">
                        <span className="block font-semibold text-sm">JSON File</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">Full data, incl. embedded image — re-importable into RecipeBook</span>
                    </span>
                </button>

                <button
                    onClick={exportMarkdown}
                    className={OPTION_CLASS}
                    disabled={!!busy}
                >
                    <span className="w-10 h-10 rounded-lg bg-secondary border border-border/40 flex items-center justify-center shrink-0">
                        {busy === 'md' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                    </span>
                    <span className="min-w-0">
                        <span className="block font-semibold text-sm">Markdown File (.md)</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">Headings and tick-boxes on ingredients — great for Obsidian / Notion</span>
                    </span>
                </button>
            </div>
        </Modal>
    )
}
