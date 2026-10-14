// Rest timer panel shown in the session runner after a set is logged.
// Presets 60/90/120s + custom; pause / +15s / skip. Uses the shared kitchen
// alarm via useRestTimer.
import React, { useState } from 'react';
import { FiPlay, FiPause, FiPlus, FiX, FiSkipForward } from 'react-icons/fi';
import { useRestTimer } from '../../lib/useRestTimer';
import { formatDurationSec } from '../../lib/gym';

const PRESETS = [60, 90, 120];

export default function RestTimer({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
    const [customOpen, setCustomOpen] = useState(false);
    const [customSecs, setCustomSecs] = useState(90);

    const { running, remaining, duration, finished } = timer;
    const pct = duration > 0 ? Math.max(0, Math.min(100, ((duration - remaining) / duration) * 100)) : 0;

    return (
        <div className={`border rounded-2xl p-4 transition-all ${finished ? 'bg-butter/10 border-butter/40' : running ? 'bg-olive/[0.06] border-olive/30' : 'bg-card border-border'}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className={`text-2xl font-black tabular-nums ${finished ? 'text-butter' : 'text-foreground'}`}>
                        {finished ? 'REST OVER' : formatDurationSec(remaining)}
                    </div>
                    {running && (
                        <div className="w-24 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                            <div className="h-full bg-olive transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {(remaining === 0 || finished) && PRESETS.map(sec => (
                        <button key={sec} onClick={() => timer.start(sec)} className="px-3 py-1.5 rounded-lg bg-olive/10 text-olive text-[10px] font-black uppercase tracking-widest hover:bg-olive/20 transition-colors">
                            {formatDurationSec(sec)}
                        </button>
                    ))}
                    {running ? (
                        <button onClick={timer.pause} className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-muted-foreground transition-colors"><FiPause size={14} /></button>
                    ) : remaining > 0 ? (
                        <button onClick={timer.resume} className="p-2 rounded-lg bg-olive/10 text-olive hover:bg-olive/20 transition-colors"><FiPlay size={14} /></button>
                    ) : null}
                    {remaining > 0 && <button onClick={() => timer.addSeconds(15)} className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-muted-foreground transition-colors" title="+15s"><FiPlus size={14} /></button>}
                    <button onClick={() => setCustomOpen(o => !o)} className="px-3 py-1.5 rounded-lg bg-foreground/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-foreground/10 transition-colors">Custom</button>
                    <button onClick={timer.dismiss} className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-muted-foreground transition-colors" title="Skip rest"><FiSkipForward size={14} /></button>
                </div>
            </div>
            {customOpen && (
                <div className="flex items-center gap-2 mt-3">
                    <input
                        type="number"
                        min={5}
                        max={1800}
                        value={customSecs}
                        onChange={e => setCustomSecs(Number(e.target.value))}
                        className="w-24 bg-input border border-border rounded-lg px-3 py-1.5 text-sm font-bold text-foreground"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">seconds</span>
                    <button
                        onClick={() => { timer.start(customSecs); setCustomOpen(false); }}
                        className="px-3 py-1.5 rounded-lg bg-olive text-primary-foreground text-[10px] font-black uppercase tracking-widest"
                    >
                        Start
                    </button>
                    <button onClick={() => setCustomOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground"><FiX size={14} /></button>
                </div>
            )}
        </div>
    );
}
