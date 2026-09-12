import { useState } from 'react'
import { Play } from 'lucide-react'
import { parseDuration } from '../../lib/quickTools'

interface QuickTimerCreatorProps {
    onStart: (name: string, seconds: number) => void
    onDone?: () => void
}

const QUICK_MINUTES = [1, 2, 3, 5, 10, 15]

export default function QuickTimerCreator({ onStart, onDone }: QuickTimerCreatorProps) {
    const [name, setName] = useState('')
    const [minutes, setMinutes] = useState('')
    const [seconds, setSeconds] = useState('')

    const total = parseDuration(minutes, seconds)
    const canStart = total > 0

    const start = () => {
        if (!canStart) return
        onStart(name.trim() || 'Timer', total)
        setName('')
        setMinutes('')
        setSeconds('')
        onDone?.()
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Timer name</label>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') start() }}
                    placeholder="e.g. Roast chicken"
                    className="input-modern !py-3"
                    autoFocus
                />
            </div>

            <div className="flex items-end gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Minutes</label>
                    <input
                        type="number"
                        min="0"
                        max="999"
                        inputMode="numeric"
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') start() }}
                        placeholder="0"
                        className="input-modern !py-3 text-center text-lg font-bold"
                    />
                </div>
                <span className="pb-3 text-xl font-black text-muted-foreground">:</span>
                <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Seconds</label>
                    <input
                        type="number"
                        min="0"
                        max="59"
                        inputMode="numeric"
                        value={seconds}
                        onChange={(e) => setSeconds(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') start() }}
                        placeholder="0"
                        className="input-modern !py-3 text-center text-lg font-bold"
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {QUICK_MINUTES.map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setMinutes(String(m))}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold border border-border text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                    >
                        {m} min
                    </button>
                ))}
            </div>

            <button
                type="button"
                disabled={!canStart}
                onClick={start}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 ${canStart
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-xl shadow-emerald-500/20'
                    : 'bg-white/5 text-muted-foreground cursor-not-allowed'}`}
            >
                <Play size={15} /> Start timer
            </button>
        </div>
    )
}
