import { useEffect, useMemo, useState } from 'react';
import { FiX, FiHelpCircle, FiClock, FiLayers, FiCheck, FiShuffle, FiPlus } from 'react-icons/fi';
import { Dices } from 'lucide-react';
import { usePlanner } from './PlannerContext';
import { formatShortDate } from '../../lib/dateUtils';
import { MEALS } from './types';
import { fetchQuizCandidates } from './dataLayer';
import { QUIZ_CARB_OPTIONS, TIME_QUICK_OPTIONS, TimeRange, isFullTimeRange, getScaleNote, weekCarbCounts, shuffleMatches, filterRecipes, DEFAULT_ANSWERS, recipeMatchesPlannerSlot } from '../../lib/recipeQuiz';

type StepId = 'meal' | 'time' | 'carb' | 'results';

const CARB_LABELS: Record<string, string> = {
    'Rice': 'Rice',
    'Bread/Wraps': 'Bread & Wraps',
    'Pasta/Noodles': 'Pasta & Noodles',
    'Potato': 'Potato',
    'Quinoa': 'Quinoa',
    'None/Other': 'No carb'
};

interface QuizCandidate {
    _id: string;
    name: string;
    image?: string;
    genre?: string;
    carbType?: string;
    time?: string;
    priceCategory?: string;
    timesCooked?: number;
    servings?: number;
    nutrientDelta?: { key: string; label: string; pct: number }[];
    impact: number;
}

interface CandidatesResponse {
    success: boolean;
    message?: string;
    dayCoverage?: { key: string; label: string; unit: string; pct: number; value: number; target: number }[];
    weekCarbCounts?: Record<string, number>;
    candidates?: QuizCandidate[];
}

// A slot is "left" when nothing sits in it — leftover blocks count as filled
// (that's food already cooked, waiting to be eaten).
export default function DayQuizModal() {
    const {
        quizDay,
        closeDayQuiz,
        plan,
        allRecipes,
        addQuizRecipe
    } = usePlanner();

    const [step, setStep] = useState<StepId>('meal');
    const [chosenMeal, setChosenMeal] = useState<string | null>(null);
    const [time, setTime] = useState<TimeRange | null>(null);
    const [carbType, setCarbType] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CandidatesResponse | null>(null);

    const [order, setOrder] = useState<QuizCandidate[]>([]);
    const [index, setIndex] = useState(0);
    const [addedName, setAddedName] = useState<string | null>(null);

    // Fresh state every time the quiz is opened — closing mid-quiz throws away
    // all progress instead of resuming where the user left off.
    useEffect(() => {
        if (quizDay) {
            setStep('meal');
            setChosenMeal(null);
            setTime(null);
            setCarbType(null);
            setLoading(false);
            setError(null);
            setData(null);
            setOrder([]);
            setIndex(0);
            setAddedName(null);
        }
    }, [quizDay]);

    const emptySlots = useMemo(() => {
        if (!quizDay || !plan) return [];
        return MEALS.filter(m => !plan.plannedRecipes.some(r => r.day === quizDay && r.mealType === m));
    }, [quizDay, plan]);

    // Client-side candidate pool: hidden recipes and anything already in the
    // plan/pantry are out — mirrors the server's quizCandidates filtering so
    // option gating matches what a run would actually return.
    const quizPool = useMemo(() => {
        const inPlanIds = new Set(
            [...(plan?.plannedRecipes || []), ...(plan?.everydayItems || [])]
                .map(r => String(r.recipe_id))
                .filter(Boolean)
        );
        return allRecipes.filter(r => !r.hidden && !inPlanIds.has(String(r._id)));
    }, [allRecipes, plan?.plannedRecipes, plan?.everydayItems]);

    const matchCount = (slot: string | null, timeR: TimeRange | null, carb: string | null): number => {
        return filterRecipes(quizPool, {
            ...DEFAULT_ANSWERS,
            time: timeR ? { min: Math.max(0, timeR.min), max: Math.max(0, timeR.max) } : null,
            carbType: carb
        }).filter(r => recipeMatchesPlannerSlot(r, slot)).length;
    };

    const carbCounts = useMemo(
        () => weekCarbCounts(plan?.plannedRecipes || []),
        [plan?.plannedRecipes]
    );

    const activeCarbOptions = QUIZ_CARB_OPTIONS;

    const current = order.length > 0 ? order[Math.min(index, order.length - 1)] : null;
    const scaleNote = current && plan
        ? getScaleNote(plan.defaultServings, current.servings ?? null)
        : null;

    const resetResults = () => {
        setData(null);
        setOrder([]);
        setIndex(0);
        setAddedName(null);
        setError(null);
    };

    const back = () => {
        if (addedName) return;
        if (step === 'results') { setStep('carb'); resetResults(); }
        else if (step === 'carb') setStep('time');
        else if (step === 'time') setStep(emptySlots.length > 1 ? 'meal' : 'carb');
        else if (step === 'meal') closeDayQuiz();
    };

    // No ask about priority — matches always come outlook-ranked so the day's
    // coverage gaps lead the ordering by default.
    const runQuiz = async (carbChoice: string | null) => {
        if (!quizDay || !chosenMeal) return;
        setLoading(true);
        setError(null);
        try {
            const result = await fetchQuizCandidates(plan, quizDay, {
                mealType: chosenMeal,
                people: null,
                time,
                novelty: null,
                price: null,
                carbType: carbChoice,
                priority: 'outlook'
            });
            if (!result.success) {
                setError(result.message || 'Failed to find matches');
                setLoading(false);
                return;
            }
            setData(result);
            const matches: QuizCandidate[] = result.candidates || [];
            setOrder(matches);
            setIndex(0);
            setStep('results');
        } catch (err) {
            console.error(err);
            setError('Failed to find matches');
        } finally {
            setLoading(false);
        }
    };

    const nextMatch = () => {
        if (order.length < 2) return;
        if (index + 1 < order.length) {
            setIndex(index + 1);
        } else {
            const reshuffled = shuffleMatches(order);
            if (reshuffled[0]?._id === current?._id) {
                const last = reshuffled.pop()!;
                reshuffled.unshift(last);
            }
            setOrder(reshuffled);
            setIndex(0);
        }
    };

    const commit = (candidate: QuizCandidate) => {
        if (!quizDay || !chosenMeal) return;
        const recipe = allRecipes.find(r => r._id === candidate._id);
        if (!recipe) return;
        setAddedName(recipe.name);
        addQuizRecipe(recipe, quizDay, chosenMeal);
    };

    const feelingLucky = () => {
        if (order.length === 0) return;
        const pick = order[Math.floor(Math.random() * order.length)];
        commit(pick);
    };

    if (!quizDay) return null;

    const stepOrder: StepId[] = emptySlots.length > 1
        ? ['meal', 'time', 'carb']
        : ['time', 'carb'];
    const stepIndexNo = stepOrder.indexOf(step as StepId);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-black tracking-widest uppercase flex items-center gap-2">
                        <FiHelpCircle className="text-blue-400" /> Day Quiz
                        <span className="text-sm font-bold text-muted-foreground normal-case tracking-normal">{formatShortDate(quizDay)}</span>
                    </h2>
                    <button onClick={closeDayQuiz} className="p-2 text-muted-foreground hover:text-white transition-colors">
                        <FiX size={20} />
                    </button>
                </div>

                {/* Step dots */}
                {!loading && emptySlots.length > 1 && (
                    <div className="flex items-center justify-center gap-1.5 py-2 border-b border-white/5">
                        {stepOrder.map((s, i) => (
                            <span
                                key={s}
                                className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-6 bg-blue-400' : i < stepIndexNo ? 'w-1.5 bg-blue-400/50' : 'w-1.5 bg-white/10'}`}
                            />
                        ))}
                    </div>
                )}

                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                    {error && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-bold">{error}</div>
                    )}

                    {/* Step 1: which meal to fill (only options with matches) */}
                    {step === 'meal' && (
                        <section className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Which meal do we fill?</p>
                            {emptySlots.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted-foreground font-bold">
                                    Every slot on this day is already filled — what a plan!
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        {emptySlots.map(m => {
                                            const count = matchCount(m, null, null);
                                            const disabled = count === 0;
                                            return (
                                                <button
                                                    key={m}
                                                    disabled={disabled}
                                                    onClick={() => { setChosenMeal(m); setStep('time'); }}
                                                    className={`p-4 rounded-xl border text-sm font-black uppercase tracking-wider transition-all ${disabled
                                                        ? 'opacity-30 border-transparent bg-transparent text-muted-foreground/40 cursor-not-allowed'
                                                        : 'border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-400/50 text-white shadow-sm'}`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span>{m}</span>
                                                        <span className={`text-[9px] font-bold lowercase tracking-normal px-1.5 py-0.5 rounded-full ${disabled ? 'text-muted-foreground/40' : 'bg-blue-500/20 text-blue-300'}`}>
                                                            {disabled ? '—' : `${count}`}
                                                        </span>
                                                    </div>
                                                    <div className={`text-[9px] font-bold normal-case tracking-normal mt-1 text-right ${disabled ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                                                        {disabled ? 'None' : `match${count === 1 ? '' : 'es'}`}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {emptySlots.every(m => matchCount(m, null, null) === 0) && (
                                        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted-foreground font-bold">
                                            Nothing in your library fits this day — add recipes or extend the plan range.
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    )}

                    {/* Step 2: time */}
                    {step === 'time' && (
                        <section className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
                                <FiClock size={12} /> How long do you want to spend?
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {TIME_QUICK_OPTIONS.map(o => {
                                    const active = !!time && time.min === o.range.min && time.max === o.range.max;
                                    const count = matchCount(chosenMeal, o.range, null);
                                    const disabled = count === 0;
                                    return (
                                        <button
                                            key={o.label}
                                            disabled={disabled}
                                            onClick={() => { setTime(active ? null : o.range); setStep('carb'); }}
                                            className={`py-3 px-3 rounded-xl border text-xs font-black transition-all ${disabled
                                                ? 'opacity-30 border-transparent bg-transparent text-muted-foreground/40 cursor-not-allowed'
                                                : active
                                                    ? 'bg-blue-500/25 text-blue-200 border-blue-500/50'
                                                    : 'bg-white/[0.04] text-white border-white/10 hover:border-blue-400/50 hover:bg-blue-500/10'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span>{o.label}</span>
                                                <span className={`text-[9px] font-bold normal-case tracking-normal px-1.5 py-0.5 rounded-full ${disabled ? 'text-muted-foreground/40' : 'bg-blue-500/20 text-blue-300'}`}>
                                                    {disabled ? '—' : count}
                                                </span>
                                            </div>
                                            <span className={`block text-[9px] font-bold normal-case tracking-normal mt-0.5 text-right ${disabled ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                                                {disabled ? 'None' : `match${count === 1 ? '' : 'es'}`}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            {matchCount(chosenMeal, null, null) > 0 && (
                                <button
                                    onClick={() => { setTime(null); setStep('carb'); }}
                                    className="w-full rounded-xl border border-dashed border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/15 px-3 py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300/80 hover:text-blue-200 transition-colors"
                                >
                                    Any length works
                                    <span className="text-[9px] font-bold lowercase tracking-normal px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200">
                                        {matchCount(chosenMeal, null, null)} match{matchCount(chosenMeal, null, null) === 1 ? '' : 'es'}
                                    </span>
                                </button>
                            )}
                        </section>
                    )}

                    {/* Step 3: carb base, annotated with the week's variety */}
                    {step === 'carb' && (
                        <section className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
                                <FiLayers size={12} /> Pick a carb base
                            </p>
                            <p className="text-[10px] text-muted-foreground font-bold leading-tight">
                                Counts show how many blocks this week already use each base — spread it out or piggyback the batch-cook.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {activeCarbOptions.map(c => {
                                    const used = carbCounts[c] || 0;
                                    const count = matchCount(chosenMeal, time, c);
                                    const disabled = count === 0;
                                    return (
                                        <button
                                            key={c}
                                            disabled={disabled}
                                            onClick={() => { setCarbType(c); runQuiz(c); }}
                                            className={`relative p-3 rounded-xl border text-left transition-all ${disabled
                                                ? 'opacity-30 border-transparent bg-transparent cursor-not-allowed text-muted-foreground/40'
                                                : carbType === c
                                                    ? 'bg-blue-500/25 text-blue-200 border-blue-500/50'
                                                    : 'bg-white/[0.04] text-white border-white/10 hover:border-blue-400/50 hover:bg-blue-500/10'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-xs font-black leading-tight">{CARB_LABELS[c] || c}</div>
                                                <span className={`text-[9px] font-bold normal-case tracking-normal px-1.5 py-0.5 rounded-full shrink-0 ${disabled ? 'text-muted-foreground/40' : 'bg-blue-500/20 text-blue-300'}`}>
                                                    {disabled ? '—' : count}
                                                </span>
                                            </div>
                                            <div className="text-[9px] font-bold uppercase tracking-wider mt-1">
                                                {disabled ? (
                                                    <span className="text-muted-foreground/40">No matches</span>
                                                ) : used === 0 ? (
                                                    <span className="text-emerald-400">Fresh this week · adds variety</span>
                                                ) : used >= 3 ? (
                                                    <span className="text-amber-400">Already ×{used} this week</span>
                                                ) : (
                                                    <span className="text-muted-foreground">×{used} this week</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            {matchCount(chosenMeal, time, null) > 0 && (
                                <button
                                    onClick={() => { setCarbType(null); runQuiz(null); }}
                                    className="w-full rounded-xl border border-dashed border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/15 px-3 py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300/80 hover:text-blue-200 transition-colors"
                                >
                                    Any carb works
                                    <span className="text-[9px] font-bold lowercase tracking-normal px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200">
                                        {matchCount(chosenMeal, time, null)} match{matchCount(chosenMeal, time, null) === 1 ? '' : 'es'}
                                    </span>
                                </button>
                            )}
                        </section>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Finding today&apos;s matches…</p>
                        </div>
                    )}

                    {/* Results */}
                    {step === 'results' && !loading && data && (
                        <section className="space-y-3">
                            {/* Chosen-answer chips */}
                            <div className="flex flex-wrap items-center gap-2">
                                {chosenMeal && (
                                    <button
                                        onClick={() => { setStep('meal'); resetResults(); }}
                                        className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-500/30 flex items-center gap-1"
                                    >
                                        {chosenMeal} <span className="text-blue-400/60">×</span>
                                    </button>
                                )}
                                {time && (
                                    <button
                                        onClick={() => { setStep('time'); resetResults(); }}
                                        className="px-3 py-1 rounded-full bg-white/5 text-muted-foreground text-[10px] font-bold"
                                    >
                                        {isFullTimeRange(time) ? 'Any length' : `${time.min}–${time.max} min`} ×
                                    </button>
                                )}
                                {carbType && (
                                    <button
                                        onClick={() => { setStep('carb'); resetResults(); }}
                                        className="px-3 py-1 rounded-full bg-white/5 text-muted-foreground text-[10px] font-bold"
                                    >
                                        {CARB_LABELS[carbType] || carbType} ×
                                    </button>
                                )}
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    {order.length} match{order.length === 1 ? '' : 'es'} · outlook-ranked
                                </span>
                            </div>

                            {order.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                                    <p className="font-black text-sm">No matches</p>
                                    <p className="text-xs text-muted-foreground mt-1">Try relaxing a step above.</p>
                                </div>
                            ) : current && current._id !== addedName ? (
                                <>
                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                        <div className="flex items-start gap-3">
                                            {current.image && (
                                                <img src={current.image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-black leading-tight">{current.name}</div>
                                                <div className="flex flex-wrap gap-x-2 mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                                    {current.time && <span>{current.time}</span>}
                                                    {current.genre && <span>{current.genre}</span>}
                                                    {current.carbType && <span>{current.carbType}</span>}
                                                    {(current.timesCooked || 0) > 0 && <span>Cooked ×{current.timesCooked}</span>}
                                                </div>
                                                {scaleNote && (
                                                    <div className="text-[10px] font-bold text-muted-foreground mt-1">{scaleNote}</div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => commit(current)}
                                                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider transition-colors"
                                            >
                                                <FiPlus size={12} /> Add
                                            </button>
                                        </div>
                                        {(current.nutrientDelta || []).length > 0 && (
                                            <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap gap-x-2 gap-y-1">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Boosts:</span>
                                                {(current.nutrientDelta || []).slice(0, 5).map(d => (
                                                    <span key={d.key} className="text-[9px] font-bold text-muted-foreground">
                                                        {d.label} <span className="text-emerald-400">+{Math.round(d.pct)}%</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        {Math.min(index + 1, order.length)} of {order.length}
                                    </div>

                                    {order.length >= 2 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={nextMatch}
                                                className="flex items-center justify-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white py-3 transition-colors"
                                            >
                                                <FiShuffle size={13} /> Shuffle match
                                            </button>
                                            <button
                                                onClick={feelingLucky}
                                                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-[10px] font-black uppercase tracking-widest text-blue-300 py-3 transition-colors"
                                            >
                                                <Dices size={14} /> I&apos;m feeling lucky                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => commit(current)}
                                            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest text-emerald-300 py-3 transition-colors"
                                        >
                                            <FiPlus size={13} /> Add to {chosenMeal}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-6 text-center">
                                    <FiCheck size={24} className="text-emerald-400" />
                                    <p className="text-sm font-black">{addedName} added to {chosenMeal}</p>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Footer: back */}
                <div className="p-3 border-t border-white/10 flex items-center justify-between">
                        <button
                            onClick={back}
                            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
                        >
                            ← {step === 'meal' ? 'Close' : 'Back'}
                        </button>
                    {(step === 'time' || step === 'carb') && !loading && (
                        <span className="text-[10px] font-bold text-muted-foreground">
                            {chosenMeal ? `Filling ${chosenMeal}` : ''}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
