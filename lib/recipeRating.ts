export function sanitizeRating(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    if (!Number.isFinite(num)) return null
    const rounded = Math.round(num)
    if (rounded < 1) return null
    if (rounded > 5) return 5
    return rounded
}
