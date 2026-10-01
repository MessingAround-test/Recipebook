import { ReactNode } from 'react'
import { cn } from '../lib/utils'

export type PageAccent = 'olive' | 'terracotta' | 'plum' | 'butter' | 'water' | 'berry'

const ACCENTS: Record<PageAccent, string> = {
    olive: 'bg-olive/15 text-olive',
    terracotta: 'bg-terracotta/15 text-terracotta',
    plum: 'bg-plum/15 text-plum',
    butter: 'bg-butter/15 text-butter',
    water: 'bg-water/15 text-water',
    berry: 'bg-berry/15 text-berry',
}

interface PageHeaderProps {
    title: string
    actions?: ReactNode
    children?: ReactNode
    /** Optional cursive subtitle under the page title. */
    subtitle?: ReactNode
    /** Optional icon shown in a tinted chip beside the title. */
    icon?: ReactNode
    /** Ink for the icon chip; defaults to terracotta. */
    accent?: PageAccent
    className?: string
}

export function PageHeader({ title, actions, children, subtitle, icon, accent = 'terracotta', className }: PageHeaderProps) {
    return (
        <div className={cn(
            /* soft card surface, dashboard-card sizing */
            'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6 rounded-2xl bg-card p-3 shadow-sm md:p-5',
            className
        )}>
            <div className="flex min-w-0 items-center gap-3">
                {icon && (
                    <span className={cn('flex h-8 w-8 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-xl', ACCENTS[accent])}>
                        {icon}
                    </span>
                )}
                <div className="min-w-0">
                    <h1 className="font-cursive truncate text-xl leading-tight text-foreground md:text-3xl">{title}</h1>
                    {subtitle && (
                        <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{subtitle}</p>
                    )}
                </div>
            </div>
            {(actions || children) && (
                <div className="flex flex-row flex-wrap gap-2 shrink-0">
                    {actions}
                    {children}
                </div>
            )}
        </div>
    )
}
