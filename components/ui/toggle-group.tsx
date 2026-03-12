import * as React from "react"
import { cn } from "../../lib/utils"

interface ToggleGroupProps {
    type: "single" | "multiple"
    value: string | string[]
    onValueChange: (value: any) => void
    children: React.ReactNode
    className?: string
}

const ToggleGroupContext = React.createContext<{
    value: string | string[]
    onValueChange: (val: string) => void
}>({
    value: "",
    onValueChange: () => { },
})

export const ToggleGroup = ({ type, value, onValueChange, children, className }: ToggleGroupProps) => {
    const handleValueChange = (val: string) => {
        if (type === "single") {
            onValueChange(val)
        } else {
            const current = Array.isArray(value) ? value : [value]
            if (current.includes(val)) {
                onValueChange(current.filter((v) => v !== val))
            } else {
                onValueChange([...current, val])
            }
        }
    }

    return (
        <ToggleGroupContext.Provider value={{ value, onValueChange: handleValueChange }}>
            <div className={cn("flex items-center gap-1", className)}>{children}</div>
        </ToggleGroupContext.Provider>
    )
}

interface ToggleGroupItemProps {
    value: string
    children: React.ReactNode
    className?: string
}

export const ToggleGroupItem = ({ value, children, className }: ToggleGroupItemProps) => {
    const context = React.useContext(ToggleGroupContext)
    const isSelected = Array.isArray(context.value) ? context.value.includes(value) : context.value === value

    return (
        <button
            type="button"
            onClick={() => context.onValueChange(value)}
            className={cn(
                "px-3 py-1 text-sm rounded-md transition-colors",
                isSelected ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                className
            )}
        >
            {children}
        </button>
    )
}
