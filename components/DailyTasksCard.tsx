import { useState } from 'react'
import { FiCheck, FiChevronUp } from 'react-icons/fi'
import { Pill, Droplets, Apple, Salad, Dumbbell, Stethoscope } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DailyTaskState } from '../lib/dailyTasks'

const TASK_ICONS: Record<string, LucideIcon> = {
    vitamins: Pill,
    water: Droplets,
    fruit: Apple,
    veggies: Salad,
    exercise: Dumbbell,
    symptoms: Stethoscope,
}

/* Warm kitchen ink per task — RGB-triplet tokens (globals.css), so the
   stamps tint softly in both themes. Matches the thing being marked. */
const TASK_INK: Record<string, string> = {
    vitamins: 'var(--butter)',
    water: 'var(--water)',
    fruit: 'var(--berry)',
    veggies: 'var(--olive)',
    exercise: 'var(--terracotta)',
    symptoms: 'var(--plum)',
}
const DEFAULT_INK = 'var(--butter)'

const inkColor = (ink: string, alpha = 1) => `rgb(${ink} / ${alpha})`

/* Small fixed tilts so the row reads hand-stamped, not grid-perfect. */
const TILTS = ['-2.5deg', '1.5deg', '-1deg', '2.5deg', '-2deg', '1deg']

/* SVG goo filter — blur + alpha contrast melts blob, liquid fill and
   droplets into one wet ink body. Rendered once, referenced by CSS. */
const GooDefs = () => (
    <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
            <filter id="stamp-goo" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" />
            </filter>
        </defs>
    </svg>
)

export default function DailyTasksCard({ tasks, allDone, toggle, compact = false, onGo }: {
    tasks: DailyTaskState[]
    allDone: boolean
    toggle: (id: string) => void
    compact?: boolean
    onGo?: (action: string) => void
}) {
    const [expanded, setExpanded] = useState(!compact)
    const doneCount = tasks.filter(t => t.done).length
    const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done))

    if (compact && !expanded) {
        return (
            <div className="flex flex-col rounded-2xl bg-card shadow-sm">
                <button onClick={() => setExpanded(true)} className="w-full flex items-center justify-between gap-3 p-3 md:p-3.5 text-left">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="hidden h-8 w-8 rounded-xl bg-olive/15 text-olive md:flex items-center justify-center shrink-0">
                            <FiCheck size={15} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-black text-olive">All tasks stamped</div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{doneCount}/{tasks.length} done</div>
                        </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                        {tasks.map(t => {
                            const Icon = TASK_ICONS[t.id] || Pill
                            const ink = TASK_INK[t.id] || DEFAULT_INK
                            return <Icon key={t.id} className="h-4 w-4" style={{ color: t.done ? inkColor(ink) : inkColor(ink, 0.4) }} />
                        })}
                    </div>
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-1 min-w-0 rounded-2xl bg-card p-3 shadow-sm md:p-5">
            <GooDefs />

            <div className="mb-3 flex items-center justify-between md:mb-4">
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className="hidden h-8 w-8 rounded-xl items-center justify-center shrink-0 bg-butter/15 text-butter md:flex">
                        <FiCheck size={15} />
                    </div>
                    <h3 className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground md:text-sm md:font-black md:tracking-tight md:text-foreground">
                        Daily Tasks
                    </h3>
                    <span className="text-[11px] font-black tabular-nums text-muted-foreground md:hidden">
                        {doneCount}/{tasks.length}
                    </span>
                </div>
                <span className="hidden text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-butter/15 text-butter md:inline-flex">
                    {doneCount}/{tasks.length}
                </span>
            </div>

            <div className="flex justify-between gap-x-1 gap-y-2 flex-1 md:gap-y-3">
                {sorted.map((t, idx) => {
                    const Icon = TASK_ICONS[t.id] || Pill
                    const ink = TASK_INK[t.id] || DEFAULT_INK
                    const pct = t.target > 1 ? Math.min(Math.round((t.count / t.target) * 100), 100) : 0
                    /* Liquid height inside the stamp — 0 stays empty, done is
                       covered by the full blob anyway. */
                    const fill = t.target > 1 && pct > 0 ? `${Math.min(8 + pct * 0.74, 82)}%` : '0%'

                    return (
                        <div key={t.id} className="stamp">
                            <button
                                type="button"
                                onClick={() => toggle(t.id)}
                                disabled={!t.allowManual}
                                title={t.title}
                                aria-pressed={t.done}
                                className={`stampHit${t.done ? ' isDone' : ''}${t.allowManual ? ' isClickable' : ''}`}
                                style={{ '--ink': ink, '--tilt': TILTS[idx % TILTS.length], '--fill': fill } as React.CSSProperties}
                            >
                                <span className="stampSlot" aria-hidden="true" />
                                <span className="stampInk" aria-hidden="true">
                                    <span className="stampBlob" />
                                    {t.target > 1 && <span className="stampFill" />}
                                    <span className="stampDrop stampDropA" />
                                    <span className="stampDrop stampDropB" />
                                </span>
                                <span className="stampIconWrap" aria-hidden="true">
                                    <Icon className="stampIcon" strokeWidth={t.done ? 2.5 : 2} />
                                </span>
                                <span className="stampSheen" aria-hidden="true" />
                            </button>
                            <span className={`text-[10px] md:text-[11px] font-bold text-center leading-tight w-full px-0.5 truncate ${t.done ? 'text-muted-foreground' : ''}`}>
                                {t.label}
                                {t.target > 1 && (
                                    <span className="ml-1 opacity-70">{t.count}/{t.target}</span>
                                )}
                            </span>
                            {t.action && onGo && (
                                <button
                                    onClick={() => onGo(t.action!)}
                                    className="hidden mt-0.5 px-2 py-1 min-h-[28px] rounded-full bg-foreground/[0.06] text-[10px] md:text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all md:inline-flex"
                                >
                                    {t.cta || 'Go'}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {compact && (
                <button onClick={() => setExpanded(false)} className="mt-2 self-center inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                    <FiChevronUp size={12} /> Collapse
                </button>
            )}

            <p className="hidden text-[10px] text-muted-foreground mt-3 md:block">
                Tap a stamp to press it · water: 4× · auto-tracks from your logs
            </p>
        </div>
    )
}
