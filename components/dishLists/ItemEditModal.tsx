import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { X, Loader2 } from 'lucide-react'
import { DishListItem } from './types'

interface ItemEditModalProps {
    isOpen: boolean
    onClose: () => void
    item: DishListItem | null
    onSaved: (item: DishListItem) => void
}

export function ItemEditModal({ isOpen, onClose, item, onSaved }: ItemEditModalProps) {
    const [form, setForm] = useState({
        name: '',
        category: '',
        description: '',
        country: '',
        region: '',
        city: '',
        notes: ''
    })
    const [saving, setSaving] = useState(false)
    const [regionSearchFailed, setRegionSearchFailed] = useState(false)

    useEffect(() => {
        if (!isOpen || !item) return
        setForm({
            name: item.name || '',
            category: item.category || '',
            description: item.description || '',
            country: item.location?.country || '',
            region: item.location?.region || '',
            city: item.location?.city || '',
            notes: item.notes || ''
        })
        setRegionSearchFailed(item.location?.regionSearchFailed === true)
    }, [isOpen, item?._id])

    if (!isOpen || !item) return null

    const patch = (key: keyof typeof form) => (e: any) => setForm(prev => ({ ...prev, [key]: e.target.value }))

    const save = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/dishLists/items', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
                body: JSON.stringify({
                    itemId: item._id,
                    name: form.name.trim() || item.name,
                    category: form.category.trim(),
                    description: form.description.trim(),
                    notes: form.notes.trim(),
                    location: {
                        country: form.country.trim(),
                        region: form.region.trim(),
                        city: form.city.trim()
                    }
                })
            })
            const data = await res.json()
            if (data.success) {
                onSaved(data.data)
                onClose()
            } else {
                alert(data.message || 'Could not save')
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div className="w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-card/95 backdrop-blur px-5 py-4 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-bold">Edit dish</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Name</label>
                        <Input value={form.name} onChange={patch('name')} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Category</label>
                        <Input value={form.category} onChange={patch('category')} placeholder="e.g. Soup, Pizza, Dessert" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Blurb</label>
                        <textarea value={form.description} onChange={patch('description')} rows={3}
                            className="w-full rounded-xl bg-secondary border border-border p-3 text-sm resize-none focus:outline-none focus:border-accent" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Country</label>
                            <Input value={form.country} onChange={patch('country')} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Region</label>
                            <Input
                                value={form.region}
                                onChange={patch('region')}
                                placeholder={regionSearchFailed ? 'Not found' : ''}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">City</label>
                            <Input
                                value={form.city}
                                onChange={patch('city')}
                                placeholder={regionSearchFailed ? 'Not found' : ''}
                            />
                        </div>
                    </div>
                    {regionSearchFailed && !form.region.trim() && !form.city.trim() && (
                        <p className="text-[11px] text-amber-500 -mt-1 ml-1">
                            We searched for a region/city but couldn't confidently find one — enter it here, or re-run Locations later.
                        </p>
                    )}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Notes</label>
                        <Input value={form.notes} onChange={patch('notes')} placeholder="Your own notes" />
                    </div>
                    <Button onClick={save} disabled={saving} className="w-full h-11 rounded-xl">
                        {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
