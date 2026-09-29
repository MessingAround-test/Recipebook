import { useEffect, useState } from 'react'
import Router from 'next/router'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui/button'
import { FEATURES, needsOnboarding, resolveFeatures } from '../lib/features'
import { useUser } from '../lib/UserContext'
import { Check, X, ChevronLeft, Sparkles } from 'lucide-react'

export default function Welcome() {
    const { user, ready, isAuthed, refresh } = useUser()
    const [answers, setAnswers] = useState<Record<string, boolean>>({})
    const [step, setStep] = useState(0)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!ready) return
        if (!isAuthed) {
            Router.replace('/login')
            return
        }
        if (user && !needsOnboarding(user)) Router.replace('/')
    }, [ready, isAuthed, user])

    // Pre-fill with any features already granted (e.g. by an admin).
    useEffect(() => {
        if (user) setAnswers(resolveFeatures(user))
    }, [user])

    const total = FEATURES.length
    const isSummary = step >= total
    const current = FEATURES[step]
    const enabledCount = FEATURES.filter(f => answers[f.key] === true).length

    const answer = (value: boolean) => {
        if (!current) return
        setAnswers(prev => ({ ...prev, [current.key]: value }))
        setStep(s => Math.min(s + 1, total))
    }

    const save = async () => {
        const token = localStorage.getItem('Token')
        if (!token || saving) return
        setSaving(true)
        setError('')
        try {
            const features: Record<string, boolean> = {}
            FEATURES.forEach(f => { features[f.key] = answers[f.key] === true })

            const res = await fetch('/api/UserDetails', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token },
                body: JSON.stringify({
                    features,
                    features_onboarded_at: new Date().toISOString(),
                })
            })
            const data = await res.json()
            if (data.success === false || data.success === undefined) {
                setError(typeof data.message === 'string' ? data.message : 'Failed to save your choices')
                return
            }
            await refresh()
            Router.replace('/')
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    if (!ready || !isAuthed || !needsOnboarding(user)) return null

    return (
        <AuthShell
            title={isSummary ? "You're all set" : "Make it yours"}
            subtitle={isSummary
                ? 'Here is what will be switched on for you.'
                : 'A few quick questions about what you want to use.'}
        >
            {/* Progress */}
            <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    <span>{isSummary ? 'Summary' : `Question ${step + 1} of ${total}`}</span>
                    <span>{enabledCount} on</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${((isSummary ? total : step) / total) * 100}%` }}
                    />
                </div>
            </div>

            {!isSummary ? (
                <div>
                    <div className="rounded-2xl border border-border/40 bg-muted/20 p-5 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                            <Sparkles size={22} />
                        </div>
                        <h2 className="text-lg font-black tracking-tight text-foreground">{current.label}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => answer(true)}
                            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black uppercase tracking-widest text-black shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 active:scale-[0.98]"
                        >
                            <Check size={18} /> Yes
                        </button>
                        <button
                            type="button"
                            onClick={() => answer(false)}
                            className="flex h-14 items-center justify-center gap-2 rounded-xl border border-border/60 text-sm font-black uppercase tracking-widest text-muted-foreground transition-all hover:bg-white/5 active:scale-[0.98]"
                        >
                            <X size={18} /> No
                        </button>
                    </div>

                    {step > 0 && (
                        <button
                            type="button"
                            onClick={() => setStep(s => Math.max(0, s - 1))}
                            className="mt-4 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ChevronLeft size={14} /> Back
                        </button>
                    )}
                </div>
            ) : (
                <div>
                    <div className="space-y-2">
                        {FEATURES.map((feature) => {
                            const on = answers[feature.key] === true
                            return (
                                <div
                                    key={feature.key}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3.5 py-3"
                                >
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-foreground">{feature.label}</span>
                                    </span>
                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
                                        on ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-muted-foreground'
                                    }`}>
                                        {on ? 'Yes' : 'No'}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    <p className="mt-4 text-center text-xs text-muted-foreground">
                        You can change any of these later in Settings.
                    </p>

                    {error && (
                        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>
                    )}

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Button
                            type="button"
                            onClick={save}
                            disabled={saving}
                            className="h-12 flex-1 bg-emerald-500 text-xs font-black uppercase tracking-[0.2em] text-black hover:bg-emerald-400 disabled:opacity-60"
                        >
                            {saving ? 'Saving…' : 'Get started'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-12"
                            onClick={() => setStep(total - 1)}
                            disabled={saving}
                        >
                            Back
                        </Button>
                    </div>
                </div>
            )}
        </AuthShell>
    )
}
