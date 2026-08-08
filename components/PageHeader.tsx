import { ReactNode } from 'react'

interface PageHeaderProps {
    title: string
    actions?: ReactNode
    children?: ReactNode
}

export function PageHeader({ title, actions, children }: PageHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-8">
            <h1 className="m-0 text-3xl font-bold tracking-tight break-words min-w-0">{title}</h1>
            {(actions || children) && (
                <div className="flex flex-row flex-wrap gap-2 shrink-0">
                    {actions}
                    {children}
                </div>
            )}
        </div>
    )
}
