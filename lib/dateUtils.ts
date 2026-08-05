/**
 * Shared date helpers for the weekly planner.
 * Dates are represented as local 'YYYY-MM-DD' strings.
 */

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseDateStr(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function formatDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr: string, n: number): string {
    const d = parseDateStr(dateStr);
    d.setDate(d.getDate() + n);
    return formatDateStr(d);
}

export function getDateRange(startDate: string, numDays: number): string[] {
    return Array.from({ length: Math.max(1, numDays) }, (_, i) => addDays(startDate, i));
}

export function daysBetween(startDate: string, endDate: string): number {
    const a = parseDateStr(startDate).getTime();
    const b = parseDateStr(endDate).getTime();
    return Math.round((b - a) / 86400000) + 1;
}

export function formatShortDate(dateStr: string): string {
    const d = parseDateStr(dateStr);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatRangeLabel(startDate: string, numDays: number): string {
    const endDate = addDays(startDate, numDays - 1);
    return `${formatShortDate(startDate)} \u2013 ${formatShortDate(endDate)}`;
}

export function getMondayOf(dateStr: string): string {
    const d = parseDateStr(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return formatDateStr(d);
}

export function todayStr(): string {
    return formatDateStr(new Date());
}

/**
 * Maps a legacy day-name value (e.g. 'Monday') to the YYYY-MM-DD date
 * at the matching offset within a plan range that starts on `startDate`.
 * Legacy plans always started on a Monday.
 */
export function legacyDayNameToDate(day: string, startDate: string): string {
    const idx = DAY_NAMES.indexOf(day);
    if (idx === -1) return day;
    const start = parseDateStr(startDate);
    const mondayOffset = (idx === 0 ? 6 : idx - 1); // Sunday is the last day of a Monday-start week
    return formatDateStr(new Date(start.getFullYear(), start.getMonth(), start.getDate() + mondayOffset));
}
