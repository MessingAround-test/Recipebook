import { useEffect, useState } from 'react'
import Router from 'next/router'
import { Layout } from '../../components/Layout'
import { Button } from '../../components/ui/button'
import { useAuthGuard } from '../../lib/useAuthGuard'
import { Plus, Globe2, Loader2, UtensilsCrossed, Sparkles, Compass } from 'lucide-react'
import { NewListModal } from '../../components/dishLists/NewListModal'
import { DishListSummary } from '../../components/dishLists/types'

export default function DishLists() {
    const isAuthed = useAuthGuard()
    const [lists, setLists] = useState<DishListSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [newOpen, setNewOpen] = useState(false)

    const token = () => localStorage.getItem('Token') || ''

    const fetchLists = async () => {
        const res = await fetch('/api/dishLists', { headers: { edgetoken: token() } })
        const data = await res.json()
        return (data.data || []) as DishListSummary[]
    }

    const load = async () => {
        setLoading(true)
        try {
            let data = await fetchLists()
            // Seed the two starter lists on first visit (idempotent).
            if (data.length === 0) {
                await fetch('/api/dishLists/seed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', edgetoken: token() },
                    body: JSON.stringify({})
                })
                data = await fetchLists()
            }
            setLists(data)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthed) load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed])

    if (!isAuthed) return null

    return (
        <Layout title="Explore" description="Dish lists to tick off">
            <div className="relative min-h-screen pb-24">
                <header className="sticky top-0 z-40 px-4 sm:px-8 py-3 bg-background/80 backdrop-blur-xl shadow-sm">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                            <Globe2 className="text-accent" size={20} /> Explore
                        </h1>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => Router.push('/map?from=/dishLists')} className="rounded-xl">
                                <Compass size={16} /> World map
                            </Button>
                            <Button size="sm" onClick={() => setNewOpen(true)} className="rounded-xl">
                                <Plus size={16} /> New list
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Work through the world's best dishes and tick them off as you cook.
                    </p>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="animate-spin text-accent" size={30} />
                        <p className="text-sm font-medium text-muted-foreground">Loading your lists…</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4">
                        {lists.map(list => {
                            const total = list.counts?.total || 0
                            const cooked = list.counts?.cooked || 0
                            const pct = total > 0 ? Math.round((cooked / total) * 100) : 0
                            return (
                                <button
                                    key={list._id}
                                    onClick={() => Router.push(`/dishLists/${list._id}`)}
                                    className="text-left rounded-2xl bg-card border border-border p-4 hover:border-accent hover:shadow-xl hover:shadow-accent/5 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h2 className="text-base font-bold leading-tight">{list.name}</h2>
                                        {list.dietaryFilters?.length > 0 && (
                                            <Sparkles size={14} className="text-accent shrink-0 mt-0.5" />
                                        )}
                                    </div>
                                    {list.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{list.description}</p>}

                                    <div className="mt-4">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground mb-1.5">
                                            <span className="inline-flex items-center gap-1"><UtensilsCrossed size={11} /> {cooked}/{total} cooked</span>
                                            <span>{pct}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>

                                    {list.dietaryFilters?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-3">
                                            {list.dietaryFilters.map(f => (
                                                <span key={f} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent">{f.replace(/_/g, ' ')}</span>
                                            ))}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            <NewListModal
                isOpen={newOpen}
                onClose={() => setNewOpen(false)}
                onCreated={(list) => {
                    setLists(prev => [...prev, { ...list, counts: { total: 0, cooked: 0, imported: 0 } }])
                    Router.push(`/dishLists/${list._id}`)
                }}
            />
        </Layout>
    )
}
