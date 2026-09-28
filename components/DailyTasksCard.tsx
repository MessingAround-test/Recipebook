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

// Ink colour per task — matches the thing being marked.
const TASK_INK: Record<string, string> = {
    vitamins: '#a78bfa', // violet
    water: '#38bdf8',    // sky
    fruit: '#fb7185',    // rose
    veggies: '#34d399',  // emerald
    exercise: '#fb923c', // orange
    symptoms: '#e879f9', // fuchsia
}
const DEFAULT_INK = '#a78bfa'

const rgba = (hex: string, alpha: number) => {
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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
            <div className="bg-card/50 border border-white/[0.06] rounded-2xl">
                <button onClick={() => setExpanded(true)} className="w-full flex items-center justify-between gap-3 p-3.5 text-left">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                            <FiCheck size={15} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-black text-emerald-300">All tasks complete</div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{doneCount}/{tasks.length} done</div>
                        </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                        {tasks.map(t => {
                            const Icon = TASK_ICONS[t.id] || Pill
                            const ink = TASK_INK[t.id] || DEFAULT_INK
                            return <Icon key={t.id} className="h-4 w-4" style={{ color: t.done ? ink : rgba(ink, 0.45) }} />
                        })}
                    </div>
                </button>
            </div>
        )
    }

    return (
        <div className="bg-card/50 border border-white/[0.06] rounded-2xl p-4 md:p-5 flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400">
                        <FiCheck size={15} />
                    </div>
                    <h3 className="text-sm font-black tracking-tight">Daily Tasks</h3>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300">
                    {doneCount}/{tasks.length}
                </span>
            </div>

            <div className="flex justify-between gap-x-1 gap-y-3 flex-1">
                {sorted.map((t) => {
                    const Icon = TASK_ICONS[t.id] || Pill
                    const ink = TASK_INK[t.id] || DEFAULT_INK
                    const pct = t.target > 1 ? Math.min(Math.round((t.count / t.target) * 100), 100) : 0

                    const stampStyle = t.done
                        ? {
                            borderColor: rgba(ink, 0.9),
                            background: `radial-gradient(circle at 35% 30%, ${rgba(ink, 0.6)}, ${rgba(ink, 0.28)})`,
                            boxShadow: `0 0 14px ${rgba(ink, 0.35)}, inset 0 0 12px ${rgba(ink, 0.45)}`,
                        }
                        : t.target > 1
                            ? {
                                borderColor: rgba(ink, 0.4),
                                background: `conic-gradient(${rgba(ink, 0.55)} ${pct}%, rgba(255,255,255,0.04) 0)`,
                            }
                            : {
                                borderColor: rgba(ink, 0.4),
                                background: 'rgba(255,255,255,0.03)',
                            }

                    return (
                        <div key={t.id} className="flex flex-col items-center gap-1 flex-1 min-w-0 md:flex-none md:w-16">
                            <button
                                onClick={() => toggle(t.id)}
                                disabled={!t.allowManual}
                                title={t.title}
                                className={`relative w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center border-2 transition-all ${t.done ? 'border-solid' : 'border-dashed'} ${t.allowManual ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}`}
                                style={stampStyle}
                            >
                                <Icon
                                    className={`relative z-10 h-5 w-5 md:h-7 md:w-7 transition-all duration-300 ${t.done ? 'opacity-100' : 'opacity-70'}`}
                                    strokeWidth={t.done ? 2.5 : 2}
                                    style={{
                                        color: t.done ? ink : rgba(ink, 0.75),
                                        transform: t.done ? 'rotate(-8deg) scale(1.05)' : 'none',
                                        filter: t.done ? `drop-shadow(0 0 4px ${rgba(ink, 0.7)})` : 'none',
                                    }}
                                />
                            </button>
                            <span className={`text-[10px] md:text-[11px] font-bold text-center leading-tight w-full px-0.5 truncate ${t.done ? 'text-muted-foreground' : ''}`}>{t.label}</span>
                            {t.target > 1 && (
                                <span className="text-[10px] font-black -mt-0.5" style={{ color: t.done ? ink : rgba(ink, 0.75) }}>
                                    {t.count}/{t.target}
                                </span>
                            )}
                            {t.action && onGo && (
                                <button
                                    onClick={() => onGo(t.action!)}
                                    className="mt-0.5 px-2 py-1 min-h-[28px] rounded-full bg-white/[0.06] border border-white/10 text-[10px] md:text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all"
                                >
                                    {t.cta || 'Go'}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {compact && (
                <button onClick={() => setExpanded(false)} className="mt-2 self-center inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-white">
                    <FiChevronUp size={12} /> Collapse
                </button>
            )}

            <p className="text-[10px] text-muted-foreground mt-3">Tap a stamp to mark it done · water: 4× · auto-tracks from your logs</p>
        </div>
    )
}
