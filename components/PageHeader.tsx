import { ReactNode } from 'react'

interface PageHeaderProps {
    title: string
    actions?: ReactNode
    children?: ReactNode
}

export function PageHeader({ title, actions, children }: PageHeaderProps) {
    return (
        <div className="flex flex-row justify-between items-center mb-8">
            <h1 className="m-0 text-3xl font-bold tracking-tight">{title}</h1>
            {(actions || children) && (
                <div className="flex flex-row gap-2">
                    {actions}
                    {children}
                </div>
            )}
        </div>
    )
}
