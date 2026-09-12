import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { useAuthGuard } from '../lib/useAuthGuard'
import { useQuickTimers } from '../lib/useQuickTimers'
import QuickTimerCard from '../components/quickTools/QuickTimerCard'
import QuickTimerCreator from '../components/quickTools/QuickTimerCreator'
import PresetTimers from '../components/quickTools/PresetTimers'
import Stopwatch from '../components/quickTools/Stopwatch'
import UnitConverter from '../components/quickTools/UnitConverter'
import OvenConverter from '../components/quickTools/OvenConverter'
import GuideContent from '../components/quickTools/GuideContent'
import QuickSheet from '../components/quickTools/QuickSheet'
import {
    formatCountdown,
    guideHaystack,
    incrementUsage,
    QUICK_GUIDES,
    QUICK_TOOLS,
    sortByUsage,
    toolHaystack,
    type QuickGuide,
    type QuickTool,
    type ToolKind
} from '../lib/quickTools'
import { BookOpen, Check, Clock, Flame, Search, Scale, Timer, TimerReset, X, Zap, type LucideIcon } from 'lucide-react'

const USAGE_KEY = 'quickTools-usage-v1'

const TOOL_ICONS: Record<ToolKind, LucideIcon> = {
    timer: Timer,
    stopwatch: TimerReset,
    presets: Zap,
    unit: Scale,
    oven: Flame
}

const TOOL_CATEGORY: Record<ToolKind, string> = {
    timer: 'Timer',
    stopwatch: 'Timer',
    presets: 'Timer',
    unit: 'Converter',
    oven: 'Converter'
}

type FilterId = 'all' | 'timers' | 'guides' | 'converters'

const FILTERS: { id: FilterId; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'timers', label: 'Timers' },
    { id: 'guides', label: 'Guides' },
    { id: 'converters', label: 'Converters' }
]

interface GridItem {
    id: string
    title: string
    description: string
    category: string
    icon: LucideIcon
    type: 'tool' | 'guide'
    haystack: string[]
    tool?: QuickTool
    guide?: QuickGuide
}

const STATUS_RANK: Record<string, number> = { overdue: 0, active: 1, paused: 2, pending: 3, completed: 4 }

export default function QuickTools() {
    const isAuthed = useAuthGuard()
    const {
        timers,
        nowMs,
        createTimer,
        startTimer,
        pauseTimer,
        resumeTimer,
        addSeconds,
        completeTimer,
        resetTimer,
        removeTimer,
        clearCompleted,
        stopwatch,
        stopwatchElapsed,
        startStopwatch,
        pauseStopwatch,
        resetStopwatch,
        addLap
    } = useQuickTimers()

    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<FilterId>('all')
    const [usage, setUsage] = useState<Record<string, number>>({})
    const [panel, setPanel] = useState<{ type: 'tool'; id: string } | { type: 'guide'; id: string } | null>(null)
    const [alarmDismissed, setAlarmDismissed] = useState<Set<string>>(new Set())

    useEffect(() => {
        try {
            const raw = localStorage.getItem(USAGE_KEY)
            if (raw) setUsage(JSON.parse(raw))
        } catch {}
    }, [])

    const recordUse = useCallback((id: string) => {
        setUsage(prev => {
            const next = incrementUsage(prev, id)
            try { localStorage.setItem(USAGE_KEY, JSON.stringify(next)) } catch {}
            return next
        })
    }, [])

    const items = useMemo<GridItem[]>(() => {
        const toolItems = QUICK_TOOLS.map<GridItem>(t => ({
            id: t.id,
            title: t.name,
            description: t.description,
            category: TOOL_CATEGORY[t.kind],
            icon: TOOL_ICONS[t.kind],
            type: 'tool',
            haystack: toolHaystack(t),
            tool: t
        }))
        const guideItems = QUICK_GUIDES.map<GridItem>(g => ({
            id: g.id,
            title: g.title,
            description: g.summary,
            category: 'Guide',
            icon: BookOpen,
            type: 'guide',
            haystack: guideHaystack(g),
            guide: g
        }))
        return [...toolItems, ...guideItems]
    }, [])

    const visibleItems = useMemo(() => {
        const categoryMatch: Record<FilterId, (item: GridItem) => boolean> = {
            all: () => true,
            timers: i => i.type === 'tool' && ['timer', 'stopwatch', 'presets'].includes(i.tool!.kind),
            guides: i => i.type === 'guide',
            converters: i => i.type === 'tool' && ['unit', 'oven'].includes(i.tool!.kind)
        }
        const q = query.trim()
        const searched = q
            ? items.filter(i => {
                const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
                const hay = i.haystack.join(' ').toLowerCase()
                return terms.every(term => hay.includes(term))
            })
            : items
        return sortByUsage(searched.filter(categoryMatch[filter]), usage)
    }, [items, query, filter, usage])

    const sortedTimers = useMemo(
        () => [...timers].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.createdAt - a.createdAt),
        [timers]
    )

    const completedCount = timers.filter(t => t.status === 'completed').length

    const openItem = (item: GridItem) => {
        recordUse(item.id)
        if (item.type === 'guide') setPanel({ type: 'guide', id: item.id })
        else setPanel({ type: 'tool', id: item.id })
    }

    const closePanel = useCallback(() => setPanel(null), [])

    const openTool = panel?.type === 'tool' ? QUICK_TOOLS.find(t => t.id === panel.id) : undefined
    const openGuide = panel?.type === 'guide' ? QUICK_GUIDES.find(g => g.id === panel.id) : undefined

    const overdueTimers = timers.filter(t => t.status === 'overdue' && !alarmDismissed.has(t.id))

    // Fresh overdue timer — make sure its alarm shows again
    useEffect(() => {
        setAlarmDismissed(prev => {
            if (prev.size === 0) return prev
            const overdueIds = new Set(timers.filter(t => t.status === 'overdue').map(t => t.id))
            const next = new Set(Array.from(prev).filter(id => overdueIds.has(id)))
            return next.size === prev.size ? prev : next
        })
    }, [timers])

    if (!isAuthed) return null

    return (
        <Layout title="Quick Tools" description="Timers, converters and kitchen guides">
            <div className="w-full max-w-3xl mx-auto px-2 sm:px-4 pb-28 sm:pb-10">

                {/* Header */}
                <div className="mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold m-0 tracking-tight flex items-center gap-2">
                        <Zap size={24} className="text-emerald-400" /> Quick Tools
                    </h1>
                    <p className="m-0 mt-1 text-xs text-muted-foreground">
                        Timers, converters and kitchen guides — most-used first.
                    </p>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tools and guides…"
                        className="input-modern !pl-10 !pr-10 !py-3"
                        autoComplete="off"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            aria-label="Clear search"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>

                {/* Category chips */}
                <div className="flex gap-2 mb-5 overflow-x-auto hide-scrollbar">
                    {FILTERS.map(f => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFilter(f.id)}
                            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border transition-colors ${filter === f.id
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                                : 'border-border text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Active timers */}
                {sortedTimers.length > 0 && (
                    <section className="mb-7">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="m-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <Clock size={12} /> Timers
                            </h2>
                            {completedCount > 0 && (
                                <button
                                    type="button"
                                    onClick={clearCompleted}
                                    className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                >
                                    Clear done
                                </button>
                            )}
                        </div>
                        <div className="cooking-section-list">
                            {sortedTimers.map(timer => (
                                <QuickTimerCard
                                    key={timer.id}
                                    timer={timer}
                                    now={nowMs}
                                    onStart={startTimer}
                                    onPause={pauseTimer}
                                    onResume={resumeTimer}
                                    onAdd={addSeconds}
                                    onComplete={completeTimer}
                                    onReset={resetTimer}
                                    onRemove={removeTimer}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Tool / guide grid */}
                <section>
                    <h2 className="m-0 mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {filter === 'all' ? 'All tools & guides' : FILTERS.find(f => f.id === filter)?.label}
                    </h2>
                    {visibleItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                            No tools match “{query}”.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {visibleItems.map(item => {
                                const Icon = item.icon
                                const used = usage[item.id] || 0
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => openItem(item)}
                                        className="group flex items-start gap-3 text-left p-4 rounded-2xl border border-border bg-card/50 hover:bg-white/[0.04] hover:border-accent/40 transition-all active:scale-[0.98]"
                                    >
                                        <span className="shrink-0 w-10 h-10 rounded-xl bg-accent/10 text-accent border border-accent/20 flex items-center justify-center">
                                            <Icon size={18} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2 min-w-0">
                                                <span className="font-semibold text-sm truncate">{item.title}</span>
                                                {used > 0 && (
                                                    <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-emerald-400/80">
                                                        {used}×
                                                    </span>
                                                )}
                                            </span>
                                            <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{item.description}</span>
                                            <span className="block text-[9px] uppercase tracking-widest text-muted-foreground/60 mt-2">{item.category}</span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* Tool panels */}
            <QuickSheet
                open={!!openTool}
                title={openTool?.name || ''}
                subtitle={openTool?.description}
                onClose={closePanel}
            >
                {openTool?.kind === 'timer' && (
                    <QuickTimerCreator onStart={(name, sec) => createTimer(name, sec)} onDone={closePanel} />
                )}
                {openTool?.kind === 'stopwatch' && (
                    <Stopwatch
                        stopwatch={stopwatch}
                        elapsed={stopwatchElapsed}
                        onStart={startStopwatch}
                        onPause={pauseStopwatch}
                        onReset={resetStopwatch}
                        onLap={addLap}
                    />
                )}
                {openTool?.kind === 'presets' && (
                    <PresetTimers onStart={(label, sec) => createTimer(label, sec)} onDone={closePanel} />
                )}
                {openTool?.kind === 'unit' && <UnitConverter />}
                {openTool?.kind === 'oven' && <OvenConverter />}
            </QuickSheet>

            {/* Guide panel */}
            <QuickSheet
                open={!!openGuide}
                title={openGuide?.title || ''}
                subtitle={openGuide?.category}
                onClose={closePanel}
            >
                {openGuide && <GuideContent guide={openGuide} />}
            </QuickSheet>

            {/* Overdue alarm — rings until done/dismissed, same feel as cooking mode */}
            {overdueTimers.length > 0 && !panel && (
                <div className="cooking-alarm-wrap" style={{ position: 'fixed', zIndex: 2000 }} role="alert">
                    <div className="cooking-alarm-note">
                        <Clock size={12} />
                        {overdueTimers.length > 1 ? `${overdueTimers.length} timers overdue` : 'Timer overdue'} · rings every 4s
                    </div>
                    <div className="cooking-alarm-items">
                        {overdueTimers.map(timer => (
                            <div key={timer.id} className="cooking-alarm-item">
                                <span className="cooking-alarm-item-icon"><Clock size={22} /></span>
                                <span className="cooking-alarm-item-name">
                                    {timer.name}
                                    <span className="cooking-timer-tag is-overdue">Overdue</span>
                                </span>
                                <span className="cooking-alarm-item-count">
                                    {formatCountdown(Math.ceil(((timer.endTime || nowMs) - nowMs) / 1000))}
                                </span>
                                <div className="cooking-extend-row">
                                    <button className="cooking-timer-btn" onClick={() => addSeconds(timer.id, 120)}>+2 min</button>
                                    <button className="cooking-timer-btn" onClick={() => addSeconds(timer.id, 300)}>+5 min</button>
                                </div>
                                <button className="cooking-start-timer" onClick={() => completeTimer(timer.id)}>
                                    <Check size={16} strokeWidth={3} /> Done — dismiss
                                </button>
                                <button
                                    className="cooking-alarm-popup-view"
                                    onClick={() => setAlarmDismissed(prev => new Set([...Array.from(prev), timer.id]))}
                                >
                                    View timers
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Layout>
    )
}
