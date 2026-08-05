import { NUTRIENT_LABELS } from './dailyIntake';
import { calculateHealthScore, DEFAULT_HEALTH_SCORE_CONFIG, HealthScoreConfig } from './healthScore';

/**
 * Pure correlation engine for linking logged exposures (foods, recipes,
 * nutrient highs/lows, daily score, mood, exercise) with logged symptoms.
 *
 * No AI — purely statistics over the user's own historical records:
 *   baseRate     = P(symptom) over all observed days
 *   pct          = P(symptom | exposure) over observed days with the exposure
 *   lift         = pct / baseRate
 *   diff         = pct - baseRate
 *
 * Results are filtered by minimum co-occurrence support and minimum exposure
 * sample size so only the strongest patterns are surfaced.
 */

export interface CorrelationOptions {
    minSupport?: number;          // min co-occurrence days before a pair counts
    minExposureObserved?: number; // min observed days the exposure appears
    minSymptomOccurrences?: number; // min observed days the symptom appears overall
    lowNutrientPct?: number;      // totals below this % of target => "Low X" exposure
    highNutrientPct?: number;     // totals above this % of target => "High X" exposure
    scoreHigh?: number;           // daily score >= this => "High Daily Score"
    scoreLow?: number;            // daily score <= this => "Low Daily Score"
    moodHigh?: number;            // mood >= this => "High Mood"
    moodLow?: number;             // mood <= this => "Low Mood"
    lags?: number[];              // day offsets, 0 = same day, 1 = next day
    topK?: number;                // max correlations per direction per symptom
    minDiff?: number;             // ignore pairs with a smaller absolute % swing
    scoreConfig?: HealthScoreConfig; // configurable daily score weights
}

const DEFAULTS: Required<CorrelationOptions> = {
    minSupport: 3,
    minExposureObserved: 5,
    minSymptomOccurrences: 2,
    lowNutrientPct: 50,
    highNutrientPct: 150,
    scoreHigh: 80,
    scoreLow: 50,
    moodHigh: 8,
    moodLow: 3,
    lags: [0, 1],
    topK: 10,
    minDiff: 0.5,
    scoreConfig: DEFAULT_HEALTH_SCORE_CONFIG,
};

export interface ExposureMeta {
    key: string;
    label: string;
    type: 'food' | 'recipe' | 'nutrient' | 'score' | 'mood' | 'exercise';
}

export interface CorrelationEntry {
    exposureKey: string;
    label: string;
    type: ExposureMeta['type'];
    lag: number;          // 0 = same day, 1 = next day
    pct: number;          // P(symptom | exposure) %
    baseRate: number;     // P(symptom) %
    lift: number;         // multiplier vs baseline
    diff: number;         // pct - baseRate (percentage points)
    support: number;      // co-occurrence days
    exposedObserved: number; // observed days with exposure at this lag
}

export interface SymptomCorrelations {
    name: string;
    category: string;                 // positive / negative / neutral / none
    occurrences: number;              // observed days the symptom appeared
    baseRate: number;                 // %
    top: CorrelationEntry | null;     // single strongest correlation
    moreLikely: CorrelationEntry[];   // symptom more likely (lift > 1)
    lessLikely: CorrelationEntry[];   // symptom less likely (lift < 1)
}

export interface CorrelationsResult {
    meta: {
        daysAnalyzed: number;
        observedDays: number;
        exposureCount: number;
        symptomCount: number;
        minSupport: number;
        minExposureObserved: number;
    };
    symptoms: SymptomCorrelations[];
}

interface DayRecord {
    date: string;
    exposures: Set<string>;
    symptoms: Set<string>;
    observed: boolean;
}

export interface DailyLogInput {
    date: string;
    items?: Array<{
        name?: string;
        recipe_name?: string;
        nutrients?: Record<string, number>;
    }>;
    exercise_kcal?: number;
}

export interface SymptomLogInput {
    date: string;
    mood?: number | null;
    symptoms?: Array<{ name?: string }>;
}

type Targets = Record<string, number>;

function calculateDailyScore(totals: Record<string, number>, targets: Targets, scoreConfig?: HealthScoreConfig): number {
    return calculateHealthScore(totals, targets, scoreConfig);
}

function sumTotals(log: DailyLogInput): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const item of log.items || []) {
        const nutrients = item.nutrients || {};
        for (const k of Object.keys(nutrients)) {
            const v = nutrients[k];
            if (typeof v === 'number') totals[k] = (totals[k] || 0) + v;
        }
    }
    return totals;
}

function buildExposures(
    log: DailyLogInput,
    totals: Record<string, number>,
    targets: Targets,
    opt: Required<CorrelationOptions>,
    exposureMeta: Map<string, ExposureMeta>
): Set<string> {
    const exposures = new Set<string>();
    const seen = new Set<string>();

    for (const item of log.items || []) {
        const food = String(item.name || '').toLowerCase().trim();
        if (food) {
            const key = `food|${food}`;
            if (!seen.has(key)) {
                seen.add(key);
                exposures.add(key);
                exposureMeta.set(key, { key, label: food, type: 'food' });
            }
        }
        const recipe = String(item.recipe_name || '').toLowerCase().trim();
        if (recipe) {
            const key = `recipe|${recipe}`;
            if (!seen.has(key)) {
                seen.add(key);
                exposures.add(key);
                exposureMeta.set(key, { key, label: recipe, type: 'recipe' });
            }
        }
    }

    for (const k of Object.keys(targets)) {
        const target = targets[k];
        if (!target) continue;
        const pct = ((totals[k] || 0) / target) * 100;
        if (pct < opt.lowNutrientPct) {
            const key = `nutrient:low|${k}`;
            exposures.add(key);
            exposureMeta.set(key, {
                key,
                label: `Low ${NUTRIENT_LABELS[k]?.label || k}`,
                type: 'nutrient',
            });
        } else if (pct > opt.highNutrientPct) {
            const key = `nutrient:high|${k}`;
            exposures.add(key);
            exposureMeta.set(key, {
                key,
                label: `High ${NUTRIENT_LABELS[k]?.label || k}`,
                type: 'nutrient',
            });
        }
    }

    const score = calculateDailyScore(totals, targets, opt.scoreConfig);
    if (score >= opt.scoreHigh) {
        const key = 'score:high';
        exposures.add(key);
        exposureMeta.set(key, { key, label: `High Daily Score (${opt.scoreHigh}+)`, type: 'score' });
    }
    if (score <= opt.scoreLow) {
        const key = 'score:low';
        exposures.add(key);
        exposureMeta.set(key, { key, label: `Low Daily Score (${opt.scoreLow} or less)`, type: 'score' });
    }

    if ((log.exercise_kcal || 0) > 0) {
        const key = 'exercised';
        exposures.add(key);
        exposureMeta.set(key, { key, label: 'Exercised', type: 'exercise' });
    }

    return exposures;
}

function buildMoodExposure(log: SymptomLogInput, opt: Required<CorrelationOptions>): Set<string> {
    const exposures = new Set<string>();
    const mood = typeof log.mood === 'number' ? log.mood : null;
    if (mood !== null) {
        if (mood >= opt.moodHigh) exposures.add('mood:high');
        if (mood <= opt.moodLow) exposures.add('mood:low');
    }
    return exposures;
}

/**
 * Main entry point. Pass in the user's daily logs and symptom logs (already
 * scoped to the desired date range) plus their daily targets. Returns ranked
 * correlations per symptom.
 */
export function computeCorrelations(
    dailyLogs: DailyLogInput[],
    symptomLogs: SymptomLogInput[],
    targets: Targets,
    classifications: Array<{ name: string; category: string }> = [],
    options: CorrelationOptions = {}
): CorrelationsResult {
    const opt: Required<CorrelationOptions> = { ...DEFAULTS, ...options };

    const categoryMap = new Map<string, string>();
    for (const c of classifications) {
        const name = String(c.name || '').toLowerCase().trim();
        if (name) categoryMap.set(name, c.category);
    }

    const exposureMeta = new Map<string, ExposureMeta>();
    const dailyByDate = new Map<string, DailyLogInput>();
    for (const log of dailyLogs) dailyByDate.set(log.date, log);
    const symByDate = new Map<string, SymptomLogInput>();
    for (const log of symptomLogs) symByDate.set(log.date, log);

    const allDates = Array.from(
        new Set(Array.from(dailyByDate.keys()).concat(Array.from(symByDate.keys())))
    ).sort();

    const dayRecords: DayRecord[] = [];
    for (const date of allDates) {
        const dLog = dailyByDate.get(date);
        const sLog = symByDate.get(date);
        const totals = dLog ? sumTotals(dLog) : {};
        let exposures = new Set<string>();
        if (dLog) exposures = buildExposures(dLog, totals, targets, opt, exposureMeta);
        if (sLog) {
            const moodExposures = buildMoodExposure(sLog, opt);
            for (const m of Array.from(moodExposures)) {
                const meta: ExposureMeta = m === 'mood:high'
                    ? { key: m, label: `High Mood (${opt.moodHigh}+)`, type: 'mood' }
                    : { key: m, label: `Low Mood (${opt.moodLow} or less)`, type: 'mood' };
                exposureMeta.set(m, meta);
                exposures.add(m);
            }
        }
        const symptoms = new Set<string>();
        for (const s of sLog?.symptoms || []) {
            const name = String(s.name || '').toLowerCase().trim();
            if (name) symptoms.add(name);
        }
        const observed = (sLog?.symptoms || []).length > 0;
        dayRecords.push({ date, exposures, symptoms, observed });
    }

    const daysAnalyzed = dayRecords.length;
    let observedDays = 0;
    const symptomOccurrences = new Map<string, number>();
    for (const dr of dayRecords) {
        if (!dr.observed) continue;
        observedDays++;
        for (const s of Array.from(dr.symptoms)) symptomOccurrences.set(s, (symptomOccurrences.get(s) || 0) + 1);
    }

    const baseRateOf = (sym: string): number => (observedDays > 0 ? (symptomOccurrences.get(sym) || 0) / observedDays : 0);

    // exposedObserved[`${exp}\u0000${lag}`] = observed days at i+lag where exp present at i
    // pairCount[`${exp}\u0000${lag}\u0000${sym}`] = co-occurrence days
    const exposedObserved = new Map<string, number>();
    const pairCount = new Map<string, number>();

    const lags = opt.lags;
    for (let i = 0; i < dayRecords.length; i++) {
        const exposureDay = dayRecords[i];
        if (exposureDay.exposures.size === 0) continue;
        for (const lag of lags) {
            const obsDay = dayRecords[i + lag];
            if (!obsDay || !obsDay.observed) continue;
            for (const exp of Array.from(exposureDay.exposures)) {
                const key = `${exp}\u0000${lag}`;
                exposedObserved.set(key, (exposedObserved.get(key) || 0) + 1);
                for (const sym of Array.from(obsDay.symptoms)) {
                    const pk = `${exp}\u0000${lag}\u0000${sym}`;
                    pairCount.set(pk, (pairCount.get(pk) || 0) + 1);
                }
            }
        }
    }

    // Group pair counts by symptom
    const pairsBySymptom = new Map<string, Array<{ exp: string; lag: number; c: number }>>();
    for (const pair of Array.from(pairCount.entries())) {
        const pk = pair[0];
        const c = pair[1];
        const parts = pk.split('\u0000');
        const exp = parts[0];
        const lag = Number(parts[1]);
        const sym = parts[2];
        if (c < opt.minSupport) continue;
        if ((symptomOccurrences.get(sym) || 0) < opt.minSymptomOccurrences) continue;
        const n = exposedObserved.get(`${exp}\u0000${lag}`) || 0;
        if (n < opt.minExposureObserved) continue;
        if (!pairsBySymptom.has(sym)) pairsBySymptom.set(sym, []);
        pairsBySymptom.get(sym)!.push({ exp, lag, c });
    }

    const symptoms: SymptomCorrelations[] = [];
    for (const entry of Array.from(pairsBySymptom.entries())) {
        const sym = entry[0];
        const pairs = entry[1];
        const baseRate = baseRateOf(sym) * 100;
        const entries: CorrelationEntry[] = [];
        for (const { exp, lag, c } of pairs) {
            const n = exposedObserved.get(`${exp}\u0000${lag}`) || 0;
            const pct = (c / n) * 100;
            const lift = baseRate > 0 ? pct / baseRate : 0;
            const diff = pct - baseRate;
            if (Math.abs(diff) < opt.minDiff) continue;
            const meta = exposureMeta.get(exp);
            entries.push({
                exposureKey: exp,
                label: meta?.label || exp,
                type: (meta?.type || 'food') as CorrelationEntry['type'],
                lag,
                pct: Math.round(pct),
                baseRate: Math.round(baseRate * 10) / 10,
                lift: Math.round(lift * 100) / 100,
                diff: Math.round(diff * 10) / 10,
                support: c,
                exposedObserved: n,
            });
        }
        if (entries.length === 0) continue;

        const moreLikely = entries
            .filter(e => e.lift > 1)
            .sort((a, b) => b.lift - a.lift || b.support - a.support)
            .slice(0, opt.topK);
        const lessLikely = entries
            .filter(e => e.lift < 1)
            .sort((a, b) => a.lift - b.lift || b.support - a.support)
            .slice(0, opt.topK);

        const top = entries.reduce(
            (best, e) => (Math.abs(e.diff) > Math.abs(best.diff) ? e : best),
            moreLikely[0] || lessLikely[0]
        ) || null;

        symptoms.push({
            name: sym,
            category: categoryMap.get(sym) || 'none',
            occurrences: symptomOccurrences.get(sym) || 0,
            baseRate,
            top,
            moreLikely,
            lessLikely,
        });
    }

    symptoms.sort((a, b) => {
        const aTop = a.top ? Math.abs(a.top.diff) : 0;
        const bTop = b.top ? Math.abs(b.top.diff) : 0;
        return bTop - aTop;
    });

    return {
        meta: {
            daysAnalyzed,
            observedDays,
            exposureCount: exposureMeta.size,
            symptomCount: symptoms.length,
            minSupport: opt.minSupport,
            minExposureObserved: opt.minExposureObserved,
        },
        symptoms,
    };
}
