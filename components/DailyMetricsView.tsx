import React, { useState, useEffect } from 'react';
import { FiZap, FiTarget, FiActivity, FiSave, FiPlus, FiTrash2, FiClock } from 'react-icons/fi';
import { Button } from './ui/button';

const EXERCISE_ACTIVITIES = [
    { label: 'Walking (Brisk)', met: 4.5 },
    { label: 'Running (Moderate, 8km/h)', met: 8.3 },
    { label: 'Running (Fast, 12km/h)', met: 12.5 },
    { label: 'Cycling (Moderate)', met: 8.0 },
    { label: 'Cycling (Fast)', met: 12.0 },
    { label: 'Swimming (Moderate)', met: 7.0 },
    { label: 'Swimming (Vigorous)', met: 10.0 },
    { label: 'Weight Training (Moderate)', met: 5.0 },
    { label: 'Weight Training (Heavy)', met: 8.0 },
    { label: 'Yoga / Pilates', met: 3.0 },
    { label: 'HIIT / Circuit Training', met: 8.0 },
    { label: 'Tennis', met: 7.3 },
    { label: 'Basketball', met: 8.0 },
    { label: 'Football / Soccer', met: 7.0 },
];

export default function DailyMetricsView({ 
    initialWeight, 
    initialExerciseKcal, 
    userWeight,
    onSave 
}: { 
    initialWeight: string, 
    initialExerciseKcal: string, 
    userWeight: number,
    onSave: (weight: number | null, exercise: number) => Promise<void> 
}) {
    const [weight, setWeight] = useState(initialWeight);
    const [exerciseKcal, setExerciseKcal] = useState(initialExerciseKcal);
    const [saving, setSaving] = useState(false);

    // Exercise builder states
    const [selectedActivity, setSelectedActivity] = useState(EXERCISE_ACTIVITIES[0]);
    const [durationMins, setDurationMins] = useState(30);

    useEffect(() => {
        setWeight(initialWeight);
        setExerciseKcal(initialExerciseKcal);
    }, [initialWeight, initialExerciseKcal]);

    const calculatedKcal = Math.round(selectedActivity.met * (Number(weight) || userWeight || 70) * (durationMins / 60));

    const handleSave = async () => {
        setSaving(true);
        await onSave(weight ? Number(weight) : null, Number(exerciseKcal));
        setSaving(false);
    };

    const addCalculatedExercise = () => {
        setExerciseKcal(prev => (Number(prev) + calculatedKcal).toString());
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weight Section */}
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <FiTarget size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Current Weight</h3>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Log your weigh-in for today</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <input 
                                type="number" 
                                step="0.1"
                                value={weight} 
                                onChange={(e) => setWeight(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-2xl font-black focus:ring-4 focus:ring-emerald-500/20 transition-all pr-16" 
                                placeholder="0.0"
                            />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground uppercase tracking-widest">kg</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground px-2">Regular weigh-ins improve weight projection accuracy.</p>
                    </div>
                </div>

                {/* Exercise Summary Section */}
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                            <FiZap size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Daily Exercise</h3>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Total energy burned today</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <input 
                                type="number" 
                                value={exerciseKcal} 
                                onChange={(e) => setExerciseKcal(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-2xl font-black focus:ring-4 focus:ring-amber-500/20 transition-all pr-16" 
                                placeholder="0"
                            />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground uppercase tracking-widest">kcal</span>
                        </div>
                        <button 
                            onClick={() => setExerciseKcal("0")}
                            className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 transition-colors flex items-center gap-1 px-2"
                        >
                            <FiTrash2 size={12} /> Clear Total
                        </button>
                    </div>
                </div>
            </div>

            {/* Exercise Builder */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <FiActivity size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Activity Calculator</h3>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Add energy based on physical activity</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Activity Type</label>
                        <select 
                            value={EXERCISE_ACTIVITIES.indexOf(selectedActivity)}
                            onChange={(e) => setSelectedActivity(EXERCISE_ACTIVITIES[Number(e.target.value)])}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500/50"
                        >
                            {EXERCISE_ACTIVITIES.map((act, idx) => (
                                <option key={act.label} value={idx}>{act.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Duration (minutes)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={durationMins} 
                                onChange={(e) => setDurationMins(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500/50 pr-12" 
                            />
                            <FiClock className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex flex-col justify-center">
                            <div className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-0.5">Estimated</div>
                            <div className="text-lg font-black text-white">{calculatedKcal} kcal</div>
                        </div>
                        <button 
                            onClick={addCalculatedExercise}
                            className="p-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                        >
                            <FiPlus size={24} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
                <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="w-full md:w-auto min-w-[200px] h-14 !bg-emerald-500 !text-black font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/30 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                    {saving ? 'Syncing...' : <><FiSave size={20} /> Save Daily Stats</>}
                </Button>
            </div>
        </div>
    );
}
