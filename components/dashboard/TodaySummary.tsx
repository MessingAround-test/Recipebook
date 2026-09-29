import { ReactNode } from 'react'
import { FiPlus, FiActivity, FiZap } from 'react-icons/fi'
import { cn } from '../../lib/utils'
import { NUTRIENT_LABELS } from '../../lib/dailyIntake'

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
                <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
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
                    className={cn('transition-all duration-700', hasData ? scoreColor : 'text-white/15')}
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
        <div className="flex min-w-0 flex-1 flex-col rounded-xl bg-white/[0.04] px-2 py-2.5 text-center">
            <div className="text-sm font-black leading-none">
                {consumed}
                <span className="ml-0.5 text-[10px] font-bold text-muted-foreground/70">{info?.unit || ''}</span>
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{info?.label || nutKey}</div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-400/80 transition-all duration-700" style={{ width: `${pct}%` }} />
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
        <section className="flex flex-col rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.14] via-card/40 to-card/40 p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Dashboard</p>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                    <h1 className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-white">{dateLabel}</h1>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {headerExtra}
                    {showMetrics && (
                        <>
                            <button
                                type="button"
                                onClick={onShowNutrition}
                                aria-label="Nutrition breakdown"
                                title="Nutrition breakdown"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-muted-foreground transition-all hover:text-white active:scale-90"
                            >
                                <FiActivity size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={onRoundOut}
                                aria-label="Round out today's intake"
                                title="Round out today's intake with quick foods"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-all hover:border-emerald-500/40 active:scale-90"
                            >
                                <FiZap size={15} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {showMetrics && (loading && !targets ? (
                <div className="mt-4 space-y-3">
                    <div className="h-20 w-full animate-pulse rounded-xl bg-white/[0.04]" />
                    <div className="flex gap-2">
                        {MACROS.map(m => <div key={m} className="h-14 flex-1 animate-pulse rounded-xl bg-white/[0.04]" />)}
                    </div>
                </div>
            ) : (
                <>
                    <div className="mt-4 flex items-center gap-4 md:gap-6">
                        <ScoreRing score={score} hasData={hasData} scoreColor={scoreColor} />
                        <div className="min-w-0 flex-1">
                            <div className="text-3xl font-black leading-none md:text-4xl">
                                {calories.toLocaleString()}
                                <span className="text-sm font-bold text-muted-foreground"> / {calorieTarget.toLocaleString()} kcal</span>
                            </div>
                            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/30">
                                <div
                                    className={cn('h-full rounded-full transition-all duration-700', caloriePct >= 100 ? 'bg-amber-400' : 'bg-emerald-400')}
                                    style={{ width: `${caloriePct}%` }}
                                />
                            </div>
                            <div className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
                                {Math.round(caloriePct)}% of daily energy
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                        {MACROS.map(m => (
                            <MacroChip key={m} nutKey={m} totals={totals} targets={targets} />
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={onLog}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-black text-black shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 active:scale-[0.99]"
                    >
                        <FiPlus size={18} /> Log food
                    </button>
                </>
            ))}
        </section>
    )
}
