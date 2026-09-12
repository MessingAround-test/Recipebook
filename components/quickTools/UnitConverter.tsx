import { useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { CONVERTER_UNITS, convertUnit, roundSmart } from '../../lib/quickTools'

export default function UnitConverter() {
    const [value, setValue] = useState('1')
    const [from, setFrom] = useState('cup')
    const [to, setTo] = useState('ml')

    const numeric = parseFloat(value)
    const result = convertUnit(isFinite(numeric) ? numeric : 0, from, to)
    const fromUnit = CONVERTER_UNITS.find(u => u.id === from)
    const toUnit = CONVERTER_UNITS.find(u => u.id === to)
    const crossesFamily = fromUnit && toUnit && fromUnit.family !== toUnit.family

    const swap = () => {
        setFrom(to)
        setTo(from)
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount</label>
                <input
                    type="number"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="input-modern !py-3 text-lg font-bold"
                    autoFocus
                />
            </div>

            <div className="flex items-end gap-2">
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">From</label>
                    <select value={from} onChange={(e) => setFrom(e.target.value)} className="input-modern !py-3 appearance-none">
                        {CONVERTER_UNITS.map(u => (
                            <option key={u.id} value={u.id} className="bg-card text-foreground">{u.label}</option>
                        ))}
                    </select>
                </div>
                <button
                    type="button"
                    onClick={swap}
                    aria-label="Swap units"
                    className="mb-1 shrink-0 w-11 h-11 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-white/5 flex items-center justify-center transition-colors"
                >
                    <ArrowRightLeft size={16} />
                </button>
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">To</label>
                    <select value={to} onChange={(e) => setTo(e.target.value)} className="input-modern !py-3 appearance-none">
                        {CONVERTER_UNITS.map(u => (
                            <option key={u.id} value={u.id} className="bg-card text-foreground">{u.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mt-1 rounded-2xl border border-accent/30 bg-emerald-500/5 px-4 py-5 text-center">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Result</div>
                <div className="text-2xl font-bold tabular-nums break-words">
                    {result == null ? '—' : `${roundSmart(result, 3)} ${toUnit?.short || ''}`}
                </div>
                {fromUnit && toUnit && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                        {roundSmart(isFinite(numeric) ? numeric : 0, 2)} {fromUnit.short} = {result == null ? '—' : roundSmart(result, 3)} {toUnit.short}
                    </div>
                )}
                {crossesFamily && (
                    <div className="text-[10px] text-muted-foreground mt-2 italic">Cross weight/volume assumes water (1 ml ≈ 1 g).</div>
                )}
            </div>
        </div>
    )
}
