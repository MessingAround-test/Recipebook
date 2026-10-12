import { useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent, FormEvent } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { COUNTRIES } from '../../lib/dishLists/countries'
import { fileToCompressedBase64 } from '../../lib/recipeImage'
import { Loader2, Plus, Upload, X } from 'lucide-react'

interface QuickAddFormProps {
    listId: string
    onAdded: () => void
}

const EMPTY = {
    name: '',
    country: '',
    region: '',
    city: '',
    category: '',
    description: '',
    notes: '',
    link: '',
    imageUrl: ''
}

type FormState = typeof EMPTY

const normalizeLink = (value: string): string => {
    const trimmed = value.trim()
    if (!trimmed) return ''
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

const label = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2'
const field = 'h-10 text-sm'
const area = 'w-full rounded-xl bg-secondary border border-border p-3 text-sm resize-none focus:outline-none focus:border-accent'

/**
 * Simple one-at-a-time dish form (the "Quick add" tab of Add dishes).
 * Posts to the manual-create endpoint, then resets in place so the next
 * dish can be typed immediately without closing the popup.
 */
export function QuickAddForm({ listId, onAdded }: QuickAddFormProps) {
    const [form, setForm] = useState<FormState>({ ...EMPTY })
    const [pendingImage, setPendingImage] = useState<string | null>(null)
    const [imageStatus, setImageStatus] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [flash, setFlash] = useState<string | null>(null)
    const nameRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const patch = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [key]: e.target.value }))
        setFlash(null)
    }

    const applyImageFile = async (file: File | null | undefined) => {
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setError('That file is not an image')
            return
        }
        setError(null)
        setFlash(null)
        try {
            const dataUrl = await fileToCompressedBase64(file, setImageStatus)
            setPendingImage(dataUrl)
            setForm(prev => ({ ...prev, imageUrl: '' }))
        } catch {
            setError('Could not read image')
        }
    }

    const pickImage = async (e: ChangeEvent<HTMLInputElement>) => {
        await applyImageFile(e.target.files?.[0])
        e.target.value = ''
    }

    const onImagePaste = async (e: ClipboardEvent<HTMLInputElement>) => {
        const items = e.clipboardData?.items
        if (items) {
            for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault()
                    await applyImageFile(item.getAsFile())
                    return
                }
            }
        }
        // Plain-text paste (URL or data URI) falls through to the input.
    }

    const canSubmit = !!form.name.trim() && !!form.country.trim() && !busy && !imageStatus

    const save = async (e?: FormEvent) => {
        e?.preventDefault()
        if (!canSubmit) return
        setBusy(true)
        setError(null)
        setFlash(null)
        try {
            const imageValue = pendingImage || form.imageUrl.trim()
            const res = await fetch(`/api/dishLists/${listId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': localStorage.getItem('Token') || '' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    country: form.country.trim(),
                    region: form.region.trim() || undefined,
                    city: form.city.trim() || undefined,
                    category: form.category.trim() || undefined,
                    description: form.description.trim() || undefined,
                    notes: form.notes.trim() || undefined,
                    sourceUrl: normalizeLink(form.link) || undefined,
                    imageUrl: imageValue ? (/^data:/i.test(imageValue) ? imageValue : normalizeLink(imageValue)) : undefined
                })
            })
            const data = await res.json()
            if (data.success) {
                setFlash(data.message || `Added ${form.name.trim()}.`)
                setForm({ ...EMPTY })
                setPendingImage(null)
                onAdded()
                nameRef.current?.focus()
            } else {
                setError(data.message || 'Could not save')
            }
        } catch {
            setError('Request failed')
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={save} className="space-y-3">
            <div>
                <label className={label}>Name</label>
                <Input
                    ref={nameRef}
                    autoFocus
                    value={form.name}
                    onChange={patch('name')}
                    placeholder="Dish name"
                    className={field}
                    disabled={busy}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                    <label className={label}>Country</label>
                    <Input
                        list="quickadd-country-options"
                        value={form.country}
                        onChange={patch('country')}
                        placeholder="Country"
                        className={field}
                        disabled={busy}
                    />
                </div>
                <div>
                    <label className={label}>Region</label>
                    <Input value={form.region} onChange={patch('region')} placeholder="Optional" className={field} disabled={busy} />
                </div>
                <div>
                    <label className={label}>City</label>
                    <Input value={form.city} onChange={patch('city')} placeholder="Optional" className={field} disabled={busy} />
                </div>
            </div>
            <datalist id="quickadd-country-options">
                {COUNTRIES.map(c => <option key={c} value={c} />)}
            </datalist>

            <div>
                <label className={label}>Category</label>
                <Input value={form.category} onChange={patch('category')} placeholder="e.g. Soup, Pizza, Dessert" className={field} disabled={busy} />
            </div>

            <div>
                <label className={label}>Blurb</label>
                <textarea value={form.description} onChange={patch('description')} rows={2}
                    placeholder="What the dish is, in a sentence or two" className={area} disabled={busy} />
            </div>

            <div>
                <label className={label}>Link</label>
                <Input value={form.link} onChange={patch('link')} placeholder="Dish page or recipe URL (optional)" className={field} disabled={busy} />
            </div>

            <div>
                <label className={label}>Notes</label>
                <textarea value={form.notes} onChange={patch('notes')} rows={2}
                    placeholder="Your own notes" className={area} disabled={busy} />
            </div>

            <div>
                <label className={label}>Image</label>
                <div className="flex items-center gap-1.5">
                    {pendingImage && (
                        <div className="relative shrink-0">
                            <img src={pendingImage} alt="Dish" className="h-10 w-10 rounded-md object-cover border border-border" />
                            <button
                                type="button"
                                onClick={() => setPendingImage(null)}
                                title="Remove image"
                                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    )}
                    <Input
                        value={form.imageUrl}
                        onChange={patch('imageUrl')}
                        onPaste={onImagePaste}
                        placeholder={pendingImage ? 'Image added' : 'Image: link, paste or upload'}
                        className="h-10 text-sm min-w-0"
                        disabled={busy || !!pendingImage}
                    />
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Upload image"
                        disabled={busy}
                        className="h-10 w-10 shrink-0 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-accent hover:border-accent flex items-center justify-center"
                    >
                        <Upload size={14} />
                    </button>
                </div>
                {imageStatus && <p className="text-[10px] text-muted-foreground mt-1 ml-1">{imageStatus}</p>}
            </div>

            {flash && <p className="text-sm font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">{flash}</p>}
            {error && <p className="text-sm font-medium text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{error}</p>}

            <Button type="submit" disabled={!canSubmit} className="w-full h-11 rounded-xl">
                {busy ? <><Loader2 size={16} className="animate-spin" /> Adding…</> : <><Plus size={16} /> Add dish</>}
            </Button>
        </form>
    )
}
