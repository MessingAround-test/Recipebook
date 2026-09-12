import { useState } from 'react'
import { celsiusToFahrenheit, conventionalToFan, fahrenheitToCelsius, GAS_MARK_TABLE, nearestGasMark, roundSmart } from '../../lib/quickTools'

export default function OvenConverter() {
    const [mode, setMode] = useState<'C' | 'F'>('C')
    const [value, setValue] = useState('180')
    const [fan, setFan] = useState(false)

    const numeric = parseFloat(value)
    const celsius = mode === 'C' ? (isFinite(numeric) ? numeric : 0) : fahrenheitToCelsius(isFinite(numeric) ? numeric : 0)
    const fahrenheit = celsiusToFahrenheit(celsius)
    const fanC = conventionalToFan(celsius)
    const gas = nearestGasMark(celsius)

    const displayC = fan ? fanC : celsius
    const displayF = fan ? celsiusToFahrenheit(fanC) : fahrenheit

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Temperature</label>
                <div className="flex gap-2">
                    <input
                        type="number"
                        inputMode="numeric"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="input-modern !py-3 text-lg font-bold flex-1"
                        autoFocus
                    />
                    <div className="flex rounded-xl overflow-hidden border border-border shrink-0">
                        {(['C', 'F'] as const).map((unit) => (
                            <button
                                key={unit}
                                type="button"
                                onClick={() => setMode(unit)}
                                className={`px-4 font-black text-sm transition-colors ${mode === unit ? 'bg-emerald-500 text-black' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                °{unit}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={() => setFan(f => !f)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${fan ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border bg-white/[0.02]'}`}
            >
                <span className="text-sm font-semibold">Fan-forced oven</span>
                <span className={`relative w-11 h-6 rounded-full transition-colors ${fan ? 'bg-emerald-500' : 'bg-white/10'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${fan ? 'left-[1.375rem]' : 'left-0.5'}`} />
                </span>
            </button>

            <div className="rounded-2xl border border-accent/30 bg-emerald-500/5 px-4 py-5 text-center">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                    Set oven to{fan ? ' (fan)' : ''}
                </div>
                <div className="text-3xl font-bold tabular-nums">{roundSmart(displayC, 0)}°C</div>
                <div className="text-sm text-muted-foreground tabular-nums">{roundSmart(displayF, 0)}°F</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border px-4 py-3 text-center">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Conventional</div>
                    <div className="text-sm font-bold tabular-nums">{roundSmart(celsius, 0)}°C · {roundSmart(fahrenheit, 0)}°F</div>
                </div>
                <div className="rounded-xl border border-border px-4 py-3 text-center">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Fan-forced</div>
                    <div className="text-sm font-bold tabular-nums">{roundSmart(fanC, 0)}°C · {roundSmart(celsiusToFahrenheit(fanC), 0)}°F</div>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Gas mark reference</div>
                <div className="flex flex-wrap gap-2">
                    {GAS_MARK_TABLE.map(row => (
                        <button
                            key={row.mark}
                            type="button"
                            onClick={() => { setMode('C'); setValue(String(row.celsius)) }}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${gas.mark === row.mark ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-border text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                        >
                            Gas {row.mark} · {row.celsius}°C
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
