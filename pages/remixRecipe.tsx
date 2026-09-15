import { useEffect, useRef, useState } from 'react'
import Router from 'next/router'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { useAuthGuard } from '../lib/useAuthGuard'
import { Check, Loader2, ArrowLeft, Sparkles, ChevronRight, ListChecks, AlertCircle } from 'lucide-react'
import { criterionLabel } from '../lib/dishLists/criteria'

interface RemixDraft {
    name?: string
    notes?: string
    criteria?: string[]
    recipe?: any
    context?: { listId?: string; itemId?: string; listName?: string; loc?: string }
}

const STEPS = ['Base recipe', 'Remix & review', 'Finish']

export default function RemixRecipe() {
    const isAuthed = useAuthGuard()
    const token = () => localStorage.getItem('Token') || ''

    const [draft, setDraft] = useState<RemixDraft | null>(null)
    const [step, setStep] = useState(1)
    const [baseRecipe, setBaseRecipe] = useState<any>(null)
    const [baseReady, setBaseReady] = useState(false)
    const [recipe, setRecipe] = useState<any>(null)
    const [changes, setChanges] = useState<any[]>([])
    const [notes, setNotes] = useState('')
    const [selected, setSelected] = useState<Record<number, string>>({})
    // Manual substitutes that haven't been re-remixed yet. The chosen
    // ingredient must be folded into the steps, so we block Finish until the
    // user re-runs the remix.
    const [pendingSubs, setPendingSubs] = useState<Record<number, string>>({})
    // Human-readable running state shown while a generate/remix is in flight.
    const [busyMsg, setBusyMsg] = useState('')
    const [working, setWorking] = useState(false)
    const [remixDone, setRemixDone] = useState(false)
    const [error, setError] = useState('')
    const draftRef = useRef<RemixDraft | null>(null)
    const startedRef = useRef(false)

    useEffect(() => {
        if (!isAuthed) return
        let d: RemixDraft | null = null
        try { d = JSON.parse(sessionStorage.getItem('remixDraft') || 'null') } catch { /* ignore */ }
        if (d) {
            setDraft(d)
            draftRef.current = d
            setNotes(d.notes || '')
            // Auto-forward: generate the base, run the first remix, then land
            // on the mods step (or skip straight to finish if nothing changed).
            if (!startedRef.current) {
                startedRef.current = true
                void start()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed])

    const headers = () => ({ 'Content-Type': 'application/json', edgetoken: token() })

    const runRemix = async (recipeToRemix: any, notesOverride?: string) => {
        const d = draftRef.current
        if (!d) return null
        const useNotes = notesOverride !== undefined ? notesOverride : notes
        setError('')
        try {
            const res = await fetch('/api/Recipe/remix_recipe', {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ recipe: recipeToRemix, criteria: d.criteria || [], notes: useNotes })
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.message || 'Could not remix the recipe.')
            setRecipe(data.data.recipe)
            setChanges(data.data.changes || [])
            setSelected({})
            setPendingSubs({})
            setRemixDone(true)
            return data.data
        } catch (err: any) {
            setError(err?.message || 'Something went wrong.')
            return null
        }
    }

    const loadBase = async (): Promise<any> => {
        const d = draftRef.current
        if (!d) return null
        if (d.recipe) return d.recipe
        const res = await fetch('/api/ai/generate_recipe', {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ name: d.name })
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.message || 'Could not generate a recipe.')
        return data.data
    }

    // Generates the base and runs the first remix, keeping `working` true for
    // the whole sequence so the UI never reports "No changes needed" while the
    // remix is still in flight.
    const start = async () => {
        const d = draftRef.current
        if (!d) return
        const remixTarget = (d.criteria || []).map(criterionLabel).join(', ') || 'your diet'
        setWorking(true)
        setError('')
        try {
            setBusyMsg(d.recipe ? 'Preparing & remixing…' : 'Generating base recipe…')
            const base = await loadBase()
            setBaseRecipe(base)
            setBaseReady(true)
            setBusyMsg(`Remixing to ${remixTarget}…`)
            const result = await runRemix(base, d.notes || '')
            setBusyMsg('')
            // Skip the review step when there's genuinely nothing to remix.
            if ((result?.changes?.length || 0) === 0) setStep(3)
            else setStep(2)
        } catch (err: any) {
            setError(err?.message || 'Something went wrong.')
            setBusyMsg('')
        } finally {
            setWorking(false)
        }
    }

    // Writes (or updates) the substitution into the editable notes field as
    // "Replace {original} with {selected}." If a phrase for that original
    // already exists it is replaced; otherwise the phrase is appended. Picking
    // the original name back removes the phrase.
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const upsertSubstitutionNote = (originalName: string, name: string) => {
        setNotes(prev => {
            const o = originalName.trim()
            const n = name.trim()
            if (!o || !n) return prev
            const re = new RegExp(`Replace\\s+${escapeRegex(o)}\\s+with\\s+.+?\\.\\s*`, 'gi')
            if (o.toLowerCase() === n.toLowerCase()) {
                return prev.replace(re, '').replace(/\s+/g, ' ').trim()
            }
            const phrase = `Replace ${o} with ${n}.`
            if (re.test(prev)) {
                return prev.replace(re, phrase + ' ').replace(/\s+/g, ' ').trim()
            }
            const sep = prev.trim().length ? (prev.trim().endsWith('.') ? ' ' : '. ') : ''
            return (prev.trim() + sep + phrase).replace(/\s+/g, ' ').trim()
        })
    }

    const applySubstitute = (index: number, originalName: string, name: string) => {
        setSelected(prev => ({ ...prev, [index]: name }))
        const currentName = recipe?.ingredients?.[index]?.Name || ''
        const differs = name.trim().toLowerCase() !== currentName.trim().toLowerCase()
        setPendingSubs(prev => {
            const next = { ...prev }
            if (differs) next[index] = name
            else delete next[index]
            return next
        })
        upsertSubstitutionNote(originalName, name)
        setRecipe(prev => {
            if (!prev || !Array.isArray(prev.ingredients)) return prev
            return {
                ...prev,
                ingredients: prev.ingredients.map((ing: any, i: number) => {
                    if (i !== index) return ing
                    const d = name.trim().toLowerCase() !== originalName.trim().toLowerCase()
                    return { ...ing, Name: name, Note: d ? `${name}, for ${originalName}` : (ing.Note || '') }
                })
            }
        })
    }

    // Difference between the current recipe and the ORIGINAL base recipe, so
    // each pass can be reviewed against the base (not just the prior pass).
    // `isLastPass` marks changes introduced/modified in the most recent remix.
    const baseDiffs = (() => {
        if (!baseRecipe || !recipe) return [] as any[]
        const out: any[] = []
        const baseIng: any[] = baseRecipe.ingredients || []
        const curIng: any[] = recipe.ingredients || []
        baseIng.forEach((bi, i) => {
            const ci = curIng[i]
            if (!ci) return
            if ((bi.Name || '') !== (ci.Name || '') || (bi.Note || '') !== (ci.Note || '')) {
                const lc = (changes || []).find(c => c.kind === 'ingredient' && c.index === i)
                out.push({
                    kind: 'ingredient',
                    index: i,
                    originalName: bi.Name || '',
                    newName: ci.Name || '',
                    newNote: ci.Note || '',
                    reason: lc?.reason || '',
                    alternatives: lc?.alternatives && lc.alternatives.length ? lc.alternatives : [ci.Name || ''],
                    isLastPass: !!lc
                })
            }
        })
        const baseIns: any[] = baseRecipe.instructions || []
        const curIns: any[] = recipe.instructions || []
        baseIns.forEach((bs, i) => {
            const cs = curIns[i]
            if (!cs) return
            if ((bs.Text || '') !== (cs.Text || '')) {
                const lc = (changes || []).find(c => c.kind === 'step' && c.index === i)
                out.push({ kind: 'step', index: i, originalText: bs.Text || '', newText: cs.Text || '', isLastPass: !!lc })
            }
        })
        return out
    })()

    const reRun = () => runRemix(recipe, notes)
    const startOver = async () => { setNotes(''); setPendingSubs({}); await runRemix(baseRecipe, '') }

    const finish = () => {
        if (!recipe) return
        try { sessionStorage.setItem('dishGeneratedRecipe', JSON.stringify(recipe)) } catch { /* ignore */ }
        const ctx = draftRef.current?.context || {}
        const params = new URLSearchParams({ genImport: '1' })
        if (ctx.listId) params.set('listId', ctx.listId)
        if (ctx.itemId) params.set('itemId', ctx.itemId)
        if (ctx.listName) params.set('listName', ctx.listName)
        if (ctx.loc) params.set('loc', ctx.loc)
        Router.push(`/createRecipe?${params.toString()}`)
    }

    if (!isAuthed) return null

    if (!draft) {
        return (
            <Layout title="Remix recipe" hideMobileToolbar>
                <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
                    <p className="text-sm font-semibold">No recipe to remix.</p>
                    <Button variant="secondary" className="mt-4" onClick={() => Router.back()}>Go back</Button>
                </div>
            </Layout>
        )
    }

    const dietLabels = (draft.criteria || []).map(criterionLabel)
    const canNextFrom1 = baseReady
    const pendingCount = Object.keys(pendingSubs).length
    const canNextFrom2 = remixDone && pendingCount === 0

    return (
        <Layout title="Remix recipe" description="Adapt a recipe step by step" hideMobileToolbar>
            <div className="mx-auto w-full max-w-3xl px-4 pb-24">
                <div className="flex items-center gap-3 py-3">
                    <button onClick={() => Router.back()} className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Remix recipe</p>
                        <h1 className="text-xl font-black tracking-tight truncate">{draft.recipe ? 'Adapt this recipe' : draft.name}</h1>
                    </div>
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-2 mb-5">
                    {STEPS.map((label, i) => {
                        const n = i + 1
                        const done = n < step || (n === 1 && baseReady) || (n === 2 && remixDone)
                        const active = n === step
                        return (
                            <div key={label} className="flex-1 flex items-center gap-2">
                                <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${done ? 'bg-emerald-500 text-white' : active ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'}`}>
                                    {done ? <Check size={14} /> : n}
                                </span>
                                <span className={`text-xs font-bold ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                                {i < STEPS.length - 1 && <span className="flex-1 h-px bg-border" />}
                            </div>
                        )
                    })}
                </div>

                {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}

                {/* Step 1 — base recipe (runs automatically on entry) */}
                {step === 1 && (
                    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
                        <p className="text-sm text-muted-foreground">
                            {draft.recipe
                                ? 'We’re adapting the recipe you chose to your dietary needs.'
                                : `We’re generating a traditional, authentic base recipe for “${draft.name}”, then remixing it.`}
                        </p>

                        {dietLabels.length > 0 && (
                            <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                                <ListChecks size={14} />
                                <span>Remixing to:</span>
                                {dietLabels.map(l => (
                                    <span key={l} className="px-2 py-0.5 rounded-full bg-secondary border border-border">{l}</span>
                                ))}
                            </div>
                        )}

                        {!baseReady ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                <Loader2 className="animate-spin" size={16} />
                                {busyMsg || (draft.recipe ? 'Preparing & remixing…' : 'Generating base recipe & remixing…')}
                            </div>
                        ) : working ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                <Loader2 className="animate-spin" size={16} />
                                {busyMsg || 'Remixing…'}
                            </div>
                        ) : (
                            <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                                <div className="flex items-center gap-2 text-emerald-600"><Check size={14} /> Base recipe ready{recipe?.name ? `: ${recipe.name}` : ''}</div>
                                <div className="flex items-center gap-2 text-emerald-600"><Check size={14} /> {baseDiffs.length > 0 ? `Remixed — ${baseDiffs.length} change${baseDiffs.length > 1 ? 's' : ''} from the base` : 'No changes needed'}</div>
                            </div>
                        )}

                        {error && (
                            <div className="space-y-2">
                                <p className="text-xs text-rose-500">{error}</p>
                                <Button onClick={() => { startedRef.current = false; void start() }} disabled={working}>Try again</Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2 — review & adjust */}
                {step === 2 && (
                    <div className="space-y-4">
                        {working && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-2xl border border-border bg-secondary/40 p-3">
                                <Loader2 className="animate-spin" size={16} />
                                {busyMsg || 'Updating recipe…'}
                            </div>
                        )}
                        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
                            <p className="text-sm font-bold">What changed from the base — review &amp; adjust:</p>
                            <p className="text-[11px] text-muted-foreground -mt-1">Changes from the most recent pass are highlighted; all differences are shown against the original base recipe.</p>
                            {baseDiffs.length === 0 && (
                                <p className="text-xs text-muted-foreground">No ingredients or steps needed changing for the selected diet. You can still add notes below to refine it.</p>
                            )}
                            {baseDiffs.map((ch) => {
                                const wrap = ch.isLastPass
                                    ? 'rounded-xl border border-amber-400 bg-amber-400/10'
                                    : 'rounded-xl border border-border bg-secondary/30'
                                return ch.kind === 'ingredient' ? (
                                    <div key={`ing-${ch.index}`} className={wrap + ' p-3'}>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ingredient</p>
                                            {ch.isLastPass && <span className="text-[10px] font-bold text-amber-500">Changed this pass</span>}
                                        </div>
                                        <p className="text-sm"><span className="line-through text-muted-foreground">{ch.originalName}</span> <span className="mx-1">→</span> <span className="font-bold">{selected[ch.index] ?? ch.newName}</span></p>
                                        {ch.reason && <p className="text-[11px] text-muted-foreground mt-0.5">{ch.reason}</p>}
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {(ch.alternatives || []).map((alt: string) => {
                                                const sel = (selected[ch.index] ?? ch.newName) === alt
                                                return (
                                                    <button key={alt} type="button" onClick={() => applySubstitute(ch.index, ch.originalName, alt)}
                                                        className={`px-2.5 py-1 rounded-full text-xs border ${sel ? 'bg-accent text-accent-foreground border-accent' : 'bg-background border-border hover:border-accent'}`}>
                                                        {alt}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <input
                                            value={selected[ch.index] ?? ''}
                                            onChange={e => applySubstitute(ch.index, ch.originalName, e.target.value)}
                                            placeholder="Or type your own substitute…"
                                            className="mt-2 w-full h-9 rounded-lg bg-background border border-border px-2 text-xs focus:outline-none focus:border-accent"
                                        />
                                    </div>
                                ) : (
                                    <div key={`step-${ch.index}`} className={wrap + ' p-3'}>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Step {ch.index + 1}</p>
                                            {ch.isLastPass && <span className="text-[10px] font-bold text-amber-500">Changed this pass</span>}
                                        </div>
                                        {ch.originalText && <p className="text-[11px] text-muted-foreground line-through">{ch.originalText}</p>}
                                        <p className="text-sm mt-0.5">{ch.newText}</p>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-2">
                            <p className="text-xs font-bold">Anything else to adjust?</p>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="e.g. “also make it nut-free”, “use smoked paprika”, “simplify step 3”…"
                                className="w-full min-h-[70px] rounded-lg bg-secondary border border-border p-2 text-xs resize-y focus:outline-none focus:border-accent"
                            />
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={startOver} disabled={working}>Reset</Button>
                                <Button variant="secondary" onClick={reRun} disabled={working} className="flex-1">
                                    {working ? <><Loader2 className="animate-spin" size={14} /> Re-running…</> : 'Re-run remix with these notes'}
                                </Button>
                            </div>
                        </div>

                        {pendingCount > 0 && (
                            <div className="rounded-2xl border border-amber-400 bg-amber-400/10 p-3 flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5"><AlertCircle size={15} /></span>
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    You picked a substitute that isn&apos;t in the steps yet. Re-run the remix below so the chosen ingredient is folded into the method before you finish.
                                </p>
                            </div>
                        )}

                        <div className="flex justify-between">
                            <Button variant="secondary" onClick={() => setStep(1)} disabled={working}>Back</Button>
                            <Button onClick={() => setStep(3)} disabled={working || !canNextFrom2} title={pendingCount > 0 ? 'Re-run the remix to apply your substitute to the steps first' : undefined}>
                                Finish <ChevronRight size={14} />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3 — finish */}
                {step === 3 && (
                    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
                        <p className="text-sm font-bold">Ready to save</p>
                        <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">Name:</span> {recipe?.name || draft.name}</p>
                            <p><span className="text-muted-foreground">Ingredients:</span> {recipe?.ingredients?.length || 0}</p>
                            <p><span className="text-muted-foreground">Steps:</span> {recipe?.instructions?.length || 0}</p>
                            {dietLabels.length > 0 && <p><span className="text-muted-foreground">Remixed to:</span> {dietLabels.join(', ')}</p>}
                        </div>
                        <div className="flex justify-between">
                            <Button variant="secondary" onClick={() => setStep(2)} disabled={working}>Back</Button>
                            <Button onClick={finish} disabled={working}>
                                Apply &amp; continue <ChevronRight size={14} />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
