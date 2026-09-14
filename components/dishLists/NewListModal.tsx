import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { X, Loader2, Sparkles } from 'lucide-react'
import { CRITERIA_OPTIONS, normalizeCriteria } from '../../lib/dishLists/criteria'
import { TASTEATLAS_PRESETS } from '../../lib/dishLists/presets'
import { DishListSummary } from './types'

interface NewListModalProps {
    isOpen: boolean
    onClose: () => void
    onCreated: (list: DishListSummary) => void
}

const SOURCE_TYPES = [
    { value: 'tasteatlas', label: 'TasteAtlas list', hint: 'Paste the TasteAtlas ranking page next' },
    { value: 'custom', label: 'From my own links', hint: 'Paste dish URLs/slugs next' },
    { value: 'manual', label: 'Manual list', hint: 'Add dishes by hand' }
] as const

export function NewListModal({ isOpen, onClose, onCreated }: NewListModalProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [sourceType, setSourceType] = useState<'tasteatlas' | 'custom' | 'manual'>('tasteatlas')
    const [sourceUrl, setSourceUrl] = useState('')
    const [criteria, setCriteria] = useState<string[]>([])
    const [saving, setSaving] = useState(false)

    if (!isOpen) return null

    const applyPreset = (key: string) => {
        const preset = TASTEATLAS_PRESETS.find(p => p.key === key)
        if (!preset) return
        setName(preset.name)
        setDescription(preset.description)
        setSourceUrl(preset.url)
        setSourceType('tasteatlas')
        setCriteria(normalizeCriteria(preset.dietaryFilters))
    }

    const toggleCriterion = (value: string) => {
        setCriteria(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
    }

    const submit = async () => {
        if (!name.trim() || saving) return
        setSaving(true)
        try {
            const res = await fetch('/api/dishLists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim(),
                    sourceType,
                    sourceUrl: sourceUrl.trim(),
                    dietaryFilters: criteria
                })
            })
            const data = await res.json()
            if (data.success) {
                onCreated(data.data)
                onClose()
            } else {
                alert(data.message || 'Could not create list')
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div className="w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-card/95 backdrop-blur px-5 py-4 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-bold">New list</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-5">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Quick start</label>
                        <div className="flex flex-wrap gap-2">
                            {TASTEATLAS_PRESETS.map(p => (
                                <button key={p.key} type="button" onClick={() => applyPreset(p.key)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary border border-border hover:border-accent transition-colors">
                                    <Sparkles size={12} className="text-accent" /> {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Name</label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Best Side Dishes in the World" />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Description (optional)</label>
                        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this list about?" />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Source</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {SOURCE_TYPES.map(s => (
                                <button key={s.value} type="button" onClick={() => setSourceType(s.value)}
                                    className={`p-3 rounded-xl border text-left transition-all ${sourceType === s.value ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-secondary border-border hover:border-accent'}`}>
                                    <div className="text-sm font-bold">{s.label}</div>
                                    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{s.hint}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Source URL</label>
                        <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://www.tasteatlas.com/best/dishes (optional)" />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Dietary criteria (used when searching recipes)</label>
                        <div className="flex flex-wrap gap-2">
                            {CRITERIA_OPTIONS.map(c => (
                                <button key={c.value} type="button" onClick={() => toggleCriterion(c.value)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${criteria.includes(c.value) ? 'bg-accent text-accent-foreground border-accent' : 'bg-secondary border-border hover:border-accent'}`}>
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button onClick={submit} disabled={!name.trim() || saving} className="w-full h-11 rounded-xl">
                        {saving ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : 'Create list'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
