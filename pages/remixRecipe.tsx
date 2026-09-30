import { useEffect, useRef, useState } from 'react'
import Router from 'next/router'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { useFeatureGuard } from '../lib/useFeatureGuard'
import { Check, Loader2, ArrowLeft, Sparkles, ChevronRight, ListChecks, AlertCircle, MessageSquareText } from 'lucide-react'
import { criterionLabel } from '../lib/dishLists/criteria'
import { applyDietaryNameTag, nextRemixName, remixSourceRef } from '../lib/recipeRemix'

interface RemixDraft {
    name?: string
    notes?: string
    // Separate copy of the source recipe's cooking reflection (feedback). It
    // travels alongside `notes` so the review step can let the user bring it
    // through (adds it to the notes) or clear it out again mid-review.
    reflection?: string
    criteria?: string[]
    recipe?: any
    context?: { listId?: string; itemId?: string; listName?: string; loc?: string; sourceUrl?: string; sourceNotes?: string; sourceRecipeId?: string }
}

const STEPS = ['Base recipe', 'Remix & review', 'Finish']

// Canonical form of an ingredient name used to decide whether two names are
// actually different (ignores case + collapsed whitespace, e.g. "firm tofu"
// and "Firm Tofu" are the same ingredient).
const canonName = (s: any) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()

const REMIX_STAGES = [
    { at: 0, text: 'Generating the traditional base recipe' },
    { at: 45, text: 'Adapting ingredients to your requirements' },
    { at: 75, text: 'Rewriting the steps to match' }
]

/** Staged progress bar shown for the whole generate + remix pass. */
function RemixProgress({ progress, label }: { progress: number; label?: string }) {
    const clamped = Math.max(4, Math.min(100, progress))
    const reached = REMIX_STAGES.reduce((acc, s, i) => (progress >= s.at ? i : acc), 0)
    const active = progress >= 100 ? REMIX_STAGES.length : reached
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Loader2 className="animate-spin text-accent" size={18} />
                <p className="text-sm font-bold">{label || 'Remixing…'}</p>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${clamped}%` }} />
            </div>
            <ul className="space-y-1.5">
                {REMIX_STAGES.map((s, i) => (
                    <li key={s.text} className={`flex items-center gap-2 text-xs ${i < active ? 'text-emerald-600' : i === active ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {i < active
                            ? <Check size={13} />
                            : i === active
                                ? <Loader2 className="animate-spin" size={13} />
                                : <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />}
                        {s.text}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default function RemixRecipe() {
    const isAuthed = useFeatureGuard('recipes')
    const token = () => localStorage.getItem('Token') || ''

    const [draft, setDraft] = useState<RemixDraft | null>(null)
    const [step, setStep] = useState(1)
    const [baseRecipe, setBaseRecipe] = useState<any>(null)
    const [baseReady, setBaseReady] = useState(false)
    const [recipe, setRecipe] = useState<any>(null)
    const [changes, setChanges] = useState<any[]>([])
    const [notes, setNotes] = useState('')
    const [selected, setSelected] = useState<Record<number, string>>({})
    // Manual substitutes that haven't been re-remixed yet. `from` is the name
    // currently used in the recipe/steps, `to` is the chosen replacement. We
    // block Finish until the user re-runs the remix so the steps get rewritten.
    const [pendingSubs, setPendingSubs] = useState<Record<number, { from: string; to: string }>>({})
    // Which ingredient rows have their "type your own" field revealed.
    const [customOpen, setCustomOpen] = useState<Record<number, boolean>>({})
    // Review list mode: by default only changed/added ingredients render;
    // the toggle reveals every ingredient in the list so untouched rows can
    // also be inspected and substituted.
    const [showAllIngredients, setShowAllIngredients] = useState(false)
    // Human-readable running state shown while a generate/remix is in flight.
    const [busyMsg, setBusyMsg] = useState('')
    const [working, setWorking] = useState(false)
    const [progress, setProgress] = useState(0)
    const [remixDone, setRemixDone] = useState(false)
    const [error, setError] = useState('')
    // False until the draft has been read from sessionStorage, so we don't flash
    // the "No recipe to remix" empty state before the auto-run starts.
    const [booted, setBooted] = useState(false)
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
        }        setBooted(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed])

    // Creep the bar forward while an AI pass is in flight so progress always
    // feels alive between the real milestones.
    useEffect(() => {
        if (!working) return
        const id = setInterval(() => {
            setProgress(p => (p < 90 ? Math.min(90, p + Math.max(1, (90 - p) * 0.08)) : p))
        }, 350)
        return () => clearInterval(id)
    }, [working])

    const headers = () => ({ 'Content-Type': 'application/json', edgetoken: token() })

    const runRemix = async (
        recipeToRemix: any,
        notesOverride?: string,
        substitutions: Array<{ index: number; from: string; to: string }> = []
    ) => {
        const d = draftRef.current
        if (!d) return null
        const useNotes = notesOverride !== undefined ? notesOverride : notes
        setError('')
        try {
            const res = await fetch('/api/Recipe/remix_recipe', {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ recipe: recipeToRemix, criteria: d.criteria || [], notes: useNotes, substitutions })
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.message || 'Could not remix the recipe.')
            setRecipe(data.data.recipe)
            setChanges(data.data.changes || [])
            setSelected({})
            setPendingSubs({})
            setCustomOpen({})
            setRemixDone(true)
            setProgress(100)
            return data.data
        } catch (err: any) {
            setError(err?.message || 'Something went wrong.')
            setProgress(0)
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
        setProgress(8)
        try {
            setBusyMsg(d.recipe ? 'Preparing & remixing…' : 'Generating base recipe…')
            const base = await loadBase()
            setBaseRecipe(base)
            setBaseReady(true)
            setProgress(50)
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

    // Records a manual substitute. We deliberately leave the recipe untouched
    // (so the ingredient and steps stay consistent for the AI) and send the swap
    // as { from, to } on the re-run. `from` is the name currently used in the
    // recipe — and referenced by the steps — so the AI knows exactly what to
    // replace when it rewrites the method.
    const applySubstitute = (index: number, name: string) => {
        setSelected(prev => ({ ...prev, [index]: name }))
        const currentName = recipe?.ingredients?.[index]?.Name || ''
        const differs = canonName(name) !== canonName(currentName)
        setPendingSubs(prev => {
            const next = { ...prev }
            if (differs && name.trim()) next[index] = { from: prev[index]?.from ?? currentName, to: name }
            else delete next[index]
            return next
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
            // Only a genuine name change counts as a substitution. Note-only or
            // case/whitespace-only differences ("firm tofu" vs "Firm Tofu",
            // "skewers" vs "skewers") are not substitutions and must not render.
            if (canonName(bi.Name) !== canonName(ci.Name)) {
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
        const cleanText = (s: any) => String(s || '').replace(/\s+/g, ' ').trim()
        // Ingredients the AI appended beyond the base list count as changes
        // too — flag them so the review step can say where each item came
        // from (carried over vs replaced vs newly added).
        const addedFrom = Math.min(baseIng.length, curIng.length)
        for (let i = addedFrom; i < curIng.length; i++) {
            const ci = curIng[i]
            const lc = (changes || []).find(c => c.kind === 'ingredient' && c.index === i)
            out.push({
                kind: 'ingredient',
                index: i,
                originalName: '',
                newName: ci?.Name || '',
                newNote: ci?.Note || '',
                reason: lc?.reason || '',
                alternatives: lc?.alternatives && lc.alternatives.length ? lc.alternatives : [],
                added: true,
                isLastPass: true
            })
        }
        const baseIns: any[] = baseRecipe.instructions || []
        const curIns: any[] = recipe.instructions || []
        baseIns.forEach((bs, i) => {
            const cs = curIns[i]
            if (!cs) return
            if (cleanText(bs.Text) !== cleanText(cs.Text)) {
                const lc = (changes || []).find(c => c.kind === 'step' && c.index === i)
                out.push({ kind: 'step', index: i, originalText: bs.Text || '', newText: cs.Text || '', isLastPass: !!lc })
            }
        })
        return out
    })()

    const ingredientDiffs = baseDiffs.filter((d: any) => d.kind === 'ingredient')
    const stepDiffs = baseDiffs.filter((d: any) => d.kind === 'step')

    const reRun = async () => {
        if (working) return
        setWorking(true)
        setProgress(12)
        setBusyMsg('Re-running the remix…')
        const substitutions = Object.entries(pendingSubs).map(([i, s]) => ({ index: Number(i), from: s.from, to: s.to }))
        try {
            await runRemix(recipe, notes, substitutions)
        } finally {
            setWorking(false)
            setBusyMsg('')
        }
    }

    const startOver = async () => {
        if (working) return
        setNotes(draft?.notes || '')
        setPendingSubs({})
        setWorking(true)
        setProgress(12)
        setBusyMsg('Resetting to the base remix…')
        try {
            await runRemix(baseRecipe, draft?.notes || '')
        } finally {
            setWorking(false)
            setBusyMsg('')
        }
    }

    // The source recipe's cooking reflection, offered on the review step. It
    // counts as "in" only when it's actually present in the current notes —
    // so the user can bring it through, clear it out again, or clear the
    // notes wholesale without losing access to the reflection text.
    const reflectionText = String(draft?.reflection || '').trim()
    const reflectionInNotes = !!reflectionText && canonName(notes).includes(canonName(reflectionText))
    const canBringReflection = !!reflectionText && !reflectionInNotes

    const bringReflectionIn = () => {
        if (reflectionInNotes || working) return
        setNotes(notes ? `${notes.replace(/\s+$/, '')}\n${reflectionText}` : reflectionText)
    }

    const clearReflectionOut = () => {
        if (!reflectionInNotes) return
        // Remove the reflection text plus any separator/newline it leaves
        // behind, then collapse the whitespace it was joined with.
        const cleaned = notes
            .replace(reflectionText, '')
            .replace(/\n\s*\n/g, '\n')
            .replace(/^[ \t]+|[ \t]+$/gm, '')
            .trim()
        setNotes(cleaned)
    }

    const finish = () => {
        if (!recipe) return
        // Only tag the saved title when the remix actually adapted the recipe.
        const labels = (draftRef.current?.criteria || []).map(criterionLabel)
        const ctx = draftRef.current?.context || {}
        // Recipe-page remixes version the name off the ORIGINAL source recipe
        // ("X" -> "X v2", "X v2" -> "X v3") even when the AI result kept the
        // name, and record the parent id in sourceUrl via the fake remix://
        // scheme so remixed recipes can be related/grouped later. Dish-list
        // remixes keep the existing dietary-tag naming.
        const sourceRecipeId = ctx.sourceRecipeId
        const versionBumped = !!sourceRecipeId && baseDiffs.length > 0
        const name = versionBumped
            ? applyDietaryNameTag(nextRemixName(draftRef.current?.name || recipe.name), labels)
            : (baseDiffs.length > 0 ? applyDietaryNameTag(recipe.name, labels) : recipe.name)
        const sourceUrl = ctx.sourceUrl || (sourceRecipeId ? remixSourceRef(sourceRecipeId) : undefined)
        try { sessionStorage.setItem('dishGeneratedRecipe', JSON.stringify({ ...recipe, name, sourceUrl, sourceNotes: ctx.sourceNotes })) } catch { /* ignore */ }
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
                <div className="mx-auto w-full max-w-3xl px-4 py-10">
                    {booted ? (
                        <div className="py-10 text-center">
                            <p className="text-sm font-semibold">No recipe to remix.</p>
                            <Button variant="secondary" className="mt-4" onClick={() => Router.back()}>Go back</Button>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                            <RemixProgress progress={progress} label="Starting the remix…" />
                        </div>
                    )}
                </div>
            </Layout>
        )
    }

    const dietLabels = (draft.criteria || []).map(criterionLabel)
    // The dietary tag is only applied once we're ready to save, and only if the
    // remix actually changed something.
    const willTagName = baseDiffs.length > 0 && dietLabels.length > 0
    // Recipe-page remixes: mirror finish() — the parent's name gets versioned.
    const willVersionName = !!draft.context?.sourceRecipeId && baseDiffs.length > 0
    const finalName = willVersionName
        ? applyDietaryNameTag(nextRemixName(draft.name || recipe?.name || 'Recipe'), dietLabels)
        : (willTagName ? applyDietaryNameTag(recipe?.name || draft.name, dietLabels) : (recipe?.name || draft.name))
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

                        {!baseReady || working ? (
                            <RemixProgress
                                progress={progress}
                                label={busyMsg || (draft.recipe ? 'Preparing & remixing…' : 'Generating base recipe & remixing…')}
                            />
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
                            <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                                <RemixProgress progress={progress} label={busyMsg || 'Updating recipe…'} />
                            </div>
                        )}
                        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm font-bold">Review changes</p>
                                {baseDiffs.length > 0 && (
                                    <span className="text-[11px] text-muted-foreground">{baseDiffs.length} change{baseDiffs.length === 1 ? '' : 's'} from the base</span>
                                )}
                            </div>

                            {baseDiffs.length === 0 ? (
                                <p className="text-xs text-muted-foreground mt-1">Nothing needed changing for this diet. Add a note below to refine it.</p>
                            ) : (
                                <div className="mt-3 space-y-4">
                                    {ingredientDiffs.length > 0 && (() => {
                                        const diffByIndex = new Map(ingredientDiffs.map((d: any) => [d.index, d]))
                                        const curIng: any[] = recipe?.ingredients || []
                                        const renderDiffCard = (ch: any) => {
                                            const selectedName = selected[ch.index] ?? ch.newName
                                            const isCustom = !!selected[ch.index] && !(ch.alternatives || []).some((a: string) => canonName(a) === canonName(selected[ch.index]))
                                            const showInput = !!customOpen[ch.index] || isCustom
                                            return (
                                                <div key={`ing-${ch.index}`} className={`rounded-xl border border-border p-3 ${ch.isLastPass ? 'border-l-2 border-l-amber-400' : ''}`}>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {ch.added ? (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Added</span>
                                                        ) : (
                                                            <p className="text-sm min-w-0">
                                                                <span className="line-through text-muted-foreground">{ch.originalName}</span>
                                                                <span className="mx-1.5 text-muted-foreground">→</span>
                                                                <span className="font-bold">{selectedName}</span>
                                                            </p>
                                                        )}
                                                        {ch.added && <p className="text-sm min-w-0 font-bold">{selectedName}</p>}
                                                        {ch.isLastPass && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Changed this pass" aria-label="Changed this pass" />}
                                                    </div>
                                                    {ch.newNote && <p className="text-[11px] text-muted-foreground mt-0.5">{ch.newNote}</p>}
                                                    {ch.reason && <p className="text-[11px] text-muted-foreground mt-0.5">{ch.reason}</p>}
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {(ch.alternatives || []).map((alt: string) => {
                                                            const sel = canonName(selectedName) === canonName(alt)
                                                            return (
                                                                <button key={alt} type="button" onClick={() => applySubstitute(ch.index, alt)}
                                                                    className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${sel ? 'bg-accent text-accent-foreground border-accent' : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-accent'}`}>
                                                                    {alt}
                                                                </button>
                                                            )
                                                        })}
                                                        <button type="button" onClick={() => setCustomOpen(prev => ({ ...prev, [ch.index]: !prev[ch.index] }))}
                                                            className={`px-2 py-0.5 rounded-full text-[11px] border border-dashed border-border transition-colors ${showInput ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                                            Custom…
                                                        </button>
                                                    </div>
                                                    {showInput && (
                                                        <input
                                                            value={selected[ch.index] ?? ''}
                                                            autoFocus
                                                            onChange={e => applySubstitute(ch.index, e.target.value)}
                                                            placeholder="Type a substitute…"
                                                            className="mt-2 w-full h-8 rounded-lg bg-background border border-border px-2 text-xs focus:outline-none focus:border-accent"
                                                        />
                                                    )}
                                                </div>
                                            )
                                        }
                                        const renderUnchangedRow = (ing: any, i: number) => {
                                            const showInput = !!customOpen[i]
                                            const pending = pendingSubs[i]
                                            return (
                                                <div key={`ing-${i}`} className={`rounded-xl border border-border p-2.5 ${pending ? 'border-l-2 border-l-amber-400' : 'border-border/60'}`}>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm min-w-0 flex-1">
                                                            <span className={pending ? 'line-through text-muted-foreground' : ''}>{ing.Name}</span>
                                                            {pending && <span className="ml-1.5 text-muted-foreground">→</span>}
                                                            {pending && <span className="font-bold">{pending.to}</span>}
                                                            {ing.Note && <span className="text-[11px] text-muted-foreground"> · {ing.Note}</span>}
                                                        </p>
                                                        <button type="button" onClick={() => setCustomOpen(prev => ({ ...prev, [i]: !prev[i] }))}
                                                            className={`px-2 py-0.5 rounded-full text-[11px] border border-dashed border-border transition-colors shrink-0 ${showInput ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                                            {showInput ? 'Cancel' : 'Substitute…'}
                                                        </button>
                                                    </div>
                                                    {showInput && (
                                                        <input
                                                            value={selected[i] ?? ''}
                                                            autoFocus
                                                            onChange={e => applySubstitute(i, e.target.value)}
                                                            placeholder={`Replace ${ing.Name}…`}
                                                            className="mt-2 w-full h-8 rounded-lg bg-background border border-border px-2 text-xs focus:outline-none focus:border-accent"
                                                        />
                                                    )}
                                                </div>
                                            )
                                        }
                                        return (
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ingredients</p>
                                                    <button type="button" onClick={() => setShowAllIngredients(v => !v)}
                                                        className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0">
                                                        {showAllIngredients
                                                            ? 'Show changes only'
                                                            : `Show all ingredients (${recipe?.ingredients?.length || 0})`}
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {showAllIngredients
                                                        ? curIng.map((ing, i) => (diffByIndex.has(i) ? renderDiffCard(diffByIndex.get(i)) : renderUnchangedRow(ing, i)))
                                                        : ingredientDiffs.map(renderDiffCard)}
                                                </div>
                                            </div>
                                        )
                                    })()}

                                    {stepDiffs.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Steps</p>
                                            <div className="space-y-2">
                                                {stepDiffs.map((ch) => (
                                                    <div key={`step-${ch.index}`} className={`rounded-xl border border-border p-3 ${ch.isLastPass ? 'border-l-2 border-l-amber-400' : ''}`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Step {ch.index + 1}</span>
                                                            {ch.isLastPass && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Changed this pass" aria-label="Changed this pass" />}
                                                        </div>
                                                        {ch.originalText && <p className="text-[11px] text-muted-foreground line-through mt-0.5">{ch.originalText}</p>}
                                                        <p className="text-sm mt-0.5">{ch.newText}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-2">
                            <p className="text-xs font-bold">Anything else to adjust?</p>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="e.g. “also make it nut-free”, “use smoked paprika”, “simplify step 3”…"
                                className="w-full min-h-[70px] rounded-lg bg-secondary border border-border p-2 text-xs resize-y focus:outline-none focus:border-accent"
                            />
                            {reflectionText && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {reflectionInNotes ? (
                                        <>
                                            <MessageSquareText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                            <span className="text-[11px] text-muted-foreground flex-1 min-w-[8rem]">Cooking reflection brought through</span>
                                            <button type="button" onClick={clearReflectionOut} disabled={working}
                                                className="px-2 py-0.5 rounded-full text-[11px] border border-border text-muted-foreground hover:text-foreground hover:border-accent transition-colors disabled:opacity-50">
                                                Clear
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <MessageSquareText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <button type="button" onClick={bringReflectionIn} disabled={working}
                                                className="px-2 py-0.5 rounded-full text-[11px] border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-accent transition-colors disabled:opacity-50">
                                                Bring through cooking reflection
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
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
                        {baseDiffs.length === 0 && (
                            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-start gap-2">
                                <span className="text-emerald-600 mt-0.5"><Check size={15} /></span>
                                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                    No changes were needed — this recipe already meets {dietLabels.length > 0 ? dietLabels.join(', ') : 'your requirements'}.
                                </p>
                            </div>
                        )}
                        <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">Name:</span> {finalName}</p>
                            {willVersionName && <p className="text-[11px] text-muted-foreground">Named “{finalName}” and linked back to the original recipe so remixes can be grouped later.</p>}
                            {willTagName && <p className="text-[11px] text-muted-foreground">Name tagged “({dietLabels.join(', ')})” because the recipe was adapted.</p>}
                            <p><span className="text-muted-foreground">Ingredients:</span> {recipe?.ingredients?.length || 0}</p>
                            <p><span className="text-muted-foreground">Steps:</span> {recipe?.instructions?.length || 0}</p>
                            {dietLabels.length > 0 && <p><span className="text-muted-foreground">Remixed to:</span> {dietLabels.join(', ')}</p>}
                            {reflectionText && (
                                <p><span className="text-muted-foreground">Reflection:</span> {reflectionInNotes ? 'brought through with the notes' : 'not carried — the original keeps its reflection'}</p>
                            )}
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
