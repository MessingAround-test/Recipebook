import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiZap, FiPlus, FiSearch, FiArrowRight } from 'react-icons/fi';
import { NUTRIENT_LABELS } from '../lib/dailyIntake';

interface NutrientResearchModalProps {
    nutrientKey: string;
    onClose: () => void;
    onResearch: (ingredientName: string) => void;
}

export default function NutrientResearchModal({ nutrientKey, onClose, onResearch }: NutrientResearchModalProps) {
    const [topSources, setTopSources] = useState<any[]>([]);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [loadingSources, setLoadingSources] = useState(true);
    const [loadingAi, setLoadingAi] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [inputValue, setInputValue] = useState('');
    const nutrientInfo = (NUTRIENT_LABELS as any)[nutrientKey];

    const fetchTopSources = useCallback(async (query: string) => {
        setLoadingSources(true);
        try {
            const res = await fetch(`/api/Nutrition/topSources?nutrient=${nutrientKey}&search=${encodeURIComponent(query)}`, {
                headers: { 'edgetoken': localStorage.getItem('Token') || '' }
            });
            const data = await res.json();
            if (data.success) {
                setTopSources(data.data);
            }
        } catch (err) {
            console.error("Failed to fetch top sources:", err);
        } finally {
            setLoadingSources(false);
        }
    }, [nutrientKey]);

    useEffect(() => {
        if (nutrientKey) {
            fetchTopSources(searchQuery);
        }
    }, [nutrientKey, searchQuery, fetchTopSources]);

    const handleAiSuggest = useCallback(async () => {
        setLoadingAi(true);
        try {
            const res = await fetch('/api/ai/suggest_ingredients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': localStorage.getItem('Token') || ''
                },
                body: JSON.stringify({ nutrientLabel: nutrientInfo?.label || nutrientKey })
            });
            const data = await res.json();
            if (data.success) {
                setAiSuggestions(data.data);
            }
        } catch (err) {
            console.error("Failed to get AI suggestions:", err);
        } finally {
            setLoadingAi(false);
        }
    }, [nutrientKey, nutrientInfo?.label]);

    useEffect(() => {
        if (!loadingSources && topSources.length < 10 && !loadingAi && aiSuggestions.length === 0) {
            handleAiSuggest();
        }
    }, [loadingSources, topSources.length, loadingAi, aiSuggestions.length, handleAiSuggest]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div>
                    <h2 className="text-lg font-black flex items-center gap-2">
                        <span className="text-emerald-500">{nutrientInfo?.label}</span> Optimization
                    </h2>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Research high-density sources</p>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-full transition-colors">
                    <FiX size={20} />
                </button>
            </div>

            <div className="px-4 pb-2">
                <form onSubmit={(e) => { e.preventDefault(); setSearchQuery(inputValue); }} className="relative flex gap-2">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        <input 
                            type="text"
                            placeholder={`Search database for ${nutrientInfo?.label}...`}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        />
                    </div>
                    <button 
                        type="submit"
                        className="px-4 py-2 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all"
                    >
                        Search
                    </button>
                </form>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Database Sources */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" /> From Your Database
                        </h3>
                    </div>
                    {loadingSources ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-white/5 animate-pulse rounded-2xl" />)}
                        </div>
                    ) : topSources.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {topSources.map((source) => (
                                <div key={source._id} className="p-3 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all group">
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="min-w-0">
                                            <div className="font-bold text-xs truncate capitalize leading-tight">{source.ingredient_name}</div>
                                            <div className="text-[10px] font-black text-emerald-500 mt-0.5 uppercase tracking-wider">
                                                {Math.round(source[nutrientKey])}{nutrientInfo?.unit}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onResearch(source.ingredient_name)}
                                            className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-black transition-all shrink-0"
                                            title="Research store prices"
                                        >
                                            <FiSearch size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-muted-foreground text-sm border-2 border-dashed border-white/5 rounded-2xl">
                            No sources found in database. Try AI generation.
                        </div>
                    )}
                </section>

                {/* AI Suggestions */}
                <section className="pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 flex items-center gap-2">
                            <FiZap /> Recommendations
                        </h3>
                        {!aiSuggestions.length && !loadingAi && (
                            <button
                                onClick={handleAiSuggest}
                                className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all"
                            >
                                Generate
                            </button>
                        )}
                    </div>

                    {loadingAi ? (
                        <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 w-24 bg-white/5 animate-pulse rounded-full" />)}
                        </div>
                    ) : aiSuggestions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {aiSuggestions
                                .filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map((name, i) => (
                                <button
                                    key={i}
                                    onClick={() => onResearch(name)}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 group"
                                >
                                    {name}
                                    <FiArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 text-center">
                            <p className="text-sm text-amber-200/60 mb-4">Discover rare or alternative sources of {nutrientInfo?.label} curated by AI.</p>
                            <button
                                onClick={handleAiSuggest}
                                className="btn-modern !bg-amber-500 !text-black !py-3 !px-8 text-xs font-black uppercase tracking-[0.2em]"
                            >
                                Get AI Insights
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
