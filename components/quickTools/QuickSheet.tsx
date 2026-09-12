import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface QuickSheetProps {
    open: boolean
    title: string
    subtitle?: string
    onClose: () => void
    children: ReactNode
}

// Shared overlay for every Quick Tools panel: bottom sheet on phones, centred
// dialog on desktop. Mirrors the chrome used by the shopping list overlays.
export default function QuickSheet({ open, title, subtitle, onClose, children }: QuickSheetProps) {
    useEffect(() => {
        if (!open) return
        document.body.style.overflow = 'hidden'
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = ''
            window.removeEventListener('keydown', onKey)
        }
    }, [open, onClose])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center sm:p-5">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="relative z-10 w-full sm:max-w-md max-h-[calc(100dvh-1rem)] sm:max-h-[min(640px,calc(100dvh-2.5rem))] flex flex-col rounded-t-3xl sm:rounded-3xl border border-border/60 bg-card shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300"
            >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />
                <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border/50">
                    <div className="min-w-0">
                        <h2 className="m-0 text-base font-bold tracking-tight truncate">{title}</h2>
                        {subtitle && <p className="m-0 mt-0.5 text-[11px] text-muted-foreground leading-snug">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 p-2.5 -mr-2 -mt-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors flex items-center justify-center min-h-[40px] min-w-[40px]"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
                    {children}
                </div>
            </div>
        </div>
    )
}
