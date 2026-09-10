import { useEffect, useState } from 'react'
import { useAdminGuard } from '../../lib/useAdminGuard'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { Loader2, Plus, Trash2 } from 'lucide-react'

type CarbPhase = { name: string; minutes: number; instruction: string }
type CarbType = {
    _id: string
    name: string
    aliases: string[]
    timing?: { cookMinutes: number; prepMinutes: number }
    phases?: CarbPhase[]
    variants?: { name: string; cookMinutes: number; prepMinutes: number; phases?: CarbPhase[] }[]
    defaultStepText?: string
    order: number
    active: boolean
    isSystem: boolean
}

const newPhase = (): CarbPhase => ({ name: '', minutes: 0, instruction: '' })
const emptyForm = { name: '', aliases: '', defaultStepText: '', useVariants: false, phases: [newPhase()] as CarbPhase[], variants: [{ name: 'White', phases: [newPhase()] }, { name: 'Brown', phases: [newPhase(), newPhase()] }] as { name: string; phases: CarbPhase[] }[] }

export default function AdminCarbTypes() {
    const isAuthorized = useAdminGuard()
    const [carbs, setCarbs] = useState<CarbType[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const load = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/carbTypes', {
                headers: { 'edgetoken': localStorage.getItem('Token') || '' }
            })
            const data = await res.json()
            if (data.success && Array.isArray(data.data)) setCarbs(data.data)
            else setError(data.message || 'Failed to load')
        } catch (e: any) {
            setError(e.message || 'Failed to load')
        }
        setLoading(false)
    }

    useEffect(() => {
        if (isAuthorized) load()
    }, [isAuthorized])

    const submit = async () => {
        if (!form.name.trim()) { setError('Name is required'); return }
        setSaving(true)
        setError('')
        try {
            const body: any = {
                name: form.name.trim(),
                aliases: form.aliases.split(',').map((a: string) => a.trim()).filter(Boolean),
                defaultStepText: form.defaultStepText.trim() || undefined,
                order: 100
            }
            if (form.useVariants) {
                body.variants = form.variants.map(v => ({
                    name: v.name.trim() || 'Variant',
                    phases: v.phases.filter(p => p.name.trim()).map(p => ({ name: p.name.trim(), minutes: Number(p.minutes) || 0, instruction: p.instruction.trim() }))
                })).filter(v => v.phases.length > 0)
            } else {
                body.phases = form.phases.filter(p => p.name.trim()).map(p => ({
                    name: p.name.trim(), minutes: Number(p.minutes) || 0, instruction: p.instruction.trim()
                }))
            }
            const res = await fetch('/api/carbTypes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
                body: JSON.stringify(body)
            })
            const data = await res.json()
            if (data.success) {
                setForm({ name: '', aliases: '', defaultStepText: '', useVariants: false, phases: [newPhase()], variants: [{ name: '', phases: [newPhase()] }] })
                load()
            } else setError(data.message || 'Failed to save')
        } catch (e: any) {
            setError(e.message || 'Failed to save')
        }
        setSaving(false)
    }

    const remove = async (id: string, isSystem: boolean) => {
        if (!confirm(isSystem ? 'Deactivate this carb type? Existing recipes are unaffected.' : 'Delete this carb type?')) return
        await fetch('/api/carbTypes', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
            body: JSON.stringify({ _id: id })
        })
        load()
    }

    if (!isAuthorized) return null

    return (
        <Layout title="Carb Types" description="Manage the carb side-dish catalog used by Start Cooking">
            <div className="max-w-4xl mx-auto mt-8 px-4 pb-16">
                <PageHeader title="Carb Types" />

                {/* Create */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3 mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Add carb type</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input className="input-modern" placeholder="Name (e.g. Bulgur)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        <input className="input-modern sm:col-span-2" placeholder="Aliases, comma separated (optional)" value={form.aliases} onChange={e => setForm({ ...form, aliases: e.target.value })} />
                    </div>
                    {form.useVariants ? (
                        <div className="space-y-3">
                            {form.variants.map((v, vi) => (
                                <div key={vi} className="rounded-lg border border-white/10 p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input className="input-modern flex-1" placeholder="Variant name (e.g. White)" value={v.name} onChange={e => {
                                            const next = [...form.variants]
                                            next[vi] = { ...next[vi], name: e.target.value }
                                            setForm({ ...form, variants: next })
                                        }} />
                                        <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                                            total {v.phases.reduce((a, p) => a + (Number(p.minutes) || 0), 0)} min
                                        </span>
                                        <button type="button" className="text-muted-foreground hover:text-rose-400" onClick={() => setForm({ ...form, variants: form.variants.filter((_, i) => i !== vi) })} title="Remove variant">✕</button>
                                    </div>
                                    <PhaseEditor phases={v.phases} onChange={next => {
                                        const nextV = [...form.variants]
                                        nextV[vi] = { ...nextV[vi], phases: next }
                                        setForm({ ...form, variants: nextV })
                                    }} />
                                </div>
                            ))}
                            <button type="button" onClick={() => setForm({ ...form, variants: [...form.variants, { name: '', phases: [newPhase()] }] })} className="text-xs font-bold text-accent hover:underline">+ Add variant</button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <PhaseEditor phases={form.phases} onChange={next => setForm({ ...form, phases: next })} />
                            <p className="text-[11px] text-muted-foreground">Total before the end: <strong>{form.phases.reduce((a, p) => a + (Number(p.minutes) || 0), 0)}</strong> min</p>
                        </div>
                    )}
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <input type="checkbox" checked={form.useVariants} onChange={e => setForm({ ...form, useVariants: e.target.checked })} className="accent-emerald-500" />
                            Has variants (like White/Brown rice)
                        </label>
                        <button onClick={submit} disabled={saving} className="ml-auto px-4 py-2 rounded-lg bg-emerald-500 text-black text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition-all disabled:opacity-40 flex items-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                        </button>
                    </div>
                    <input className="input-modern" placeholder="Default step text template ({cook} / {prep} placeholders) — optional; the AI usually writes its own" value={form.defaultStepText} onChange={e => setForm({ ...form, defaultStepText: e.target.value })} />
                    {error && <p className="text-xs text-rose-400">{error}</p>}
                </div>

                {/* List */}
                {loading ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
                ) : (
                    <div className="rounded-xl border border-white/10 divide-y divide-white/5">
                        {carbs.map((c) => (
                            <div key={c._id} className="flex items-center gap-3 px-4 py-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm">{c.name}{!c.active && <span className="ml-2 text-[10px] text-muted-foreground uppercase">(inactive)</span>}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                    {c.variants?.length
                                        ? c.variants.map(v => `${v.name}: ${(v.phases || []).map(p => `${p.name} ${p.minutes}`).join(' → ') || `${v.prepMinutes}+${v.cookMinutes}`}`).join(' · ')
                                        : (c.phases?.length ?? 0) > 0
                                            ? c.phases.map(p => `${p.name} ${p.minutes}`).join(' → ')
                                            : `${c.timing?.prepMinutes ?? 5} prep + ${c.timing?.cookMinutes ?? 15} min`}
                                    {c.aliases?.length ? ` · aliases: ${c.aliases.join(', ')}` : ''}
                                </p>
                                </div>
                                <button onClick={() => remove(c._id, c.isSystem)} className="text-muted-foreground hover:text-rose-400 transition-colors" title={c.isSystem ? 'Deactivate' : 'Delete'} aria-label={`Remove ${c.name}`}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {carbs.length === 0 && <div className="px-4 py-6 text-center text-muted-foreground text-sm">No carb types yet</div>}
                    </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                    Phases run back-to-back, and each one slots in at its own time before the recipe's last step (eg boil 5 + cook 15 starts 20 min before the end).
                    Phases with 0 minutes become timer-less do-at-the-end cards (eg fluff).
                    System types are deactivated rather than deleted.
                </p>
            </div>
        </Layout>
    )
}

/** Phase sequence editor: name / minutes / optional instruction rows. */
function PhaseEditor({ phases, onChange }: { phases: CarbPhase[]; onChange: (next: CarbPhase[]) => void }) {
    return (
        <div className="space-y-2">
            {phases.map((p, i) => (
                <div key={i} className="flex flex-wrap gap-2 items-center">
                    <input
                        className="input-modern flex-1 min-w-[120px]"
                        placeholder={`Phase name (e.g. Boil water)`}
                        value={p.name}
                        onChange={e => {
                            const next = [...phases]
                            next[i] = { ...next[i], name: e.target.value }
                            onChange(next)
                        }}
                    />
                    <input
                        type="number"
                        min="0"
                        className="input-modern w-16"
                        placeholder="min"
                        value={p.minutes}
                        onChange={e => {
                            const next = [...phases]
                            next[i] = { ...next[i], minutes: Number(e.target.value) || 0 }
                            onChange(next)
                        }}
                        aria-label="minutes (0 = no timer)"
                    />
                    <input
                        className="input-modern flex-1 min-w-[180px]"
                        placeholder="Instruction (blank = AI/catalog writes it)"
                        value={p.instruction}
                        onChange={e => {
                            const next = [...phases]
                            next[i] = { ...next[i], instruction: e.target.value }
                            onChange(next)
                        }}
                    />
                    <button type="button" className="text-muted-foreground hover:text-rose-400" onClick={() => onChange(phases.filter((_, x) => x !== i))} aria-label="Remove phase">✕</button>
                </div>
            ))}
            <button type="button" onClick={() => onChange([...phases, newPhase()])} className="text-xs font-bold text-accent hover:underline">+ Add phase</button>
        </div>
    )
}
