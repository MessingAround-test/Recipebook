import React from 'react'
import { Star } from 'lucide-react'

interface StarRatingProps {
    value: number
    onChange?: (value: number) => void
    readOnly?: boolean
    size?: number
    className?: string
}

export default function StarRating({ value, onChange, readOnly = false, size = 18, className = '' }: StarRatingProps) {
    const interactive = !readOnly && typeof onChange === 'function'
    const current = Math.max(0, Math.min(5, Math.round(value || 0)))

    return (
        <div className={`inline-flex items-center gap-0.5 ${className}`} role={interactive ? 'radiogroup' : undefined} aria-label={interactive ? 'Rate this recipe' : `Rated ${current} of 5`}>
            {[1, 2, 3, 4, 5].map(star => {
                const filled = star <= current
                const starEl = (
                    <Star
                        size={size}
                        className={filled ? 'text-amber-400' : 'text-muted-foreground/40'}
                        fill={filled ? 'currentColor' : 'none'}
                    />
                )
                if (!interactive) {
                    return (
                        <span key={star} className="inline-flex">{starEl}</span>
                    )
                }
                return (
                    <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={filled}
                        aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                        onClick={() => onChange(star)}
                        className="p-0.5 rounded transition-transform hover:scale-110 active:scale-95"
                    >
                        {starEl}
                    </button>
                )
            })}
        </div>
    )
}
