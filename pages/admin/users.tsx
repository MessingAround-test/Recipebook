import { useCallback, useEffect, useState } from 'react'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useAdminGuard } from '../../lib/useAdminGuard'
import { FEATURES } from '../../lib/features'

interface AdminUser {
    _id: string
    username: string
    email: string
    role: string
    approved: boolean
    onboarded: boolean
    features: Record<string, boolean>
}

export default function AdminUsers() {
    const isAuthorized = useAdminGuard()
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [draft, setDraft] = useState<Record<string, boolean>>({})
    const [savingId, setSavingId] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        const token = localStorage.getItem('Token')
        try {
            const res = await fetch('/api/admin/users', { headers: { edgetoken: token || '' } })
            const data = await res.json()
            if (data.success) setUsers(data.data || [])
            else alert(data.message || 'Failed to load users')
        } catch (e: any) {
            alert('Load failed: ' + e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { if (isAuthorized) fetchUsers() }, [isAuthorized, fetchUsers])

    const openUser = (user: AdminUser) => {
        if (expandedId === user._id) {
            setExpandedId(null)
            return
        }
        setExpandedId(user._id)
        setDraft({ ...user.features })
    }

    const setFeature = (key: string, value: boolean) => {
        setDraft(prev => ({ ...prev, [key]: value }))
    }

    const saveUser = async (user: AdminUser) => {
        setSavingId(user._id)
        const token = localStorage.getItem('Token')
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({ userId: user._id, features: draft })
            })
            const data = await res.json()
            if (!data.success) {
                alert(data.message || 'Save failed')
                return
            }
            setUsers(prev => prev.map(u => u._id === user._id ? data.data : u))
            setExpandedId(null)
        } catch (e: any) {
            alert('Save failed: ' + e.message)
        } finally {
            setSavingId(null)
        }
    }

    if (!isAuthorized) return null

    const q = search.trim().toLowerCase()
    const visible = q
        ? users.filter(u => (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
        : users

    return (
        <Layout title="User Access" description="Manage per-user feature access">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                <PageHeader title="User Access" />

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground">
                        Control which parts of the app each account can access. Disabled features are hidden from
                        navigation and will not load on their dashboard.
                    </p>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by username or email…"
                        className="mt-3 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-xl">
                        <div className="divide-y divide-white/5">
                            {visible.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground text-sm">No users found.</div>
                            ) : visible.map(user => {
                                const expanded = expandedId === user._id
                                const enabledCount = FEATURES.filter(f => user.features[f.key]).length
                                return (
                                    <div key={user._id}>
                                        <button
                                            type="button"
                                            onClick={() => openUser(user)}
                                            className="w-full text-left px-4 md:px-6 py-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm truncate">{user.username}</div>
                                                <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${user.role === 'admin' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-muted-foreground'}`}>
                                                    {user.role}
                                                </span>
                                                <span className="text-[10px] font-bold text-muted-foreground">
                                                    {enabledCount}/{FEATURES.length}
                                                </span>
                                                {!user.onboarded && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">New</span>
                                                )}
                                            </div>
                                        </button>

                                        {expanded && (
                                            <div className="px-4 md:px-6 pb-5">
                                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
                                                    {FEATURES.map(feature => (
                                                        <label key={feature.key} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.03] cursor-pointer">
                                                            <span className="min-w-0">
                                                                <span className="block text-sm font-semibold">{feature.label}</span>
                                                                <span className="block text-[11px] text-muted-foreground">{feature.description}</span>
                                                            </span>
                                                            <input
                                                                type="checkbox"
                                                                className="toggle toggle-emerald"
                                                                checked={draft[feature.key] === true}
                                                                onChange={e => setFeature(feature.key, e.target.checked)}
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                                <div className="mt-3 flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => saveUser(user)}
                                                        disabled={savingId === user._id}
                                                        className="px-4 h-10 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl text-xs active:scale-95 transition-all disabled:opacity-50"
                                                    >
                                                        {savingId === user._id ? 'Saving…' : 'Save Access'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDraft({})}
                                                        className="px-4 h-10 border border-white/10 text-muted-foreground font-black uppercase tracking-widest rounded-xl text-xs hover:bg-white/5 transition-all"
                                                    >
                                                        Clear all
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
