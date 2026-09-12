import { Play } from 'lucide-react'
import { formatDurationLabel, TIMER_PRESETS } from '../../lib/quickTools'

interface PresetTimersProps {
    onStart: (label: string, seconds: number) => void
    onDone?: () => void
}

export default function PresetTimers({ onStart, onDone }: PresetTimersProps) {
    const categories = Array.from(new Set(TIMER_PRESETS.map(p => p.category)))

    return (
        <div className="flex flex-col gap-5">
            {categories.map(category => (
                <div key={category} className="flex flex-col gap-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{category}</div>
                    <div className="grid grid-cols-1 gap-2">
                        {TIMER_PRESETS.filter(p => p.category === category).map(preset => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => { onStart(preset.label, preset.seconds); onDone?.() }}
                                className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-xl border border-border bg-white/[0.02] hover:bg-white/5 hover:border-accent/40 transition-all active:scale-[0.98] text-left"
                            >
                                <span className="text-sm font-semibold truncate">{preset.label}</span>
                                <span className="flex items-center gap-2 shrink-0 text-[11px] font-bold text-muted-foreground">
                                    {formatDurationLabel(preset.seconds / 60)}
                                    <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                                        <Play size={11} fill="currentColor" />
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
