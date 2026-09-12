import { formatQuantity } from './stepText'
import { renderFractions } from './Fraction'

/**
 * Ingredient tags under a step — informational only (no click action):
 * name + amount, as quiet as possible so the step text stays the focus.
 */
interface PillRowProps {
    ingreds: any[]
    onSelect?: (ingred: any) => void
}

export default function PillRow({ ingreds }: PillRowProps) {
    if (!ingreds || ingreds.length === 0) return null
    return (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {ingreds.map((ingred, i) => {
                const name = String(ingred.name || '').trim()
                const qty = formatQuantity(ingred)
                return (
                    <span
                        key={ingred._id || i}
                        title={ingred.note || undefined}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-secondary border border-border/60 px-2 py-0.5"
                    >
                        <span className="text-[11px] leading-none font-semibold text-foreground/80">{name}</span>
                        {qty && <span className="text-[10px] leading-none font-bold text-[color:var(--step-ingredient)]">{renderFractions(qty)}</span>}
                        {ingred.note && (
                            <span className="text-[10px] leading-none text-muted-foreground italic truncate max-w-[110px]">{ingred.note}</span>
                        )}
                    </span>
                )
            })}
        </div>
    )
}
