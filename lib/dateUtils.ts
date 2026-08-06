/**
 * Shared date helpers for the weekly planner.
 * Dates are represented as local 'YYYY-MM-DD' strings.
 */

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

function isValidDate(y: number, m: number, d: number): boolean {
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Parses user-typed date text into a 'YYYY-MM-DD' string.
 * Accepts ISO (2026-08-06), year-first separators (2026/08/06, 2026.08.06),
 * day-first (06/08/2026, 06-08-2026, 06.08.2026), and natural language dates.
 * Returns null when the value can't be parsed into a valid date.
 */
export function parseFlexibleDate(value: string): string | null {
    const s = value.trim();
    if (!s) return null;

    let m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
    if (m) {
        const [, y, mo, d] = m.map(Number);
        if (isValidDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
        return null;
    }

    m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (m) {
        const [, d, mo, y] = m.map(Number);
        if (isValidDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
        return null;
    }

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
        return formatDateStr(parsed);
    }

    return null;
}

