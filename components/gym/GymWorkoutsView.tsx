// Workouts tab: plan cards with START + back-date row, active session resume,
// quick start and the recent sessions feed.
import React, { useState, useMemo } from 'react';
import { FiPlay, FiClock, FiCalendar, FiZap, FiActivity, FiChevronRight } from 'react-icons/fi';
import { useRouter } from 'next/router';
import ExercisePicker from './ExercisePicker';
import { todayLocalISO } from '../../lib/gym';

interface PlanDoc {
    _id: string;
    name: string;
    description?: string;
    items: any[];
}

interface SessionDoc {
    _id: string;
    plan_name_snapshot?: string;
    date: string;
    status: string;
    exercises: any[];
    started_at?: string;
    completed_at?: string | null;
}

interface ExerciseDoc { _id: string; name: string; muscle_group?: string; }

interface Props {
    plans: PlanDoc[];
    sessions: SessionDoc[];
    exercises: ExerciseDoc[];
    lastPerformed: Record<string, string>;
    busy?: boolean;
    onStartPlan: (planId: string, date: string) => void;
    onQuickStart: (exerciseIds: string[], date: string, settings?: { rest_seconds: number | null; order_mode: 'sequential' | 'circuit' }) => void;
    onCreateExercise: (name: string) => Promise<ExerciseDoc | null>;
}

function DateRow({ date, setDate }: { date: string; setDate: (d: string) => void }) {
    const isToday = date === todayLocalISO();
    return (
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <FiCalendar size={12} className="text-muted-foreground" />
            <span className="text-muted-foreground">Log for:</span>
            <div className="relative">
                <input type="date" value={date} max={todayLocalISO()} onChange={e => setDate(e.target.value || todayLocalISO())} className="bg-foreground/5 border border-border rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground" />
            </div>
            {!isToday && (
                <button onClick={() => setDate(todayLocalISO())} className="text-olive hover:underline normal-case tracking-normal font-bold">Today</button>
            )}
        </div>
    );
}

export default function GymWorkoutsView({ plans, sessions, exercises, lastPerformed, busy, onStartPlan, onQuickStart, onCreateExercise }: Props) {
    const router = useRouter();
    const today = todayLocalISO();
    const [planDates, setPlanDates] = useState<Record<string, string>>({});
    const [quickDate, setQuickDate] = useState(today);
    const [pickerOpen, setPickerOpen] = useState(false);

    const activeSessions = useMemo(() => sessions.filter(s => s.status === 'active'), [sessions]);
    const recent = useMemo(() => sessions.filter(s => s.status === 'completed').slice(0, 8), [sessions]);

    return (
        <div className="space-y-6">
            {/* Active sessions */}
            {activeSessions.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-butter">In progress — resume?</h3>
                    {activeSessions.map(s => (
                        <button
                            key={s._id}
                            onClick={() => router.push(`/gym/session/${s._id}`)}
                            className="w-full flex items-center gap-3 bg-butter/[0.06] border border-butter/30 rounded-2xl px-4 py-3 hover:bg-butter/10 transition-colors text-left"
                        >
                            <FiActivity size={16} className="text-butter shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-black text-foreground truncate">{s.plan_name_snapshot || 'Quick workout'}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.date} · {s.exercises.length} exercises</div>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-butter flex items-center gap-1">Resume <FiChevronRight size={13} /></span>
                        </button>
                    ))}
                </div>
            )}

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map(plan => {
                    const date = planDates[plan._id] || today;
                    return (
                        <div key={plan._id} className="bg-card border border-border rounded-3xl p-5 shadow-sm flex flex-col gap-4">
                            <div>
                                <h3 className="text-base font-black text-foreground">{plan.name}</h3>
                                {plan.description && <p className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">{plan.description}</p>}
                                <div className="flex items-center gap-3 mt-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <span className="flex items-center gap-1"><FiActivity size={11} /> {plan.items.length} exercises</span>
                                    {lastPerformed[plan._id] && <span className="flex items-center gap-1"><FiClock size={11} /> {lastPerformed[plan._id]}</span>}
                                </div>
                            </div>
                            <div className="mt-auto space-y-3">
                                <DateRow date={date} setDate={d => setPlanDates(p => ({ ...p, [plan._id]: d }))} />
                                <button
                                    onClick={() => onStartPlan(plan._id, date)}
                                    disabled={busy}
                                    className="w-full py-3 rounded-xl bg-olive text-primary-foreground text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-olive/85 transition-all active:scale-95 shadow-lg shadow-olive/20"
                                >
                                    <FiPlay size={14} /> Start
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick start */}
            <div className="bg-card border border-border rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-water/10 flex items-center justify-center text-water shrink-0"><FiZap size={18} /></div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Quick Start</h3>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Pick any exercises — 3 sets to failure each (adjustable mid-workout)</p>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    <DateRow date={quickDate} setDate={setQuickDate} />
                    <button
                        onClick={() => setPickerOpen(true)}
                        disabled={busy || !exercises.length}
                        className="px-6 py-3 rounded-xl bg-water text-primary-foreground text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-water/85 transition-all active:scale-95"
                    >
                        <FiPlay size={14} /> Pick & Go
                    </button>
                </div>
            </div>

            {/* Recent sessions */}
            <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Recent sessions</h3>
                {recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-card border border-border rounded-2xl p-5 text-center">No completed workouts yet — hit START on a plan above.</p>
                ) : (
                    <div className="space-y-1.5">
                        {recent.map(s => (
                            <button
                                key={s._id}
                                onClick={() => router.push(`/gym/history/${s._id}`)}
                                className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 hover:border-olive/40 transition-colors text-left"
                            >
                                <div className="text-[11px] font-black tabular-nums text-muted-foreground w-20 shrink-0">{s.date}</div>
                                <div className="flex-1 min-w-0 text-sm font-bold text-foreground truncate">{s.plan_name_snapshot || 'Quick workout'}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">{s.exercises.length} ex</div>
                                <FiChevronRight size={14} className="text-muted-foreground shrink-0" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <ExercisePicker
                open={pickerOpen}
                exercises={exercises}
                date={quickDate}
                busy={busy}
                onClose={() => setPickerOpen(false)}
                onCreateExercise={onCreateExercise}
                onStart={(ids, settings) => { setPickerOpen(false); onQuickStart(ids, quickDate, settings); }}
            />
        </div>
    );
}
