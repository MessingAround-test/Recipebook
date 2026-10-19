// Shared "workout options" fields for setup flows (plan builder + quick start):
// break timer on/off with duration, and running order (sequential vs circuit).
import React from 'react';
import { OrderMode } from '../../lib/gym';

export interface WorkoutSettings {
    rest_seconds: number | null;
    order_mode: OrderMode;
}

const REST_PRESETS = [60, 90, 120];

export default function WorkoutOptions({
    settings,
    onChange,
}: {
    settings: WorkoutSettings;
    onChange: (next: WorkoutSettings) => void;
}) {
    const restOn = settings.rest_seconds != null;
    const isPreset = restOn && REST_PRESETS.includes(settings.rest_seconds as number);

    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-foreground/[0.03] border border-border rounded-xl px-4 py-3">
            {/* Break timer */}
            <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={restOn}
                        onChange={e => onChange({ ...settings, rest_seconds: e.target.checked ? 90 : null })}
                        className="accent-olive w-4 h-4"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Break timer</span>
                </label>
                {restOn && (
                    <div className="flex items-center gap-1">
                        {REST_PRESETS.map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => onChange({ ...settings, rest_seconds: p })}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${settings.rest_seconds === p ? 'bg-olive text-primary-foreground' : 'bg-foreground/5 text-muted-foreground hover:text-foreground'}`}
                            >
                                {p}s
                            </button>
                        ))}
                        <input
                            type="number"
                            min={5}
                            max={1800}
                            value={isPreset ? '' : String(settings.rest_seconds)}
                            placeholder="custom"
                            onChange={e => {
                                const v = e.target.value === '' ? null : Math.min(1800, Math.max(5, Math.floor(Number(e.target.value)) || 0));
                                onChange({ ...settings, rest_seconds: Number.isFinite(v as any) && v ? v : 90 });
                            }}
                            className="w-[72px] bg-input border border-border rounded-lg px-2 py-1 text-[11px] font-bold text-foreground"
                            title="Custom rest seconds"
                        />
                    </div>
                )}
            </div>

            {/* Running order */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Order</span>
                <select
                    value={settings.order_mode}
                    onChange={e => onChange({ ...settings, order_mode: e.target.value as OrderMode })}
                    className="bg-input border border-border rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground"
                >
                    <option value="sequential">Sequential</option>
                    <option value="circuit">Circuit (rounds)</option>
                </select>
            </div>
        </div>
    );
}
