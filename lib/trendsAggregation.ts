export interface TrendDay {
    date: string;
    score: number;
    logged?: boolean;
    mood?: number | null;
    positive?: number;
    negative?: number;
    neutral?: number;
    none?: number;
}

export interface TrendWeek {
    date: string;
    score: number | null;
    logged: boolean;
    mood: number | null;
    positive: number;
    negative: number;
    neutral: number;
    none: number;
}

interface WeekBucket {
    scores: number[];
    moods: number[];
    logged: boolean;
    positive: number;
    negative: number;
    neutral: number;
    none: number;
}

function toLocalDateString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getWeekStart(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return toLocalDateString(date);
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getWeekOfMonthLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const firstOfMonth = new Date(y, m - 1, 1);
    const offset = (firstOfMonth.getDay() + 6) % 7;
    const firstMonday = 1 + ((7 - offset) % 7);
    const week = Math.round((d - firstMonday) / 7) + 1;
    return `${MONTHS_SHORT[m - 1]} wk ${week}`;
}

const avg = (nums: number[]) => nums.reduce((a, v) => a + v, 0) / nums.length;

export function aggregateToWeeks(days: TrendDay[]): TrendWeek[] {
    const buckets = new Map<string, WeekBucket>();

    for (const day of days) {
        const key = getWeekStart(day.date);
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = { scores: [], moods: [], logged: false, positive: 0, negative: 0, neutral: 0, none: 0 };
            buckets.set(key, bucket);
        }
        if (day.logged) {
            bucket.logged = true;
            bucket.scores.push(day.score || 0);
        }
        if (day.mood != null) bucket.moods.push(day.mood);
        bucket.positive += day.positive || 0;
        bucket.negative += day.negative || 0;
        bucket.neutral += day.neutral || 0;
        bucket.none += day.none || 0;
    }

    return Array.from(buckets.entries()).map(([date, b]) => ({
        date,
        score: b.scores.length ? avg(b.scores) : null,
        logged: b.logged,
        mood: b.moods.length ? avg(b.moods) : null,
        positive: b.positive,
        negative: b.negative,
        neutral: b.neutral,
        none: b.none,
    }));
}
