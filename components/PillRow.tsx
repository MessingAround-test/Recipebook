import { formatQuantity } from './stepText'

/**
 * Ingredient pills under a step — only shown when the step matches ≤ 4
 * ingredients (longer lists fall back to the inline underlined links).
 * Tapping a pill opens the same popover as an inline link.
 */
interface PillRowProps {
    ingreds: any[]
    onSelect: (ingred: any) => void
}

export default function PillRow({ ingreds, onSelect }: PillRowProps) {
    if (!ingreds || ingreds.length === 0) return null
    return (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ingreds.map((ingred, i) => (
                <button
                    key={ingred._id || i}
                    type="button"
                    onClick={() => onSelect(ingred)}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border/40 px-2.5 py-0.5 text-[11px] font-semibold text-foreground/80 hover:border-accent/50 hover:text-accent transition-colors"
                    title={`${ingred.name} — tap for amount`}
                >
                    <span className="truncate max-w-[140px]">{ingred.name}</span>
                    <span className="text-muted-foreground">{formatQuantity(ingred)}</span>
                </button>
            ))}
        </div>
    )
}
