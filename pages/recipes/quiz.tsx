import { useEffect, useMemo, useState } from 'react'
import Router from 'next/router'
import React from 'react'
import { Layout } from '../../components/Layout'
import ImageCard, { Recipe } from '../../components/ImageCard'
import { Button } from '../../components/ui/button'
import { useAuthGuard } from '../../lib/useAuthGuard'
import {
    QuizAnswers,
    QuizRecipe,
    DEFAULT_ANSWERS,
    QUIZ_MEAL_OPTIONS,
    QUIZ_TIME_OPTIONS,
    QUIZ_PRICE_OPTIONS,
    filterRecipes,
    sortMatches,
    getScaleNote,
    shuffleMatches
} from '../../lib/recipeQuiz'
import {
    ArrowLeft,
    CheckCircle2,
    ChefHat,
    Shuffle,
    Utensils,
    Users,
    Clock,
    Sparkles,
    History,
    DollarSign,
    X,
    Loader2,
    SearchX
} from 'lucide-react'

type StepId = 'mealType' | 'people' | 'time' | 'novelty' | 'price'

interface QuizStep {
    id: StepId
    question: string
    sub: string
    icon: React.ReactNode
}

const STEPS: QuizStep[] = [
    { id: 'mealType', question: 'What kind of meal?', sub: 'Pick what you feel like', icon: <Utensils size={16} className="text-accent" /> },
    { id: 'people', question: 'How many people?', sub: 'Matches get scaled to fit', icon: <Users size={16} className="text-accent" /> },
    { id: 'time', question: 'How long do you want to spend?', sub: 'Total effort in the kitchen', icon: <Clock size={16} className="text-accent" /> },
    { id: 'novelty', question: 'Something new or a classic?', sub: 'Fresh discovery or a trusted favourite', icon: <Sparkles size={16} className="text-accent" /> },
    { id: 'price', question: 'How expensive?', sub: 'Budget to premium', icon: <DollarSign size={16} className="text-accent" /> }
]

const TIME_LABELS: Record<string, string> = { short: 'Quick (< 30 min)', medium: 'Medium (30-60 min)', long: 'Slow Cook (1h+)' }
const PRICE_LABELS: Record<string, string> = { cheap: 'Budget', medium: 'Standard', expensive: 'Premium' }
const NOVELTY_LABELS: Record<string, string> = { new: 'Something new', classic: 'A classic' }
const PEOPLE_OPTIONS = [1, 2, 3, 4, 5, 6, 8]

function answerLabel(id: StepId, answers: QuizAnswers): string {
    switch (id) {
        case 'mealType': return answers.mealType || ''
        case 'people': return `${answers.people} people`
        case 'time': return answers.time ? TIME_LABELS[answers.time] : ''
        case 'novelty': return answers.novelty ? NOVELTY_LABELS[answers.novelty] : ''
        case 'price': return answers.price ? PRICE_LABELS[answers.price] : ''
    }
}

export default function RecipeQuiz() {
    const isAuthed = useAuthGuard()
    const [recipes, setRecipes] = useState<QuizRecipe[]>([])
    const [loading, setLoading] = useState(true)
    const [mode, setMode] = useState<'quiz' | 'results'>('quiz')
    const [stepIndex, setStepIndex] = useState(0)
    const [answers, setAnswers] = useState<QuizAnswers>(DEFAULT_ANSWERS)
    const [order, setOrder] = useState<QuizRecipe[]>([])
    const [index, setIndex] = useState(0)

    useEffect(() => {
        if (!isAuthed) return
        const token = localStorage.getItem('Token')
        if (!token) return
        ;(async () => {
            try {
                const res = await fetch('/api/Recipe', { headers: { edgetoken: token } })
                const data = await res.json()
                setRecipes(data.res || [])
            } finally {
                setLoading(false)
            }
        })()
    }, [isAuthed])

    const matches = useMemo(
        () => sortMatches(filterRecipes(recipes, answers), answers.novelty),
        [recipes, answers]
    )

    useEffect(() => {
        setOrder(shuffleMatches(matches))
        setIndex(0)
    }, [matches])

    const step = STEPS[stepIndex]
    const current = order.length > 0 ? order[Math.min(index, order.length - 1)] : null
    const scaleNote = current ? getScaleNote(answers.people, current.servings ?? null) : null

    const setAnswer = (id: StepId, value: string | number | null) => {
        setAnswers(prev => ({ ...prev, [id]: value }) as QuizAnswers)
        if (stepIndex < STEPS.length - 1) {
            setStepIndex(stepIndex + 1)
        } else {
            setMode('results')
        }
    }

    const nextMatch = () => {
        if (order.length < 2) return
        if (index + 1 < order.length) {
            setIndex(index + 1)
        } else {
            const reshuffled = shuffleMatches(order)
            if (reshuffled[0]._id === current?._id) {
                const last = reshuffled.pop()!
                reshuffled.unshift(last)
            }
            setOrder(reshuffled)
            setIndex(0)
        }
    }

    const clearAnswer = (id: StepId) => {
        setAnswers(prev => ({ ...prev, [id]: null }) as QuizAnswers)
    }

    if (!isAuthed) return null

    return (
        <Layout title="Recipe Quiz" description="Answer a few quick questions and find what to cook">
            <div className="relative min-h-screen pb-24 max-w-xl mx-auto">
                <header className="sticky top-0 z-40 -mx-6 sm:-mx-8 px-6 sm:px-8 py-2 bg-background/80 backdrop-blur-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => {
                                if (mode === 'results') setMode('quiz')
                                else if (stepIndex > 0) setStepIndex(stepIndex - 1)
                                else Router.push('/recipes')
                            }}
                            className="p-2 -ml-2 rounded-full hover:bg-secondary/50 transition-colors text-muted-foreground"
                            aria-label="Back"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                            <ChefHat className="text-accent" size={18} />
                            {mode === 'quiz' ? 'Quick Quiz' : 'Your Matches'}
                        </h1>
                        <div className="w-8" />
                    </div>
                    {mode === 'quiz' && (
                        <div className="flex items-center justify-center gap-1.5 py-2">
                            {STEPS.map((s, i) => (
                                <button
                                    key={s.id}
                                    onClick={() => setStepIndex(i)}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${i === stepIndex ? 'w-6 bg-accent' : i < stepIndex ? 'w-1.5 bg-accent/50' : 'w-1.5 bg-secondary'}`}
                                    aria-label={`Step ${i + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                        <Loader2 className="animate-spin text-accent" size={28} />
                        <p className="text-sm font-bold uppercase tracking-widest">Loading recipes</p>
                    </div>
                ) : mode === 'quiz' ? (
                    <div className="pt-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                {step.icon} Question {stepIndex + 1} of {STEPS.length}
                            </div>
                            <h2 className="text-2xl font-black tracking-tight">{step.question}</h2>
                            <p className="text-sm text-muted-foreground font-medium">{step.sub}</p>
                        </div>

                        {step.id === 'mealType' && (
                            <div className="grid grid-cols-2 gap-3">
                                {QUIZ_MEAL_OPTIONS.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setAnswer('mealType', m)}
                                        className={`p-4 rounded-2xl border text-sm font-bold transition-all duration-300 ${answers.mealType === m ? 'bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20' : 'bg-secondary/30 border-border/10 hover:border-accent/30'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        )}

                        {step.id === 'people' && (
                            <div className="grid grid-cols-4 gap-3">
                                {PEOPLE_OPTIONS.map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setAnswer('people', n)}
                                        className={`aspect-square rounded-2xl border flex flex-col items-center justify-center transition-all duration-300 ${answers.people === n ? 'bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20' : 'bg-secondary/30 border-border/10 hover:border-accent/30'}`}
                                    >
                                        <span className="text-xl font-black">{n}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{n === 1 ? 'person' : 'people'}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {step.id === 'time' && (
                            <div className="grid grid-cols-1 gap-3">
                                {QUIZ_TIME_OPTIONS.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setAnswer('time', t)}
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${answers.time === t ? 'bg-accent/10 border-accent ring-1 ring-accent/50' : 'bg-secondary/30 border-border/10 hover:border-accent/30'}`}
                                    >
                                        <span className="text-sm font-bold">{TIME_LABELS[t]}</span>
                                        {answers.time === t && <CheckCircle2 size={16} className="text-accent" />}
                                    </button>
                                ))}
                            </div>
                        )}

                        {step.id === 'novelty' && (
                            <div className="grid grid-cols-2 gap-3">
                                {(['new', 'classic'] as const).map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setAnswer('novelty', n)}
                                        className={`p-5 rounded-2xl border flex flex-col items-center gap-2 transition-all duration-300 ${answers.novelty === n ? 'bg-accent/10 border-accent ring-1 ring-accent/50 text-accent' : 'bg-secondary/30 border-border/10 text-muted-foreground hover:border-accent/30'}`}
                                    >
                                        {n === 'new' ? <Sparkles size={22} /> : <History size={22} />}
                                        <span className="text-sm font-bold">{NOVELTY_LABELS[n]}</span>
                                        <span className="text-[10px] font-medium opacity-70">{n === 'new' ? 'Never cooked it' : 'Cooked 3+ times'}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {step.id === 'price' && (
                            <div className="grid grid-cols-3 gap-3">
                                {QUIZ_PRICE_OPTIONS.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setAnswer('price', p)}
                                        className={`p-4 rounded-2xl border flex flex-col items-center gap-1 transition-all duration-300 ${answers.price === p ? 'bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20' : 'bg-secondary/30 border-border/10 hover:border-accent/30'}`}
                                    >
                                        <span className="text-lg font-black">{'$'.repeat(QUIZ_PRICE_OPTIONS.indexOf(p) + 1)}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{PRICE_LABELS[p]}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-col items-center gap-4">
                            <button
                                onClick={() => setAnswer(step.id, null)}
                                className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
                            >
                                Any works
                            </button>
                            <Button
                                className="w-full rounded-2xl py-6 font-black shadow-xl shadow-accent/20 h-auto text-xs uppercase tracking-[0.2em]"
                                onClick={() => setMode('results')}
                            >
                                Show matches ({matches.length})
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="pt-6 space-y-6">
                        <div className="flex flex-wrap items-center gap-2">
                            {STEPS.filter(s => (s.id === 'people' ? false : (answers as any)[s.id])).map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { setStepIndex(STEPS.indexOf(s)); setMode('quiz') }}
                                    className="px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-accent/20 transition-colors"
                                >
                                    {answerLabel(s.id, answers)}
                                    <X size={12} />
                                </button>
                            ))}
                            {STEPS.filter(s => (answers as any)[s.id]).length === 0 && (
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No filters — showing everything</span>
                            )}
                        </div>

                        {matches.length === 0 || !current ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                                <div className="p-4 rounded-full bg-secondary/50">
                                    <SearchX size={28} className="text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="font-black text-lg">No matches found</p>
                                    <p className="text-sm text-muted-foreground mt-1">Try removing a filter or picking &quot;Any works&quot; on a step.</p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="rounded-2xl font-bold h-auto py-3 px-6 border-accent/20 text-accent"
                                    onClick={() => setMode('quiz')}
                                >
                                    Edit quiz
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="animate-in fade-in zoom-in-95 duration-300">
                                    <ImageCard
                                        recipe={current as unknown as Recipe}
                                        onRedirect={() => Router.push(`/recipes/${current._id}`)}
                                        cardHeight="16rem"
                                    />
                                </div>

                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                    {scaleNote && (
                                        <span className="px-3 py-1.5 rounded-full bg-secondary/50 text-xs font-bold">
                                            {scaleNote}
                                        </span>
                                    )}
                                    {(current.timesCooked || 0) > 0 && (
                                        <span className="px-3 py-1.5 rounded-full bg-secondary/50 text-xs font-bold">
                                            Cooked {current.timesCooked}×
                                        </span>
                                    )}
                                    {current.genre && (
                                        <span className="px-3 py-1.5 rounded-full bg-secondary/50 text-xs font-bold">
                                            {current.genre}
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-col items-center gap-3">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        <span className="text-accent">{Math.min(index + 1, order.length)}</span>
                                        of {order.length} matches
                                    </div>
                                    <Button
                                        className="w-full rounded-2xl py-6 font-black shadow-xl shadow-accent/20 h-auto text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                                        onClick={nextMatch}
                                        disabled={order.length < 2}
                                    >
                                        <Shuffle size={16} />
                                        {order.length < 2 ? 'Only match' : 'Shuffle to next match'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    )
}
