import React, { useState, useEffect } from 'react';
import { FiTrendingUp, FiCalendar, FiSmile, FiMeh, FiFrown } from 'react-icons/fi';

interface SymptomStat {
    name: string;
    count: number;
    totalDays: number;
    loggedDays: number;
    frequency: number;
}

interface MoodStats {
    avg: number;
    distribution: { red: number; orange: number; green: number };
    loggedDays: number;
}

interface StatsData {
    totalDays: number;
    loggedDays: number;
    symptoms: SymptomStat[];
    mood: MoodStats;
}

export default function SymptomStatsView({ startDate, endDate }: { startDate: string; endDate: string }) {
    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            const token = localStorage.getItem('Token');
            if (!token) return;
            try {
                const res = await fetch(`/api/symptomLog/stats?startDate=${startDate}&endDate=${endDate}`, { headers: { edgetoken: token } });
                const d = await res.json();
                if (d.success) setData(d);
            } catch (err) { console.error("Failed to load symptom stats", err); }
            finally { setLoading(false); }
        };
        fetchStats();
    }, [startDate, endDate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-pulse text-emerald-500 font-black tracking-widest text-[10px] uppercase">Loading symptoms...</div>
            </div>
        );
    }

    if (!data) return null;

    const getFrequencyColor = (pct: number) => {
        if (pct >= 50) return 'bg-rose-500 text-rose-400 border-rose-500/30';
        if (pct >= 25) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        if (pct >= 10) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    };

    const getBarColor = (pct: number) => {
        if (pct >= 50) return 'bg-rose-500';
        if (pct >= 25) return 'bg-orange-500';
        if (pct >= 10) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const avgMood = data.mood.avg;
    const moodEmoji = avgMood <= 3 ? '😢' : avgMood <= 6 ? '😐' : '😊';

    return (
        <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Days Logged</div>
                    <div className="text-2xl font-black">{data.loggedDays}<span className="text-sm text-muted-foreground font-bold ml-1">/ {data.totalDays}</span></div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Symptoms</div>
                    <div className="text-2xl font-black">{data.symptoms.length}</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Avg Mood</div>
                    <div className="text-2xl font-black flex items-center gap-2">{avgMood > 0 ? `${avgMood.toFixed(1)}` : '—'} <span className="text-xl">{avgMood > 0 ? moodEmoji : ''}</span></div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Mood Logged</div>
                    <div className="text-2xl font-black">{data.mood.loggedDays}<span className="text-sm text-muted-foreground font-bold ml-1">days</span></div>
                </div>
            </div>

            {/* Symptom frequency list */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-xl">
                <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Symptom Frequency
                </h3>

                {data.symptoms.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                        <FiTrendingUp size={32} className="mx-auto mb-3 opacity-30" />
                        No symptoms logged in this period.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {data.symptoms.map(s => (
                            <div key={s.name} className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-sm capitalize">{s.name}</span>
                                    <div className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${getFrequencyColor(s.frequency)}`}>
                                        {s.frequency}%
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${getBarColor(s.frequency)} rounded-full transition-all duration-1000`}
                                        style={{ width: `${s.frequency}%` }}
                                    />
                                </div>
                                <div className="text-[9px] text-muted-foreground font-bold mt-1.5">
                                    {s.count} of {s.loggedDays} days logged
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Mood distribution */}
            {data.mood.loggedDays > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-xl">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Mood Breakdown
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { key: 'red', icon: FiFrown, label: 'Low (1-3)', count: data.mood.distribution.red, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
                            { key: 'orange', icon: FiMeh, label: 'Mid (4-6)', count: data.mood.distribution.orange, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                            { key: 'green', icon: FiSmile, label: 'High (7-10)', count: data.mood.distribution.green, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                        ].map(m => {
                            const pct = data.mood.loggedDays > 0 ? Math.round((m.count / data.mood.loggedDays) * 100) : 0;
                            return (
                                <div key={m.key} className={`${m.bg} ${m.border} border rounded-2xl p-4 text-center`}>
                                    <m.icon size={24} className={`mx-auto mb-2 ${m.color}`} />
                                    <div className={`text-xl font-black ${m.color}`}>{pct}%</div>
                                    <div className="text-[9px] font-bold text-muted-foreground mt-1">{m.label}</div>
                                    <div className="text-[10px] text-muted-foreground/60 font-bold">{m.count} days</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
