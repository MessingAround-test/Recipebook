import React from 'react'
import { Label } from '../components/ui/label'
import { Input } from '../components/ui/input'

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
    id?: string
}

export function FormField({ label, id, className, ...props }: FormFieldProps) {
    const inputId = id || props.name

    return (
        <div className="flex flex-col gap-2 mb-3">
            <Label htmlFor={inputId} className="text-muted-foreground">{label}</Label>
            <Input id={inputId} className={className} {...props} />
        </div>
    )
}
