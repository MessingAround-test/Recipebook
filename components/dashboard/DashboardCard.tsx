import { ReactNode } from 'react'
import { FiArrowRight } from 'react-icons/fi'
import { cn } from '../../lib/utils'

export type DashboardAccent = 'olive' | 'terracotta' | 'plum' | 'butter' | 'water' | 'berry'

const ACCENTS: Record<DashboardAccent, { chip: string; action: string }> = {
    olive: { chip: 'bg-olive/15 text-olive', action: 'text-olive' },
    terracotta: { chip: 'bg-terracotta/15 text-terracotta', action: 'text-terracotta' },
    plum: { chip: 'bg-plum/15 text-plum', action: 'text-plum' },
    butter: { chip: 'bg-butter/15 text-butter', action: 'text-butter' },
    water: { chip: 'bg-water/15 text-water', action: 'text-water' },
    berry: { chip: 'bg-berry/15 text-berry', action: 'text-berry' },
}

export interface DashboardCardProps {
    title: string
    icon: ReactNode
    accent?: DashboardAccent
    onIconClick?: () => void
    iconTitle?: string
    action?: { label: string; onClick: () => void; hideMobile?: boolean }
    headerRight?: ReactNode
    children: ReactNode
    className?: string
    bodyClassName?: string
}

export default function DashboardCard({
    title,
    icon,
    accent = 'olive',
    onIconClick,
    iconTitle,
    action,
    headerRight,
    children,
    className,
    bodyClassName,
}: DashboardCardProps) {
    const tone = ACCENTS[accent] || ACCENTS.olive
    const chipClasses = cn(
        'hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all md:flex',
        tone.chip,
        onIconClick && 'cursor-pointer hover:brightness-110 active:scale-90'
    )

    return (
        <section
            className={cn(
                /* Mobile: soft card surface (kept a touch quieter than desktop —
                   no icon chips, tighter padding) so sections read as blocks. */
                'flex min-w-0 flex-1 flex-col rounded-2xl bg-card p-3.5 shadow-sm md:p-5',
                className
            )}
        >
            <div className="mb-2 flex items-center justify-between gap-3 md:mb-4">
                <div className="flex min-w-0 items-center gap-2.5">
                    {onIconClick ? (
                        <button
                            type="button"
                            onClick={onIconClick}
                            aria-label={iconTitle || 'Show details'}
                            title={iconTitle || 'Show details'}
                            className={chipClasses}
                        >
                            {icon}
                        </button>
                    ) : (
                        <span className={chipClasses}>{icon}</span>
                    )}
                    <h3 className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground md:text-sm md:font-black md:tracking-tight md:text-foreground">
                        {title}
                    </h3>
                </div>
                {headerRight ? (
                    <div className="flex shrink-0 items-center gap-2">{headerRight}</div>
                ) : action ? (
                    <button
                        type="button"
                        onClick={action.onClick}
                        className={cn(
                            'shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70',
                            action.hideMobile ? 'hidden md:inline-flex' : 'inline-flex',
                            tone.action
                        )}
                    >
                        {action.label} <FiArrowRight size={12} />
                    </button>
                ) : null}
            </div>
            <div className={cn('flex min-w-0 flex-1 flex-col', bodyClassName)}>{children}</div>
        </section>
    )
}
