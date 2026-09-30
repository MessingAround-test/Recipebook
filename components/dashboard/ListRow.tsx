import { ReactNode } from 'react'
import { FiChevronRight } from 'react-icons/fi'
import { cn } from '../../lib/utils'

export interface ListRowProps {
    leading?: ReactNode
    title: ReactNode
    subtitle?: ReactNode
    meta?: ReactNode
    trailing?: ReactNode
    onClick?: () => void
    className?: string
}

export default function ListRow({ leading, title, subtitle, meta, trailing, onClick, className }: ListRowProps) {
    const content = (
        <>
            {leading != null && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/70 text-base">
                    {leading}
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{title}</span>
                {subtitle != null && subtitle !== '' && (
                    <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">{subtitle}</span>
                )}
                {meta != null && (
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                        {meta}
                    </span>
                )}
            </span>
            {trailing !== undefined ? (
                trailing
            ) : (
                <FiChevronRight size={16} className="shrink-0 text-muted-foreground" />
            )}
        </>
    )

    const base = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all'

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={cn(base, 'group/row hover:bg-muted/60 active:scale-[0.99]', className)}
            >
                {content}
            </button>
        )
    }

    return <div className={cn(base, className)}>{content}</div>
}
