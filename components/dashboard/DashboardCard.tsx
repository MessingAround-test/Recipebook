import { ReactNode } from 'react'
import { FiArrowRight } from 'react-icons/fi'
import { cn } from '../../lib/utils'

export type DashboardAccent = 'emerald' | 'orange' | 'violet' | 'amber' | 'sky'

const ACCENTS: Record<DashboardAccent, { chip: string; action: string }> = {
    emerald: { chip: 'bg-emerald-500/15 text-emerald-400', action: 'text-emerald-400 hover:text-emerald-300' },
    orange: { chip: 'bg-orange-500/15 text-orange-400', action: 'text-orange-400 hover:text-orange-300' },
    violet: { chip: 'bg-violet-500/15 text-violet-300', action: 'text-violet-300 hover:text-violet-200' },
    amber: { chip: 'bg-amber-500/15 text-amber-400', action: 'text-amber-400 hover:text-amber-300' },
    sky: { chip: 'bg-sky-500/15 text-sky-400', action: 'text-sky-400 hover:text-sky-300' },
}

export interface DashboardCardProps {
    title: string
    icon: ReactNode
    accent?: DashboardAccent
    onIconClick?: () => void
    iconTitle?: string
    action?: { label: string; onClick: () => void }
    headerRight?: ReactNode
    children: ReactNode
    className?: string
    bodyClassName?: string
}

export default function DashboardCard({
    title,
    icon,
    accent = 'emerald',
    onIconClick,
    iconTitle,
    action,
    headerRight,
    children,
    className,
    bodyClassName,
}: DashboardCardProps) {
    const tone = ACCENTS[accent] || ACCENTS.emerald
    const chipClasses = cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all',
        tone.chip,
        onIconClick && 'cursor-pointer hover:brightness-125 active:scale-90'
    )

    return (
        <section
            className={cn(
                'flex min-w-0 flex-1 flex-col rounded-2xl border border-white/[0.06] bg-card/50 p-4 md:p-5',
                className
            )}
        >
            <div className="mb-4 flex items-center justify-between gap-3">
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
                    <h3 className="truncate text-sm font-black tracking-tight">{title}</h3>
                </div>
                {headerRight ? (
                    <div className="flex shrink-0 items-center gap-2">{headerRight}</div>
                ) : action ? (
                    <button
                        type="button"
                        onClick={action.onClick}
                        className={cn(
                            'inline-flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-colors',
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
