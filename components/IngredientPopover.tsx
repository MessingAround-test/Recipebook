import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { formatQuantity } from './stepText'
import { renderFractions } from './Fraction'

/**
 * Small anchored popup shown when an ingredient mention (in step text or a
 * pill) is tapped. Shows the recipe-wide TOTAL amount, which may be split
 * across several steps — flagged via alsoSteps when derived from step use.
 */
interface IngredientPopoverProps {
    ingred: any
    anchorRect: DOMRect | null
    onClose: () => void
    alsoSteps?: number[]
}

const POPUP_WIDTH = 250

export default function IngredientPopover({ ingred, anchorRect, onClose, alsoSteps }: IngredientPopoverProps) {
    const [pos, setPos] = useState<{ top: number; left: number }>()

    useEffect(() => {
        if (!anchorRect) return
        const height = 150
        const spaceAbove = anchorRect.top
        const placeAbove = spaceAbove > height + 12
        const top = placeAbove
            ? Math.max(8, anchorRect.top - height - 8)
            : Math.min(window.innerHeight - height - 8, anchorRect.bottom + 8)
        const rawLeft = anchorRect.left + anchorRect.width / 2 - POPUP_WIDTH / 2
        const left = Math.min(Math.max(8, rawLeft), window.innerWidth - POPUP_WIDTH - 8)
        setPos({ top, left })
    }, [anchorRect])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    if (!ingred || !anchorRect || !pos) return null
    // Pre-formatted amount from the page's scale/conversion pipeline
    const qty = ingred.displayString || formatQuantity(ingred)

    return createPortal(
        <>
            <div className="fixed inset-0 z-[2100]" onClick={onClose} aria-hidden="true" />
            <div
                className="fixed z-[2110] w-[250px] rounded-xl border border-border bg-background shadow-xl p-3 animate-in fade-in zoom-in-95 duration-150"
                style={{ top: pos.top, left: pos.left }}
                role="dialog"
                aria-label={`${ingred.name} amount`}
            >
                <div className="text-sm font-bold truncate">{ingred.name}</div>
                <div className="mt-2 rounded-lg bg-secondary/70 p-2">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        <Info size={11} className="shrink-0" /> Total for this recipe
                    </div>
                    <div className="text-base font-bold leading-snug text-[color:var(--step-ingredient)]">{renderFractions(qty) || 'No amount set'}</div>
                    {ingred.note && <div className="text-xs text-muted-foreground mt-0.5">{ingred.note}</div>}
                </div>
                {alsoSteps && alsoSteps.length > 0 ? (
                    <div className="mt-2 text-[11px] text-muted-foreground">
                        Also used in step{alsoSteps.length > 1 ? 's' : ''} {alsoSteps.join(', ')}
                    </div>
                ) : (
                    <div className="mt-2 text-[11px] text-muted-foreground/70">
                        Recipe-wide total — the amount noted in a step may only be part of it
                    </div>
                )}
            </div>
        </>,
        document.body
    )
}
