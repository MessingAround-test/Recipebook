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
    const current = Math.max(0, Math.min(5, Math.round((value || 0) * 2) / 2))

    return (
        <div
            className={`inline-flex items-center gap-0.5 ${className}`}
            role={interactive ? 'radiogroup' : undefined}
            aria-label={interactive ? 'Rate this recipe' : `Rated ${current} of 5`}
        >
            {[1, 2, 3, 4, 5].map(star => {
                const fill = Math.max(0, Math.min(1, current - (star - 1)))
                return (
                    <div key={star} className="relative" style={{ width: size, height: size }}>
                        <Star
                            size={size}
                            className="absolute inset-0 text-muted-foreground/40"
                            fill="none"
                        />
                        {fill > 0 && (
                            <span
                                className="pointer-events-none absolute inset-0 overflow-hidden"
                                style={{ width: `${fill * 100}%` }}
                            >
                                <Star size={size} className="text-amber-400" fill="currentColor" />
                            </span>
                        )}
                        {interactive && (
                            <>
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={current === star - 0.5}
                                    aria-label={`Rate ${star - 0.5} star${star - 0.5 === 1 ? '' : 's'}`}
                                    onClick={() => onChange(star - 0.5)}
                                    className="absolute left-0 top-0 z-10 h-full w-1/2"
                                />
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={current === star}
                                    aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                                    onClick={() => onChange(star)}
                                    className="absolute right-0 top-0 z-10 h-full w-1/2"
                                />
                            </>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
