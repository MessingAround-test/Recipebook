import { useState } from 'react'
import { FiCheck, FiChevronUp } from 'react-icons/fi'
import { DailyTaskState } from '../lib/dailyTasks'

const METAL_RINGS = ['#fbbf24', '#cbd5e1', '#d97706'] // gold, silver, bronze

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
            <div className="bg-amber-400/[0.16] border border-amber-400/25 rounded-2xl">
                <button onClick={() => setExpanded(true)} className="w-full flex items-center justify-between gap-3 p-3 text-left">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-amber-400/15 text-amber-300 flex items-center justify-center shrink-0">
                            <FiCheck size={14} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-black text-amber-300">All tasks complete</div>
                            <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{doneCount}/{tasks.length} done</div>
                        </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        {tasks.map(t => <span key={t.id} className="text-sm leading-none opacity-60">{t.emoji}</span>)}
                    </div>
                </button>
            </div>
        )
    }

    return (
        <div className="bg-gradient-to-br from-amber-400/[0.28] via-transparent to-transparent rounded-2xl p-3 md:p-4 flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-400/15 text-amber-300">
                        <FiCheck size={14} />
                    </div>
                    <h3 className="text-sm font-black tracking-tight">Daily Tasks</h3>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300">
                    {doneCount}/{tasks.length}
                </span>
            </div>

            <div className="flex justify-between gap-x-1 gap-y-3 flex-1">
                {sorted.map((t, idx) => {
                    const pct = t.target > 1 ? Math.min(Math.round((t.count / t.target) * 100), 100) : 0
                    const metal = !t.done && t.target <= 1 && idx < METAL_RINGS.length ? METAL_RINGS[idx] : null
                    return (
                        <div key={t.id} className="flex flex-col items-center gap-1 flex-1 min-w-0 md:flex-none md:w-16">
                            <button
                                onClick={() => toggle(t.id)}
                                disabled={!t.allowManual}
                                title={t.title}
                                className={`relative w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${t.allowManual ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}`}
                                style={t.target > 1 && !t.done
                                    ? { background: `conic-gradient(rgba(251,191,36,0.5) ${pct}%, rgba(255,255,255,0.06) 0)` }
                                    : { background: t.done ? 'rgba(180,83,9,0.22)' : 'rgba(255,255,255,0.04)' }}
                            >
                                <span
                                    className={`absolute inset-0 rounded-full border pointer-events-none ${t.done ? 'border-amber-700' : 'border'}`}
                                    style={!t.done ? { borderColor: metal || 'rgba(255,255,255,0.12)' } : undefined}
                                />
                                <span className={`text-lg md:text-2xl relative z-10 transition-opacity ${t.done ? 'opacity-30' : ''}`}>{t.emoji}</span>
                                {t.done && (
                                    <span className="absolute inset-0 flex items-center justify-center z-20">
                                        <FiCheck size={22} strokeWidth={4} className="text-amber-700" />
                                    </span>
                                )}
                            </button>
                            <span className={`text-[7px] md:text-[9px] font-bold text-center leading-tight w-full px-0.5 truncate ${t.done ? 'text-muted-foreground' : ''}`}>{t.label}</span>
                            {t.target > 1 && (
                                <span className={`text-[8px] font-black -mt-0.5 ${t.done ? 'text-amber-700' : 'text-amber-300/70'}`}>{t.count}/{t.target}</span>
                            )}
                            {t.action && onGo && (
                                <button
                                    onClick={() => onGo(t.action!)}
                                    className="mt-0.5 px-2 py-1 min-h-[28px] rounded-full bg-white/[0.06] border border-white/10 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-amber-300 hover:bg-amber-400/15 hover:border-amber-400/30 transition-all"
                                >
                                    {t.cta || 'Go'}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {compact && (
                <button onClick={() => setExpanded(false)} className="mt-2 self-center inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-white">
                    <FiChevronUp size={12} /> Collapse
                </button>
            )}

            <p className="text-[8px] text-muted-foreground mt-3">Tap a medal to mark done · water: 4× · auto-tracks from your logs</p>
        </div>
    )
}
