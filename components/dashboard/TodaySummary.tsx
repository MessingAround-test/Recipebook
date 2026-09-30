import { ReactNode } from 'react'
import { FiPlus, FiActivity, FiZap } from 'react-icons/fi'
import { cn } from '../../lib/utils'
import { NUTRIENT_LABELS } from '../../lib/dailyIntake'

/* One soft kitchen ink per macro — colour carries the meaning. */
const MACRO_INKS: Record<string, string> = {
    protein_g: 'bg-terracotta',
    carbohydrates_g: 'bg-butter',
    fat_g: 'bg-berry',
    fiber_g: 'bg-olive',
}

const MACROS = ['protein_g', 'carbohydrates_g', 'fat_g', 'fiber_g'] as const

export interface TodaySummaryProps {
    dateLabel: string
    loading: boolean
    hasData: boolean
    score: number
    scoreColor: string
    calories: number
    calorieTarget: number
    caloriePct: number
    totals: any
    targets: any
    onLog: () => void
    onRoundOut: () => void
    onShowNutrition: () => void
    headerExtra?: ReactNode
    /** When false the health metrics/actions are hidden (e.g. tracker disabled). */
    showMetrics?: boolean
}

function ScoreRing({ score, hasData, scoreColor }: { score: number; hasData: boolean; scoreColor: string }) {
    const R = 34
    const C = 2 * Math.PI * R
    const pct = hasData ? Math.max(0, Math.min(score, 100)) : 0

    return (
        <div className="relative h-20 w-20 shrink-0 md:h-24 md:w-24">
            <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
                <circle cx="40" cy="40" r={R} fill="none" stroke="var(--border)" strokeWidth="7" />
                <circle
                    cx="40"
                    cy="40"
                    r={R}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - pct / 100)}
                    className={cn('transition-all duration-700', hasData ? scoreColor : 'text-muted-foreground/40')}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-lg font-black leading-none md:text-xl', hasData ? scoreColor : 'text-muted-foreground')}>
                    {hasData ? score : '--'}
                    {hasData && <span className="text-[10px] font-black">%</span>}
                </span>
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Score</span>
            </div>
        </div>
    )
}

function MacroChip({ nutKey, totals, targets }: { nutKey: string; totals: any; targets: any }) {
    const info = NUTRIENT_LABELS[nutKey as keyof typeof NUTRIENT_LABELS]
    const consumed = Math.round(totals?.[nutKey] || 0)
    const target = targets?.[nutKey] || 0
    const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0

    return (
        <div className="flex min-w-0 flex-1 flex-col rounded-xl bg-terracotta/[0.07] px-2 py-2.5 text-center">
            <div className="text-sm font-black leading-none">
                {consumed}
                <span className="ml-0.5 text-[10px] font-bold text-muted-foreground">{info?.unit || ''}</span>
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{info?.label || nutKey}</div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                <div
                    className={cn('h-full rounded-full transition-all duration-700', MACRO_INKS[nutKey] || 'bg-olive')}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

export default function TodaySummary({
    dateLabel,
    loading,
    hasData,
    score,
    scoreColor,
    calories,
    calorieTarget,
    caloriePct,
    totals,
    targets,
    onLog,
    onRoundOut,
    onShowNutrition,
    headerExtra,
    showMetrics = true,
}: TodaySummaryProps) {
    return (
        <section className="flex flex-col rounded-2xl bg-gradient-to-br from-terracotta/25 via-card to-card p-4 shadow-sm md:p-6">
            <div className="flex items-center justify-between gap-3">
                <h1 className="font-cursive truncate text-2xl leading-tight text-foreground md:text-3xl" title={dateLabel}>
                    {dateLabel}
                </h1>
                <div className="flex shrink-0 items-center gap-2">
                    {showMetrics && (
                        <>
                            {/* Compact score pill (mobile) — taps through to the breakdown. */}
                            <button
                                type="button"
                                onClick={onShowNutrition}
                                aria-label="Nutrition breakdown"
                                title="Nutrition breakdown"
                                className="flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-black tabular-nums transition-all hover:bg-foreground/10 active:scale-95 md:hidden"
                            >
                                <span className={cn('h-1.5 w-1.5 rounded-full bg-current', hasData ? scoreColor : 'text-muted-foreground/50')} />
                                <span className={hasData ? scoreColor : 'text-muted-foreground'}>{hasData ? score : '--'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={onShowNutrition}
                                aria-label="Nutrition breakdown"
                                title="Nutrition breakdown"
                                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.06] text-muted-foreground transition-all hover:text-foreground active:scale-90 md:flex"
                            >
                                <FiActivity size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={onRoundOut}
                                aria-label="Round out today's intake"
                                title="Round out today's intake with quick foods"
                                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-terracotta/15 text-terracotta transition-all hover:bg-terracotta/25 active:scale-90 md:flex"
                            >
                                <FiZap size={15} />
                            </button>
                        </>
                    )}
                    {headerExtra}
                </div>
            </div>

            {showMetrics && (loading && !targets ? (
                <div className="mt-4 space-y-3">
                    <div className="h-12 w-full animate-pulse rounded-xl bg-foreground/[0.05] md:h-20" />
                    <div className="hidden gap-2 md:flex">
                        {MACROS.map(m => <div key={m} className="h-14 flex-1 animate-pulse rounded-xl bg-foreground/[0.05]" />)}
                    </div>
                </div>
            ) : (
                <>
                    <div className="mt-3 flex items-center gap-3 md:mt-4 md:gap-6">
                        <div className="hidden shrink-0 md:block">
                            <ScoreRing score={score} hasData={hasData} scoreColor={scoreColor} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-3xl font-black leading-none md:text-4xl">
                                {calories.toLocaleString()}
                                <span className="text-sm font-bold text-muted-foreground"> / {calorieTarget.toLocaleString()} kcal</span>
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10 md:mt-3 md:h-2">
                                <div
                                    className={cn('h-full rounded-full transition-all duration-700', caloriePct >= 100 ? 'bg-butter' : 'bg-terracotta')}
                                    style={{ width: `${caloriePct}%` }}
                                />
                            </div>
                            <div className="mt-1.5 hidden text-[11px] font-semibold text-muted-foreground md:block">
                                {Math.round(caloriePct)}% of daily energy
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 hidden gap-2 md:mt-4 md:flex">
                        {MACROS.map(m => (
                            <MacroChip key={m} nutKey={m} totals={totals} targets={targets} />
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={onLog}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta py-3 text-sm font-black text-primary-foreground shadow-lg shadow-terracotta/20 transition-all hover:bg-terracotta/85 active:scale-[0.99] md:mt-4 md:py-3.5"
                    >
                        <FiPlus size={18} /> Log food
                    </button>
                </>
            ))}
        </section>
    )
}
