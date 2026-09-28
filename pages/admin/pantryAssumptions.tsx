import { useEffect, useState } from 'react'
import { useAdminGuard } from '../../lib/useAdminGuard'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { PLANNING_BUCKET_ORDER } from '../../lib/pantryPlanning'

type PantryAssumption = {
    _id: string
    type: 'name' | 'category'
    match: 'exact' | 'contains'
    value: string
    exclude: string[]
    bucket: string
    priority: number
    active: boolean
    isSystem: boolean
}

const emptyForm = {
    type: 'name' as 'name' | 'category',
    match: 'contains' as 'exact' | 'contains',
    value: '',
    exclude: '',
    bucket: PLANNING_BUCKET_ORDER[0],
    priority: 50,
}

export default function AdminPantryAssumptions() {
    const isAuthorized = useAdminGuard()
    const [rules, setRules] = useState<PantryAssumption[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const load = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/PantryAssumptions', {
                headers: { 'edgetoken': localStorage.getItem('Token') || '' }
            })
            const data = await res.json()
            if (data.success && Array.isArray(data.data)) setRules(data.data)
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
        if (!form.value.trim()) { setError('Value is required'); return }
        setSaving(true)
        setError('')
        try {
            const res = await fetch('/api/PantryAssumptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
                body: JSON.stringify({
                    type: form.type,
                    match: form.match,
                    value: form.value.trim(),
                    exclude: form.exclude.split(',').map(s => s.trim()).filter(Boolean),
                    bucket: form.bucket,
                    priority: Number(form.priority) || 50,
                })
            })
            const data = await res.json()
            if (data.success) {
                setForm({ ...emptyForm })
                load()
            } else setError(data.message || 'Failed to save')
        } catch (e: any) {
            setError(e.message || 'Failed to save')
        }
        setSaving(false)
    }

    const toggleActive = async (rule: PantryAssumption) => {
        await fetch('/api/PantryAssumptions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
            body: JSON.stringify({ _id: rule._id, active: !rule.active })
        })
        load()
    }

    const remove = async (id: string, isSystem: boolean) => {
        if (!confirm(isSystem ? 'Deactivate this built-in rule?' : 'Delete this rule?')) return
        await fetch('/api/PantryAssumptions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
            body: JSON.stringify({ _id: id })
        })
        load()
    }

    if (!isAuthorized) return null

    return (
        <Layout title="Pantry Assumptions" description="Rules used by the shopping list 'Planning' grouping">
            <div className="max-w-4xl mx-auto mt-8 px-4 pb-16">
                <PageHeader title="Pantry Assumptions" />

                {/* Create */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3 mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Add rule</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <select className="input-modern" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}>
                            <option value="name">Name</option>
                            <option value="category">Category</option>
                        </select>
                        <select className="input-modern" value={form.match} onChange={e => setForm({ ...form, match: e.target.value as any })}>
                            <option value="contains">contains</option>
                            <option value="exact">exact</option>
                        </select>
                        <input className="input-modern col-span-2" placeholder={form.type === 'name' ? 'Value (e.g. rice)' : 'Broad category (e.g. Baking Supplies)'} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
                        <select className="input-modern" value={form.bucket} onChange={e => setForm({ ...form, bucket: e.target.value })}>
                            {PLANNING_BUCKET_ORDER.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <input type="number" className="input-modern" placeholder="Priority" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} />
                        <input className="input-modern col-span-2" placeholder="Exclude words, comma separated (optional)" value={form.exclude} onChange={e => setForm({ ...form, exclude: e.target.value })} />
                    </div>
                    <div className="flex items-center">
                        <button onClick={submit} disabled={saving} className="ml-auto px-4 py-2 rounded-lg bg-emerald-500 text-black text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition-all disabled:opacity-40 flex items-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                        </button>
                    </div>
                    {error && <p className="text-xs text-rose-400">{error}</p>}
                </div>

                {/* List */}
                {loading ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
                ) : (
                    <div className="rounded-xl border border-white/10 divide-y divide-white/5">
                        {rules.map((r) => (
                            <div key={r._id} className={`flex items-center gap-3 px-4 py-3 ${r.active ? '' : 'opacity-50'}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm">
                                        <span className="uppercase text-[10px] tracking-wider text-muted-foreground mr-2">{r.type}</span>
                                        {r.value}
                                        <span className="ml-2 text-[11px] font-normal text-muted-foreground">({r.match}{r.exclude?.length ? `, not ${r.exclude.join('/')}` : ''})</span>
                                        {!r.active && <span className="ml-2 text-[10px] text-muted-foreground uppercase">(inactive)</span>}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">→ {r.bucket} · priority {r.priority}</p>
                                </div>
                                <button onClick={() => toggleActive(r)} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-white transition-colors">
                                    {r.active ? 'Disable' : 'Enable'}
                                </button>
                                <button onClick={() => remove(r._id, r.isSystem)} className="text-muted-foreground hover:text-rose-400 transition-colors" title={r.isSystem ? 'Deactivate' : 'Delete'} aria-label={`Remove ${r.value}`}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {rules.length === 0 && <div className="px-4 py-6 text-center text-muted-foreground text-sm">No rules yet</div>}
                    </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                    Name rules match with word boundaries, so <em>rice</em> also matches <em>basmati rice</em>. Priority breaks ties
                    (higher wins), then the most specific value. Rules are checked before recent purchases, followed by category rules.
                    Recent purchases use a 4-week window, except Fresh Produce (1 week → Maybe). Built-in rules are deactivated rather
                    than deleted.
                </p>
            </div>
        </Layout>
    )
}
