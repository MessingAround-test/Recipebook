export interface CoverageRow {
    key: string;
    label: string;
    pct: number;
}

function barColor(pct: number): string {
    if (pct >= 100) return '#10b981';
    if (pct >= 80) return '#f59e0b';
    return '#f43f5e';
}

interface DayNutrientCoverageProps {
    coverage: CoverageRow[];
    title?: string;
    emptySlots?: string[];
    previewLabel?: string | null;
    previewColor?: string | null;
    previewDeltaByKey?: Record<string, number>;
    maxItems?: number;
}

/**
 * Base "Today's Nutrient Coverage" panel. Shared by the planner's AI day-fill
 * popup and the dashboard's estimated-intake modal so they always look the same.
 */
export default function DayNutrientCoverage({
    coverage,
    title = "Today's Nutrient Coverage",
    emptySlots = [],
    previewLabel = null,
    previewColor = null,
    previewDeltaByKey = {},
    maxItems = 8,
}: DayNutrientCoverageProps) {
    return (
        <section className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between mb-2 gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{title}</h3>
                {emptySlots.length > 0 && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground shrink-0">
                        Empty: {emptySlots.join(', ')}
                    </span>
                )}
            </div>

            {previewLabel && previewColor && (
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-widest"
                    style={{ backgroundColor: `${previewColor}22`, color: previewColor, border: `1px solid ${previewColor}55` }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: previewColor }} />
                    Previewing: {previewLabel}
                </div>
            )}

            <div className="space-y-1">
                {coverage.slice(0, maxItems).map(c => {
                    const baseW = Math.min(c.pct, 100);
                    const delta = previewDeltaByKey[c.key];
                    const deltaW = delta != null ? Math.max(0, Math.min(delta, 100 - baseW)) : 0;
                    return (
                        <div key={c.key} className="flex items-center gap-2">
                            <span className={`w-20 shrink-0 font-bold text-[10px] truncate ${c.pct < 95 ? 'text-amber-300' : 'text-muted-foreground'}`}>{c.label}</span>
                            <div className="flex-1 relative h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${baseW}%`, backgroundColor: barColor(c.pct) }} />
                                {deltaW > 0 && previewColor && (
                                    <div
                                        className="absolute inset-y-0 rounded-full border-l border-white/30"
                                        style={{ left: `${baseW}%`, width: `${deltaW}%`, backgroundColor: previewColor }}
                                    />
                                )}
                            </div>
                            <span className="w-14 shrink-0 text-right font-black text-[10px]">
                                <span className={c.pct < 95 ? 'text-amber-400' : 'text-emerald-400'}>{Math.round(c.pct)}%</span>
                                {delta != null && delta > 0 && previewColor && (
                                    <span style={{ color: previewColor }}> +{Math.round(delta)}</span>
                                )}
                            </span>
                        </div>
                    );
                })}
                {coverage.length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">No coverage data yet.</p>
                )}
            </div>
        </section>
    );
}
