import { useState } from 'react';
import Modal from 'react-modal';
import { NUTRIENT_LABELS, DailyIntakeTargets } from '../lib/dailyIntake';
import { FiX } from 'react-icons/fi';

type Group = 'macro' | 'mineral' | 'vitamin';

const TABS: { key: Group; label: string }[] = [
    { key: 'macro', label: 'Macros' },
    { key: 'mineral', label: 'Minerals' },
    { key: 'vitamin', label: 'Vitamins' },
];

function fmtVal(v: number, unit: string): string {
    if (v === 0) return `0${unit}`;
    let val = v;
    let u = unit;
    const convertible = ['mg', 'μg', 'g'];
    while (convertible.includes(u) && val >= 1000) {
        if (u === 'mg') { val /= 1000; u = 'g'; }
        else if (u === 'μg') { val /= 1000; u = 'mg'; }
        else if (u === 'g') { val /= 1000; u = 'kg'; }
        else break;
    }
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k' + (u ? ' ' + u : '');
    if (val >= 100) return Math.round(val).toString() + u;
    if (val < 1) return val.toFixed(2) + u;
    return val.toFixed(1) + u;
}

function barColor(pct: number): string {
    if (pct <= 100) return '#10b981';
    if (pct <= 130) return '#f59e0b';
    return '#f43f5e';
}

interface Props {
    open: boolean;
    onClose: () => void;
    totals: Record<string, number>;
    targets: Partial<DailyIntakeTargets> | null;
}

export default function TodayNutritionModal({ open, onClose, totals, targets }: Props) {
    const [tab, setTab] = useState<Group>('macro');

    const rows = (Object.keys(NUTRIENT_LABELS) as (keyof DailyIntakeTargets)[])
        .filter(k => NUTRIENT_LABELS[k].group === tab)
        .map(k => {
            const target = targets?.[k] || 0;
            const consumed = totals[k] || 0;
            const pct = target > 0 ? (consumed / target) * 100 : 0;
            return { key: k, label: NUTRIENT_LABELS[k].label, unit: NUTRIENT_LABELS[k].unit, target, consumed, pct };
        })
        .filter(r => r.target > 0)
        .sort((a, b) => b.pct - a.pct);

    return (
        <Modal
            isOpen={open}
            onRequestClose={onClose}
            portalClassName="dark"
            style={{
                content: {
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f8fafc',
                    inset: '1rem',
                    maxWidth: '560px',
                    margin: '0 auto',
                    padding: '1.5rem',
                    borderRadius: '0.75rem',
                    overflowY: 'auto',
                    maxHeight: '90vh',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                },
                overlay: {
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 200
                }
            }}
            contentLabel="Today's Nutrition"
        >
            <div className="dark flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-black tracking-tight">Today's Nutrition</h2>
                        <p className="text-xs text-muted-foreground">Logged intake vs daily targets</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none transition-colors">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="flex gap-1 mb-4 p-1 rounded-xl bg-black/20 border border-white/5">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex-1 text-[10px] font-black uppercase tracking-wider px-2 py-1.5 min-h-[40px] rounded-lg transition-all ${tab === t.key
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No targets for this group.</p>
                ) : (
                    <div className="space-y-2">
                        {rows.map(r => (
                            <div key={r.key} className="flex items-center gap-2 sm:gap-3 py-1">
                                <span className="w-20 sm:w-24 shrink-0 font-bold text-xs truncate text-muted-foreground">{r.label}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(r.pct, 100)}%`, backgroundColor: barColor(r.pct) }} />
                                    </div>
                                </div>
                                <span className="w-14 sm:w-16 shrink-0 text-right text-[10px] font-bold text-muted-foreground tabular-nums">
                                    {fmtVal(r.consumed, r.unit)}/{fmtVal(r.target, r.unit)}
                                </span>
                                <span className={`w-10 sm:w-11 shrink-0 text-right font-black text-xs tabular-nums ${r.pct > 130 ? 'text-rose-400' : r.pct > 100 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {Math.round(r.pct)}%
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
}
