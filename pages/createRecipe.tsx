import { useEffect, useState, useMemo, useRef, FormEvent, ChangeEvent } from 'react'
import Router, { useRouter } from 'next/router'
import { Layout } from '../components/Layout'
import { fileToBase64 } from '../lib/recipeImage'
import { parseRecipeImport, mapRecipeFileToEditor } from '../lib/recipeFile'
import { quantity_unit_conversions, getShorthandForMeasure } from '../lib/conversion'
import { extractRecipeFromImage, extractRecipeFromNotes, saveRecipe, normalizeIngredientsForSave, formatImportedIngredients, Ingredient, getEachUnitIngredientNames, warmIngredientConversions } from '../lib/recipeExtraction'
import { useAuthGuard } from '../lib/useAuthGuard'
import RecipeIngredientInput from '../components/RecipeIngredientInput'
import {
    Camera, Globe, Share2, NotebookPen, Pencil, ChevronLeft, ChevronDown, ShoppingBasket,
    ListOrdered, SlidersHorizontal, Check, Loader2, Trash2, Images, GripVertical, MoreHorizontal, Wand2, FileJson
} from 'lucide-react'
import { normalizePrepWords } from '../lib/recipeNormalize'

interface Instruction {
    Text: string
    Note?: string
}

type CreationMethod = 'url' | 'notes' | 'manual' | 'image' | 'social' | 'file'

const PACKAGE_UNITS = ["can", "bottle", "package", "stick", "bunch", "head", "stalk", "stem", "bag", "box", "tray", "tub"]
const UNIT_OPTIONS = Object.keys(quantity_unit_conversions).filter(item => !PACKAGE_UNITS.includes(item))

// Neutral chip style shared with the recipe detail page — colour stays
// reserved for primary actions. (Solid vars only: opacity modifiers on
// var()-based tokens don't compile in this Tailwind setup.)
const CHIP_META = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary text-foreground border border-border'

// Compact labels for the collapsed Details summary chips
const TIME_LABELS: Record<string, string> = { short: 'Quick', medium: 'Standard', long: 'Slow cook' }

// Borderless inline-edit input (same pattern as the detail page's editable rows)
const inlineInputClass = 'bg-transparent border-b border-border focus:border-accent outline-none text-foreground py-1 transition-colors'

const SOURCE_OPTIONS: { key: CreationMethod; label: string; hint: string; icon: any }[] = [
    { key: 'image', label: 'Photo', hint: 'Snap or upload a recipe photo', icon: Camera },
    { key: 'url', label: 'Web', hint: 'Taste, RecipeTin Eats, VegKit', icon: Globe },
    { key: 'social', label: 'Social', hint: 'Facebook posts and shares', icon: Share2 },
    { key: 'notes', label: 'AI Notes', hint: 'Paste text, AI sorts it out', icon: NotebookPen },
    { key: 'file', label: 'Import file', hint: 'Load an exported recipe .json', icon: FileJson },
    { key: 'manual', label: 'Manual', hint: 'Build it from scratch', icon: Pencil },
]

interface IngredientRowProps {
    ingred: Ingredient
    index: number
    onChange: (index: number, patch: Partial<Ingredient>) => void
    onRemove: (index: number) => void
    conversionPending?: boolean
}

// One ingredient as a calm reading row (detail-page style); tapping the row
// switches to inline borderless editing
function IngredientRow({ ingred, index, onChange, onRemove, conversionPending }: IngredientRowProps) {
    const [editing, setEditing] = useState(false)
    const displayUnit = getShorthandForMeasure(String(ingred.AmountType))

    if (!editing) {
        return (
            <div className="group flex items-center gap-3 py-3 border-b border-border last:border-b-0">
                <span className="text-muted-foreground shrink-0 select-none" aria-hidden>&bull;</span>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(true)} title="Tap to edit">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[15px] sm:text-base font-semibold text-foreground break-words">{ingred.Name}</span>
                        <span className="text-sm text-muted-foreground font-medium tabular-nums">
                            {String(ingred.Amount)} {displayUnit}
                        </span>
                        {conversionPending && (
                            <span className="inline-block w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" title="Resolving standard conversion…" />
                        )}
                    </div>
                    {ingred.Note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{ingred.Note}</p>}
                </div>
                <button
                    onClick={() => onRemove(index)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5 shrink-0"
                    title="Remove ingredient"
                    aria-label={`Remove ${ingred.Name}`}
                >
                    <Trash2 size={15} />
                </button>
            </div>
        )
    }

    return (
        <div className="py-3 border-b border-border last:border-b-0 space-y-2">
            <div className="flex items-end gap-2">
                <input
                    value={ingred.Name}
                    onChange={(e) => onChange(index, { Name: e.target.value })}
                    placeholder="Ingredient name"
                    className={`flex-1 min-w-0 text-[15px] font-semibold ${inlineInputClass}`}
                    autoFocus
                />
                <button onClick={() => setEditing(false)} className="text-xs font-bold text-accent hover:text-emerald-400 transition-colors px-2 py-1.5 shrink-0">
                    Done
                </button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
                <input
                    value={String(ingred.Amount)}
                    onChange={(e) => onChange(index, { Amount: e.target.value })}
                    placeholder="Amount"
                    inputMode="decimal"
                    className={`w-20 text-sm tabular-nums ${inlineInputClass}`}
                />
                <select
                    value={ingred.AmountType}
                    onChange={(e) => onChange(index, { AmountType: e.target.value })}
                    className="bg-secondary text-foreground rounded-lg px-2 py-1.5 focus:outline-none text-sm"
                >
                    {(UNIT_OPTIONS.includes(ingred.AmountType) ? UNIT_OPTIONS : [ingred.AmountType, ...UNIT_OPTIONS]).map(u => (
                        <option key={u} value={u}>{u}</option>
                    ))}
                </select>
                <input
                    value={ingred.Note || ''}
                    onChange={(e) => onChange(index, { Note: e.target.value })}
                    placeholder="Prep work & notes (e.g. chopped)"
                    className={`flex-1 min-w-[8rem] text-sm ${inlineInputClass}`}
                />
                <button
                    onClick={() => onRemove(index)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5 shrink-0"
                    title="Remove ingredient"
                >
                    <Trash2 size={15} />
                </button>
            </div>
        </div>
    )
}

interface StepRowProps {
    instruction: Instruction
    index: number
    dragging?: boolean
    onDragStart: (e: React.PointerEvent, index: number) => void
    onDragMove: (e: React.PointerEvent) => void
    onDragEnd: () => void
    onChange: (index: number, patch: Partial<Instruction>) => void
    onRemove: (index: number) => void
}

// One numbered step, matching the detail page's timeline; tap to edit inline,
// drag the grip handle to reorder
function StepRow({ instruction, index, dragging = false, onDragStart, onDragMove, onDragEnd, onChange, onRemove }: StepRowProps) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const [noteDraft, setNoteDraft] = useState('')

    const startEdit = () => {
        setDraft(instruction.Text)
        setNoteDraft(instruction.Note || '')
        setEditing(true)
    }

    const gripHandle = (
        <button
            type="button"
            onPointerDown={(e) => onDragStart(e, index)}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="shrink-0 self-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-colors"
            style={{ touchAction: 'none' }}
            title="Drag to reorder"
            aria-label={`Reorder step ${index + 1}`}
        >
            <GripVertical size={14} />
        </button>
    )

    if (!editing) {
        return (
            <div data-step-index={index} className={`flex gap-2 sm:gap-3 group ${dragging ? 'opacity-50' : ''}`}>
                {gripHandle}
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-sm font-bold text-foreground">
                    {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                    <p
                        onClick={startEdit}
                        title="Tap to edit"
                        className="text-foreground leading-relaxed text-[15px] sm:text-base font-medium cursor-pointer"
                    >
                        {instruction.Text}
                    </p>
                    {instruction.Note && <p className="mt-1 text-xs text-muted-foreground">{instruction.Note}</p>}
                </div>
                <button
                    onClick={() => onRemove(index)}
                    className="self-start text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    title="Delete step"
                    aria-label={`Delete step ${index + 1}`}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        )
    }

    return (
        <div data-step-index={index} className={`flex gap-2 sm:gap-3 ${dragging ? 'opacity-50' : ''}`}>
            {gripHandle}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-sm font-bold text-emerald-400">
                {index + 1}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    autoFocus
                    className={`w-full resize-none text-[15px] leading-relaxed font-medium ${inlineInputClass}`}
                />
                <input
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Step note (optional) — e.g. medium heat, 5 mins"
                    className={`w-full text-xs ${inlineInputClass}`}
                />
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            const text = draft.trim()
                            if (!text) return
                            onChange(index, { Text: text, Note: noteDraft.trim() })
                            setEditing(false)
                        }}
                        className="text-xs font-bold text-accent hover:text-emerald-400 transition-colors"
                    >
                        Save
                    </button>
                    <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function CreateRecipe() {
    const isAuthed = useAuthGuard()
    const [ingreds, setIngreds] = useState<Ingredient[]>([])
    const [instructions, setInstructions] = useState<Instruction[]>([])
    const [loading, setLoading] = useState(false)
    const [imageData, setImageData] = useState<string | undefined>()
    const [recipeName, setRecipeName] = useState("")
    const [recipeTime, setRecipeTime] = useState<string>("")
    const [recipeGenre, setRecipeGenre] = useState<string>("")
    const [recipeMealTypes, setRecipeMealTypes] = useState<string[]>([])
    const [recipeCarbType, setRecipeCarbType] = useState<string>("")
    const [recipeServings, setRecipeServings] = useState<number | string>("")
    const [recipeSourceUrl, setRecipeSourceUrl] = useState("")
    const [recipeNotes, setRecipeNotes] = useState("")
    const [isExtracting, setIsExtracting] = useState(false)
    const [creationMethod, setCreationMethod] = useState<CreationMethod | null>(null)
    const [imageNotes, setImageNotes] = useState("")
    const [extractImage, setExtractImage] = useState<string | undefined>()
    const [formPhase, setFormPhase] = useState<'setup' | 'name' | 'builder'>('setup')
    const [extractionStatus, setExtractionStatus] = useState("")
    const [pendingConversions, setPendingConversions] = useState<string[]>([])

    // Quick-add step draft
    const [stepDraft, setStepDraft] = useState("")
    const [stepNoteDraft, setStepNoteDraft] = useState("")

    // Details section starts collapsed for new recipes; edit mode opens it
    const [showDetails, setShowDetails] = useState(false)

    const router = useRouter();
    const { id } = router.query || {};
    const isEditMode = id !== undefined;

    // Sticky section nav with scroll-spy (same pattern as the detail page)
    const navSections = useMemo(() => ([
        { id: 'ingredients', label: 'Ingredients', icon: ShoppingBasket },
        { id: 'steps', label: 'Steps', icon: ListOrdered },
        { id: 'details', label: 'Details', icon: SlidersHorizontal },
    ]), [])
    const [activeSection, setActiveSection] = useState('ingredients')
    const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({})

    useEffect(() => {
        if (formPhase !== 'builder') return
        let raf = 0
        const update = () => {
            raf = 0
            // A section counts as "current" once its top passes the nav line
            const marker = 120
            let current = navSections[0]?.id || 'ingredients'
            for (const s of navSections) {
                const el = document.querySelector(`[data-section="${s.id}"]`)
                if (!el) continue
                if (el.getBoundingClientRect().top <= marker) current = s.id
            }
            const doc = document.documentElement
            if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
                current = navSections[navSections.length - 1]?.id || current
            }
            setActiveSection(prev => (prev === current ? prev : current))
        }
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(update)
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        update()
        return () => {
            window.removeEventListener('scroll', onScroll)
            if (raf) cancelAnimationFrame(raf)
        }
    }, [formPhase, navSections])

    // Keep the active pill visible in the scrollable row
    useEffect(() => {
        pillRefs.current[activeSection]?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }, [activeSection])

    // Land at the top whenever a phase opens
    useEffect(() => {
        if (formPhase !== 'setup') window.scrollTo({ top: 0 })
    }, [formPhase])

    const scrollToSection = (section: string) => {
        if (section === 'details') setShowDetails(true)
        const el = document.querySelector(`[data-section="${section}"]`) as HTMLElement | null
        if (!el) return
        el.classList.remove('group-flash')
        void el.offsetWidth
        el.classList.add('group-flash')
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Drag-to-reorder steps (pointer events so it works with touch + mouse).
    // Rows swap live as the pointer crosses a neighbour's midpoint.
    const stepDragRef = useRef<{ from: number; cur: number } | null>(null)
    const [draggingStepIndex, setDraggingStepIndex] = useState<number | null>(null)

    const beginStepDrag = (e: React.PointerEvent, index: number) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        e.preventDefault()
        stepDragRef.current = { from: index, cur: index }
        setDraggingStepIndex(index)
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
    }

    const moveStepDrag = (e: React.PointerEvent) => {
        const st = stepDragRef.current
        if (!st) return
        const y = e.clientY
        let target = st.cur
        document.querySelectorAll<HTMLElement>('[data-step-index]').forEach(row => {
            const j = Number(row.getAttribute('data-step-index'))
            if (Number.isNaN(j) || j === st.cur) return
            const r = row.getBoundingClientRect()
            const mid = r.top + r.height / 2
            if (st.cur < j && y > mid && j > target) target = j
            if (st.cur > j && y < mid && j < target) target = j
        })
        if (target !== st.cur) {
            const from = st.cur
            st.cur = target
            setDraggingStepIndex(target)
            setInstructions(prev => {
                const next = [...prev]
                const [moved] = next.splice(from, 1)
                next.splice(target, 0, moved)
                return next
            })
        }
    }

    const endStepDrag = () => {
        if (!stepDragRef.current) return
        stepDragRef.current = null
        setDraggingStepIndex(null)
    }

    async function generateImage(recipeName: string) {
        try {
            if (recipeName !== undefined && recipeName !== "") {
                // First, get a better prompt from Groq
                const token = localStorage.getItem('Token')
                const promptRes = await fetch(`/api/ai/generate_image_prompt?recipeName=${encodeURIComponent(recipeName)}`, {
                    headers: { 'edgetoken': token || '' }
                })
                const promptData = await promptRes.json()
                const refinedPrompt = promptData.success ? promptData.prompt : recipeName;
                const generatedImage = promptData.success ? promptData.image : null;

                console.log("Refined Prompt:", refinedPrompt)

                if (generatedImage) {
                    setImageData(generatedImage)
                    setLoading(false)
                    return generatedImage
                }

                // Fallback for whatever reason if Gemini didn't return an image but we have a prompt
                console.warn("Gemini image failed, no fallback provided for now.")
                setLoading(false)
                return undefined
            } else {
                alert("Please set a Recipe Name")
            }
        } catch (e) {
            console.error("Error generating image:", e)
            setLoading(false)
        }
    }

    const confirmOverwrite = () => {
        if (ingreds.length > 0 || instructions.length > 0) {
            return confirm("This will overwrite your current ingredients and instructions. Are you sure you want to proceed?");
        }
        return true;
    }

    // Fire-and-forget: warm the IngredientConversion table for 'each'-unit rows
    // (table lookup first, AI query only on a miss) so pricing/nutrition resolve
    // downstream. Rows are never modified failures are left for manual entry.
    const startConversionWarmup = (list: Ingredient[]) => {
        const names = getEachUnitIngredientNames(list)
        if (names.length === 0) return
        setPendingConversions(prev => Array.from(new Set([...prev, ...names])))
        warmIngredientConversions(names)
            .then(results => {
                const settled = new Set(results.map(r => r.name.toLowerCase()))
                setPendingConversions(prev => prev.filter(n => !settled.has(n.toLowerCase())))
            })
            .catch(() => setPendingConversions([]))
    }

    const handleContinue = () => {
        if (!recipeName.trim()) {
            alert("Please enter a Recipe Name first!");
            return;
        }
        setFormPhase('builder');
    }

    const handleBack = () => {
        setFormPhase('setup');
    }

    const handleRecipeFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        // Reset so re-selecting the same file re-triggers the change event
        e.target.value = ""
        if (!file) return
        if (!confirmOverwrite()) return
        try {
            const parsed = parseRecipeImport(await file.text())
            if (parsed.ok === false) {
                alert(parsed.error)
                return
            }
            const mapped = mapRecipeFileToEditor(parsed.recipe)
            setRecipeName(mapped.name)
            setIngreds(mapped.ingredients)
            setInstructions(mapped.instructions)
            setRecipeTime(mapped.time)
            setRecipeGenre(mapped.genre)
            setRecipeMealTypes(mapped.mealTypes)
            setRecipeCarbType(mapped.carbType)
            setRecipeServings(mapped.servings)
            setRecipeSourceUrl(mapped.sourceUrl)
            if (parsed.recipe.image) setImageData(parsed.recipe.image)
            startConversionWarmup(mapped.ingredients)
            setFormPhase('builder')
        } catch (importError: any) {
            console.error("Import error:", importError)
            alert("An error occurred while importing the recipe file.")
        }
    }

    const onSubmitRecipe = async () => {
        if (!recipeName.trim()) {
            alert("Please enter a recipe name first!")
            return
        }
        setLoading(true)

        // Image generation no longer blocks the save — the recipe is saved
        // first (without an image), then art is generated in the background
        // via Pollinations and patched onto the recipe when it completes.
        try {
            if (isEditMode) {
                const token = localStorage.getItem('Token')
                const res = await fetch(`/api/Recipe/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'edgetoken': token || ''
                    },
                    body: JSON.stringify({
                        "ingreds": normalizeIngredientsForSave(ingreds),
                        "instructions": instructions,
                        "image": imageData,
                        "name": recipeName,
                        "time": recipeTime || undefined,
                        "genre": recipeGenre || undefined,
                        "mealTypes": recipeMealTypes,
                        "carbType": recipeCarbType || undefined,
                        "servings": recipeServings !== "" ? Number(recipeServings) : undefined,
                        "sourceUrl": recipeSourceUrl || undefined,
                        "prepWorkChecked": false
                    })
                })
                const data = await res.json()
                if (data.success === false || data.success === undefined) {
                    alert(data.message || "failed, unexpected error")
                } else {
                    if (!imageData) generateImageInBackground(recipeName, Array.isArray(id) ? id[0] : (id as string))
                    Router.push("/recipes")
                }
            } else {
                const created = await saveRecipe({
                    name: recipeName,
                    ingreds,
                    instructions,
                    image: imageData,
                    time: recipeTime || undefined,
                    genre: recipeGenre || undefined,
                    mealTypes: recipeMealTypes,
                    carbType: recipeCarbType || undefined,
                    servings: recipeServings !== "" ? Number(recipeServings) : undefined,
                    sourceUrl: recipeSourceUrl || undefined
                })
                if (!imageData && created?._id) generateImageInBackground(recipeName, created._id)
                Router.push("/recipes")
            }
        } catch (error: any) {
            console.error("Error saving recipe:", error)
            alert(error?.message || "failed, unexpected error")
        } finally {
            setLoading(false)
        }
    }

    // Fire-and-forget: generate recipe art after the recipe is saved (only
    // when the saved recipe has no image yet) and patch it onto the record.
    const generateImageInBackground = (name: string, recipeId: string) => {
        generateImage(name)
            .then(img => {
                if (!img) return
                return fetch(`/api/Recipe/${recipeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'edgetoken': localStorage.getItem('Token') || ''
                    },
                    body: JSON.stringify({ image: img })
                })
            })
            .then(res => res && console.log('Background recipe image saved:', res.ok))
            .catch(e => console.error('Background image generation failed:', e))
    }

    const onSubmitRecipeSiteImport = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const token = localStorage.getItem('Token')
        const target = e.target as typeof e.target & {
            tasteURL: { value: string }
        }
        const tasteURL = target.tasteURL.value
        let siteProvider = ""

        if (tasteURL.includes("taste")) {
            siteProvider = "taste";
        } else if (tasteURL.includes("recipetineats")) {
            siteProvider = "recipetineats";
        } else if (tasteURL.includes("vegkit")) {
            siteProvider = "vegKit";
        } else {
            alert("Site provider not implemented")
            return
        }

        if (!confirmOverwrite()) return;

        setRecipeSourceUrl(tasteURL)
        setLoading(true)
        try {
            const res = await fetch(`/api/recipeSiteExtract/${siteProvider}?url=${tasteURL}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': token || ''
                }
            })
            const data = await res.json()

            if (data.success) {
                // Ask the AI to split the core ingredient from prep work
                // ("chopped garlic" -> garlic + note "chopped") and clean the
                // rows up. On any failure we keep the original raw parse.
                const rawIngreds = data.data.ingredients.filter((ingred: any) => ingred.converted !== undefined)
                let tasteIngredsList: Ingredient[] = rawIngreds.map((ingred: any) => ({
                    "Name": ingred.converted.name,
                    "Amount": ingred.converted.quantity,
                    "AmountType": ingred.converted.quantity_unit,
                    "Note": "Imported from Taste"
                }))
                try {
                    const formatted = await formatImportedIngredients(rawIngreds.map((ingred: any) => ingred.converted))
                    if (formatted) {
                        tasteIngredsList = formatted
                    }
                } catch (formatError) {
                    console.error("Ingredient formatting failed, using raw parse:", formatError)
                }
                setIngreds(tasteIngredsList)

                let tasteInstructionList: Instruction[] = []
                data.data.instructions.forEach(function (instruction: any) {
                    // Order is the array position (shown as the number chip) —
                    // storing the step number in the note just renders "1", "2"…
                    // under each step
                    tasteInstructionList.push({ "Text": instruction.instruction })
                })
                setInstructions(tasteInstructionList)

                const importedName = data.data.name
                if (importedName) {
                    setRecipeName(importedName)
                }
                // No name in the source? Ask for it before the editor
                setFormPhase(importedName ? 'builder' : 'name')
            } else {
                alert(data.message || "Failed to import from site.")
            }
        } catch (error) {
            console.error("Import error:", error)
            alert("An error occurred during import.")
        }
        setLoading(false)
    }

    const onSubmitFacebookImport = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const target = e.target as typeof e.target & {
            tasteURL: { value: string }
        }
        const fbUrl = target.tasteURL.value

        if (!confirmOverwrite()) return;

        // Remember where the recipe came from so it can be re-watched later
        setRecipeSourceUrl(fbUrl)
        setLoading(true)
        try {
            const token = localStorage.getItem('Token')
            const res = await fetch(`/api/recipeSiteExtract/facebook?url=${encodeURIComponent(fbUrl)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': token || ''
                }
            })
            const data = await res.json()
            if (!data.success) {
                throw new Error(data.message || "Failed to import from Facebook.")
            }

            const { description, image } = data.data || {}
            if (!description) {
                throw new Error("Couldn't find a description on that post check the link is public.")
            }

            // Keep the raw caption in the notes box so it can be reviewed or
            // re-parsed via the AI Notes flow if auto-extraction ever fails.
            setRecipeNotes(description)
            if (image) setImageData(image)

            try {
                const result = await extractRecipeFromNotes(description)
                const { name, ingredients, instructions, time, genre, mealTypes, servings, carbType } = result

                if (name) setRecipeName(name)
                if (ingredients) {
                    setIngreds(ingredients)
                    startConversionWarmup(ingredients)
                }
                if (instructions) setInstructions(instructions)
                if (time) setRecipeTime(time)
                if (genre) setRecipeGenre(genre)
                if (mealTypes) setRecipeMealTypes(mealTypes)
                if (carbType) setRecipeCarbType(carbType)
                if (servings) setRecipeServings(servings)

                // No name in the post? Ask for it before the editor
                setFormPhase(name ? 'builder' : 'name')
            } catch (extractError) {
                console.error("Facebook AI extraction error:", extractError)
                throw new Error("Got the post description, but AI parsing failed. The raw text is saved in AI Notes try Extract & Continue there.")
            }
        } catch (error: any) {
            console.error("Facebook import error:", error)
            alert(error?.message || "An error occurred during import.")
        }
        setLoading(false)
    }

    const onSubmitNotesExtract = async () => {
        if (!recipeNotes.trim()) {
            alert("Please paste some notes first!")
            return
        }

        if (!confirmOverwrite()) return;

        setIsExtracting(true)
        try {
            const result = await extractRecipeFromNotes(recipeNotes)
            const { name, ingredients, instructions, time, genre, mealTypes, servings, carbType } = result

            if (name) setRecipeName(name)
            if (ingredients) {
                setIngreds(ingredients)
                startConversionWarmup(ingredients)
            }
            if (instructions) setInstructions(instructions)
            if (time) setRecipeTime(time)
            if (genre) setRecipeGenre(genre)
            if (mealTypes) setRecipeMealTypes(mealTypes)
            if (carbType) setRecipeCarbType(carbType)
            if (servings) setRecipeServings(servings)

            setRecipeNotes("") // Clear notes after successful extraction
            // No name in the notes? Ask for it before the editor
            setFormPhase(name ? 'builder' : 'name')
            alert("Recipe extracted successfully!")
        } catch (error) {
            console.error("Extraction error:", error)
            alert("An error occurred during extraction.")
        }
        setIsExtracting(false)
    }

    const onSubmitImageExtract = async () => {
        if (!extractImage) {
            alert("Please provide an image first!")
            return
        }

        if (!confirmOverwrite()) return;

        setIsExtracting(true)
        setExtractionStatus("Analyzing visual data...")
        try {
            // Artificial delay for first step to show status
            setTimeout(() => setExtractionStatus("Uploading to Gemini Vision..."), 800);

            setExtractionStatus("Extracting recipe details...")
            const result = await extractRecipeFromImage(extractImage, imageNotes)

            setExtractionStatus("Finalizing recipe structure...")
            const { name, ingredients, instructions, time, genre, mealTypes, servings, carbType } = result

            if (name) setRecipeName(name)
            if (ingredients) {
                setIngreds(ingredients)
                startConversionWarmup(ingredients)
            }
            if (instructions) setInstructions(instructions)
            if (time) setRecipeTime(time)
            if (genre) setRecipeGenre(genre)
            if (mealTypes) setRecipeMealTypes(mealTypes)
            if (carbType) setRecipeCarbType(carbType)
            if (servings) setRecipeServings(servings)
            setImageData(extractImage)

            setExtractImage(undefined)
            setImageNotes("")
            // No name in the photo? Ask for it before the editor
            setFormPhase(name ? 'builder' : 'name')
            alert("Recipe extracted successfully!")
        } catch (error: any) {
            console.error("[AI-Extract-Client] Process Error:", error);
            alert(`Extraction Error: ${error?.message || String(error)}`);
        }
        setIsExtracting(false)
        setExtractionStatus("")
    }

    const addStep = () => {
        const text = stepDraft.trim()
        if (!text) return
        setInstructions([...instructions, { Text: text, Note: stepNoteDraft.trim() || "" }])
        setStepDraft("")
        setStepNoteDraft("")
    }

    const updateIngredient = (index: number, patch: Partial<Ingredient>) => {
        setIngreds(prev => prev.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)))
    }

    const removeIngredient = (index: number) => {
        setIngreds(prev => prev.filter((_, i) => i !== index))
    }

    const updateInstruction = (index: number, patch: Partial<Instruction>) => {
        setInstructions(prev => prev.map((inst, i) => (i === index ? { ...inst, ...patch } : inst)))
    }

    // "Sanitise ingredients": run the current list through the AI formatter so
    // prep work moves out of the name into the note ("chopped garlic" ->
    // garlic + note "chopped"). Creation-time helper — user can re-edit after.
    const [ingredMenuOpen, setIngredMenuOpen] = useState(false)
    const [sanitising, setSanitising] = useState(false)

    const sanitiseIngredients = async () => {
        if (ingreds.length === 0 || sanitising) return
        setSanitising(true)
        try {
            const formatted = await formatImportedIngredients(
                ingreds.map(i => ({ name: i.Name, quantity: i.Amount, quantity_unit: i.AmountType }))
            )
            if (formatted) {
                // Keep any notes the user already added — zip by position
                // (the endpoint returns exactly one row per input, in order)
                setIngreds(formatted.map((row, i) => {
                    const origNote = String(ingreds[i]?.Note || '').trim()
                    const newNote = String(row.Note || '').trim()
                    const combined = origNote && newNote && !newNote.toLowerCase().includes(origNote.toLowerCase())
                        ? `${newNote}, ${origNote}`
                        : newNote || origNote
                    return { ...row, Note: combined || undefined }
                }))
            } else {
                // AI unavailable — deterministic prep-word split, no network
                setIngreds(normalizePrepWords(ingreds))
            }
        } finally {
            setSanitising(false)
        }
    }

    const removeInstruction = (index: number) => {
        setInstructions(prev => prev.filter((_, i) => i !== index))
    }

    const handleExtractImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) fileToBase64(e.target.files[0], setExtractionStatus).then(setExtractImage)
    }

    const handleRecipeImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) fileToBase64(e.target.files[0], setExtractionStatus).then(setImageData)
    }

    const handleIngredientAdded = (ing: Ingredient) => {
        setIngreds(prev => [...prev, ing])
        startConversionWarmup([ing])
    }

    const isConversionPending = (ing: Ingredient) =>
        (ing.AmountType || '').toLowerCase() === 'each'
        && pendingConversions.some(p => p.trim().toLowerCase() === (ing.Name || '').trim().toLowerCase())

    useEffect(() => {
        const fetchRecipeForEdit = async () => {
            if (isEditMode) {
                setLoading(true)
                try {
                    const res = await fetch(`/api/Recipe/${id}`, {
                        headers: { 'edgetoken': localStorage.getItem('Token') || '' }
                    })
                    const data = await res.json()
                    if (data.res) {
                        setRecipeName(data.res.name)
                        setImageData(data.res.image)
                        setRecipeTime(data.res.time || "")
                        setRecipeGenre(data.res.genre || "")
                        setRecipeMealTypes(data.res.mealTypes || [])
                        setRecipeCarbType(data.res.carbType || "")
                        setRecipeServings(data.res.servings || "")
                        setRecipeSourceUrl(data.res.sourceUrl || "")
                        setInstructions(data.res.instructions.map((i: any) => ({
                            Text: i.Text,
                            // Legacy site imports stored the step number in the
                            // note — redundant (position is the order), so drop
                            // purely-numeric notes on load
                            Note: i.note && !/^\d+$/.test(String(i.note).trim()) ? i.note : undefined
                        })))
                        setIngreds(data.res.ingredients.map((i: any) => ({
                            Name: i.name,
                            Amount: i.quantity,
                            AmountType: i.quantity_type,
                            Note: i.note
                        })))
                    }
                } catch (error) {
                    console.error("Error fetching recipe for edit:", error)
                }
                setLoading(false)
            }
        }
        if (id) fetchRecipeForEdit()
    }, [id])

    // Always show full form in edit mode
    useEffect(() => {
        if (isEditMode) {
            setCreationMethod('manual');
            setFormPhase('builder');
            setShowDetails(true);
        }
    }, [isEditMode]);

    if (!isAuthed) return null

    const primaryBtnClass = "w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"

    // Compact summary of the filled metadata, shown as chips while Details is collapsed
    const servingCount = recipeServings !== '' && recipeServings != null ? Number(recipeServings) : 0
    const detailsSummary = [
        TIME_LABELS[recipeTime] || '',
        recipeGenre,
        servingCount > 0 ? `${servingCount} serving${servingCount === 1 ? '' : 's'}` : '',
        ...recipeMealTypes,
        recipeCarbType
    ].filter(Boolean)

    return (
        <Layout title={isEditMode ? "Edit Recipe" : "Create Recipe"} description={isEditMode ? "Modify your recipe" : "Add a new recipe to your collection"}>
            {formPhase === 'setup' ? (
                /* =========================================================
                   Phase 1 — Setup: name the recipe, pick how to start
                   ========================================================= */
                <div className="min-[769px]:-mx-6 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-card text-card-foreground overflow-hidden">
                        <div className="recipe-band px-4 sm:px-8 pt-4 pb-3">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                {isEditMode ? 'Edit recipe' : 'New recipe'}
                            </p>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight tracking-tight text-foreground">
                                {isEditMode ? 'Edit your recipe' : 'How would you like to start?'}
                            </h1>
                        </div>

                        {!isEditMode && (
                            <>
                                <div className="recipe-band px-4 sm:px-8 py-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">How are you starting?</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                        {SOURCE_OPTIONS.map(({ key, label, hint, icon: Icon }) => {
                                            const isActive = creationMethod === key
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        setCreationMethod(key)
                                                        // Manual jumps straight to the name step
                                                        if (key === 'manual') setFormPhase('name')
                                                    }}
                                                    className={`flex flex-col items-start gap-1.5 p-3.5 rounded-xl border text-left transition-all duration-200 ${isActive
                                                        ? 'bg-emerald-500/10 border-emerald-500/40'
                                                        : 'bg-secondary border-border hover:border-accent hover:bg-border'
                                                        }`}
                                                >
                                                    <Icon size={18} className={isActive ? 'text-emerald-400' : 'text-muted-foreground'} />
                                                    <span className="text-sm font-bold leading-tight text-foreground">{label}</span>
                                                    <span className="text-[11px] leading-snug text-muted-foreground hidden sm:block">{hint}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {creationMethod && (
                                    <div className="recipe-band px-4 sm:px-8 pb-6 pt-1">
                                        <div className="rounded-2xl bg-secondary p-4 sm:p-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {creationMethod === 'url' && (
                                                <form onSubmit={onSubmitRecipeSiteImport} className="space-y-3">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1">Recipe site link</label>
                                                    <input
                                                        name="tasteURL"
                                                        type="url"
                                                        required
                                                        placeholder="Paste a link (Taste, RecipeTin Eats, VegKit)…"
                                                        className="input-modern"
                                                    />
                                                    <button type="submit" disabled={loading} className={primaryBtnClass}>
                                                        {loading ? <><Loader2 size={16} className="animate-spin" /> Importing&#8230;</> : <><Globe size={16} /> Import & continue</>}
                                                    </button>
                                                </form>
                                            )}

                                            {creationMethod === 'social' && (
                                                <form onSubmit={onSubmitFacebookImport} className="space-y-3">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1">Social media link</label>
                                                    <input
                                                        name="tasteURL"
                                                        type="url"
                                                        required
                                                        placeholder="Paste a Facebook post link (fb.watch, facebook.com/share/…)…"
                                                        className="input-modern"
                                                    />
                                                    <button type="submit" disabled={loading} className={primaryBtnClass}>
                                                        {loading ? <><Loader2 size={16} className="animate-spin" /> Importing&#8230;</> : <><Share2 size={16} /> Import & continue</>}
                                                    </button>
                                                </form>
                                            )}

                                            {creationMethod === 'notes' && (
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1">Recipe snippet</label>
                                                    <textarea
                                                        value={recipeNotes}
                                                        onChange={(e) => setRecipeNotes(e.target.value)}
                                                        placeholder="Paste the ingredients or method here — messy is fine, the AI tidies it up."
                                                        className="input-modern min-h-[150px] resize-none"
                                                    />
                                                    <button type="button" onClick={onSubmitNotesExtract} disabled={isExtracting} className={primaryBtnClass}>
                                                        {isExtracting ? <><Loader2 size={16} className="animate-spin" /> AI is working&#8230;</> : <><NotebookPen size={16} /> Extract & continue</>}
                                                    </button>
                                                </div>
                                            )}

                                            {creationMethod === 'image' && (
                                                <div className="space-y-3">
                                                    {extractImage ? (
                                                        <label className="block relative w-full aspect-video rounded-xl overflow-hidden cursor-pointer group border border-border">
                                                            <input accept="image/*" type="file" className="hidden" onChange={handleExtractImageFile} />
                                                            <img src={extractImage} alt="Recipe preview" className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm">
                                                                Tap to change photo
                                                            </div>
                                                        </label>
                                                    ) : (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background py-7 cursor-pointer hover:border-accent hover:bg-border transition-all">
                                                                <input accept="image/*" capture="environment" type="file" className="hidden" onChange={handleExtractImageFile} />
                                                                <Camera size={20} className="text-muted-foreground" />
                                                                <span className="text-xs font-bold text-foreground">Camera</span>
                                                            </label>
                                                            <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background py-7 cursor-pointer hover:border-accent hover:bg-border transition-all">
                                                                <input accept="image/*" type="file" className="hidden" onChange={handleExtractImageFile} />
                                                                <Images size={20} className="text-muted-foreground" />
                                                                <span className="text-xs font-bold text-foreground">Gallery</span>
                                                            </label>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1 mb-2">Adaptation note (optional)</label>
                                                        <input
                                                            type="text"
                                                            value={imageNotes}
                                                            onChange={(e) => setImageNotes(e.target.value)}
                                                            placeholder="e.g. make it vegetarian, double the servings…"
                                                            className="input-modern"
                                                        />
                                                    </div>
                                                    <button type="button" onClick={onSubmitImageExtract} disabled={isExtracting} className={primaryBtnClass}>
                                                        <span className="flex items-center gap-2">
                                                            {isExtracting ? <><Loader2 size={16} className="animate-spin" /> Working on it&#8230;</> : <><Camera size={16} /> Extract from photo</>}
                                                        </span>
                                                        {extractionStatus && (
                                                            <span className="text-[10px] font-medium text-white/70 animate-pulse uppercase tracking-wider">
                                                                {extractionStatus}
                                                            </span>
                                                        )}
                                                    </button>
                                                </div>
                                            )}

                                            {creationMethod === 'file' && (
                                                <div className="space-y-3">
                                                    <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background py-7 cursor-pointer hover:border-accent hover:bg-border transition-all">
                                                        <input accept=".json,application/json" type="file" className="hidden" onChange={handleRecipeFileSelected} />
                                                        <FileJson size={20} className="text-muted-foreground" />
                                                        <span className="text-xs font-bold text-foreground">Choose an exported recipe file (.json)</span>
                                                    </label>
                                                    <p className="text-[11px] leading-snug text-muted-foreground text-center px-2">
                                                        The recipe fills the builder below — including its photo. Review it and save as usual.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {isEditMode && (
                            <div className="recipe-band px-4 sm:px-8 pb-6">
                                <button type="button" onClick={handleContinue} className={primaryBtnClass}>
                                    <Pencil size={16} /> Continue editing
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : formPhase === 'name' ? (
                /* =========================================================
                   Phase 1b — Name step: for manual creation, and as the
                   fallback when an import/AI extraction yields no name
                   ========================================================= */
                <div className="min-[769px]:-mx-6 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-card text-card-foreground overflow-hidden">
                        <div className="recipe-band px-4 sm:px-8 pt-4 pb-3">
                            <button
                                onClick={handleBack}
                                className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors mb-8"
                            >
                                <ChevronLeft size={15} /> Back
                            </button>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">New recipe</p>
                            <form onSubmit={(e) => { e.preventDefault(); if (recipeName.trim()) setFormPhase('builder') }}>
                                <input
                                    type="text"
                                    value={recipeName}
                                    onChange={(e) => setRecipeName(e.target.value)}
                                    placeholder="What are we cooking?"
                                    autoFocus
                                    className="w-full bg-transparent text-2xl sm:text-3xl md:text-4xl font-bold leading-tight tracking-tight outline-none text-foreground placeholder:text-muted-foreground rounded transition-colors focus:bg-background"
                                />
                                <p className="text-xs text-muted-foreground mt-3 mb-6">You can rename it any time.</p>
                                <button type="submit" disabled={!recipeName.trim()} className={primaryBtnClass}>
                                    <Pencil size={16} /> Start building
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            ) : (
                /* =========================================================
                   Phase 2 — Builder: full-bleed sections like /recipes/[id]
                   ========================================================= */
                <div className="min-[769px]:-mx-6 pb-4">
                    {/* Sticky section nav — back, sections, save */}
                    <nav className="recipe-nav" aria-label="Recipe sections">
                        {!isEditMode && (
                            <button
                                onClick={handleBack}
                                className="recipe-nav-pill"
                                title="Back to setup"
                                aria-label="Back to setup"
                            >
                                <ChevronLeft size={17} />
                            </button>
                        )}
                        {navSections.map(s => (
                            <button
                                key={s.id}
                                onClick={() => scrollToSection(s.id)}
                                className={`recipe-nav-pill ${activeSection === s.id ? 'is-active' : ''}`}
                                ref={(el) => { pillRefs.current[s.id] = el }}
                                title={s.label}
                                aria-label={s.label}
                            >
                                <s.icon size={17} />
                            </button>
                        ))}
                        <button
                            onClick={onSubmitRecipe}
                            disabled={loading}
                            className="recipe-nav-save"
                            title="Save recipe"
                            aria-label="Save recipe"
                        >
                            {loading ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                        </button>
                    </nav>

                    {/* Hero header: photo banner, inline title, counts */}
                    <header className="bg-card text-card-foreground overflow-hidden border-b border-border">
                        {imageData && (
                            <div className="relative h-44 sm:h-64 md:h-80 w-full">
                                <img src={imageData} alt={recipeName || 'Recipe photo'} className="w-full h-full object-cover" />
                                <button
                                    onClick={() => setImageData(undefined)}
                                    className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white text-[11px] px-2.5 py-1.5 rounded-full backdrop-blur-sm font-semibold transition-colors"
                                >
                                    Remove photo
                                </button>
                            </div>
                        )}
                        <div className="recipe-band px-4 sm:px-8 pt-4 pb-3">
                            <input
                                type="text"
                                value={recipeName}
                                onChange={(e) => setRecipeName(e.target.value)}
                                placeholder="Untitled recipe"
                                className="w-full bg-transparent text-2xl sm:text-3xl md:text-4xl font-bold leading-tight tracking-tight outline-none text-foreground placeholder:text-muted-foreground rounded transition-colors focus:bg-background"
                            />
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-sm font-semibold text-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <ShoppingBasket className="w-4 h-4 text-muted-foreground" />
                                    <span className="tabular-nums">{ingreds.length} ingredient{ingreds.length === 1 ? '' : 's'}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <ListOrdered className="w-4 h-4 text-muted-foreground" />
                                    <span className="tabular-nums">{instructions.length} step{instructions.length === 1 ? '' : 's'}</span>
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                <span className={CHIP_META}>
                                    {creationMethod === 'image' ? 'Photo import'
                                        : creationMethod === 'url' ? 'Web import'
                                        : creationMethod === 'social' ? 'Social import'
                                        : creationMethod === 'notes' ? 'AI notes import'
                                        : 'Manual'}
                                </span>
                                {imageData ? (
                                    <label className={`${CHIP_META} cursor-pointer hover:opacity-80 transition-opacity`}>
                                        <Camera size={11} /> Replace photo
                                        <input accept="image/*" type="file" className="hidden" onChange={handleRecipeImageFile} />
                                    </label>
                                ) : (
                                    <>
                                        <label className={`${CHIP_META} cursor-pointer hover:opacity-80 transition-opacity`}>
                                            <Camera size={11} /> Camera
                                            <input accept="image/*" capture="environment" type="file" className="hidden" onChange={handleRecipeImageFile} />
                                        </label>
                                        <label className={`${CHIP_META} cursor-pointer hover:opacity-80 transition-opacity`}>
                                            <Images size={11} /> Gallery
                                            <input accept="image/*" type="file" className="hidden" onChange={handleRecipeImageFile} />
                                        </label>
                                    </>
                                )}
                            </div>
                            {!imageData && (
                                <p className="text-[11px] text-muted-foreground mt-2">No photo? An AI cover is generated when you save.</p>
                            )}
                        </div>
                    </header>

                    <div className="bg-card text-card-foreground">
                        {/* Ingredients */}
                        <div data-section="ingredients" className="recipe-band recipe-section border-b border-border px-4 py-6 sm:px-8 sm:py-10">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 mb-5">
                                <ShoppingBasket className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight">Ingredients</h2>
                                <span className="text-xs text-muted-foreground">{ingreds.length} item{ingreds.length === 1 ? '' : 's'}</span>
                                {ingreds.length > 0 && (
                                    <div className="ml-auto relative">
                                        <button
                                            type="button"
                                            onClick={() => setIngredMenuOpen(v => !v)}
                                            disabled={loading || sanitising}
                                            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                            title="More actions"
                                            aria-label="Ingredient actions"
                                            aria-haspopup="menu"
                                            aria-expanded={ingredMenuOpen}
                                        >
                                            {sanitising ? <Loader2 size={16} className="animate-spin" /> : <MoreHorizontal size={16} />}
                                        </button>
                                        {ingredMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setIngredMenuOpen(false)} aria-hidden />
                                                <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-border bg-card shadow-2xl p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={() => { setIngredMenuOpen(false); sanitiseIngredients() }}
                                                        disabled={sanitising}
                                                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-foreground/85 hover:bg-secondary text-left transition-colors disabled:opacity-50"
                                                    >
                                                        {sanitising ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} className="text-muted-foreground" />}
                                                        Sanitise ingredients
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <RecipeIngredientInput onAdd={handleIngredientAdded} disabled={loading} />

                            <div className="mt-5">
                                {ingreds.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No ingredients yet search above, or import a recipe to fill this in.</p>
                                ) : (
                                    <div className="flex flex-col">
                                        {ingreds.map((ing, i) => (
                                            <IngredientRow
                                                key={i}
                                                ingred={ing}
                                                index={i}
                                                onChange={updateIngredient}
                                                onRemove={removeIngredient}
                                                conversionPending={isConversionPending(ing)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Steps */}
                        <div data-section="steps" className="recipe-band recipe-section border-b border-border px-4 py-6 sm:px-8 sm:py-10">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 mb-5">
                                <ListOrdered className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight">Steps</h2>
                                <span className="ml-auto text-xs text-muted-foreground">{instructions.length} step{instructions.length === 1 ? '' : 's'}</span>
                            </div>

                            {instructions.length > 0 && (
                                <div className="space-y-5 sm:space-y-6 mb-6">
                                    {instructions.map((instruction, index) => (
                                        <StepRow
                                            key={index}
                                            instruction={instruction}
                                            index={index}
                                            dragging={draggingStepIndex === index}
                                            onDragStart={beginStepDrag}
                                            onDragMove={moveStepDrag}
                                            onDragEnd={endStepDrag}
                                            onChange={updateInstruction}
                                            onRemove={removeInstruction}
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="rounded-2xl bg-secondary p-3.5 sm:p-4 space-y-3">
                                <textarea
                                    placeholder="What's the next step?"
                                    value={stepDraft}
                                    onChange={(e) => setStepDraft(e.target.value)}
                                    className="input-modern min-h-[80px] text-sm resize-none"
                                />
                                <input
                                    placeholder="Step note (optional) — e.g. medium heat, 5 mins"
                                    value={stepNoteDraft}
                                    onChange={(e) => setStepNoteDraft(e.target.value)}
                                    className="input-modern !py-2 text-xs"
                                />
                                <button type="button" onClick={addStep} disabled={!stepDraft.trim()} className={primaryBtnClass}>
                                    <Check size={16} /> Add step
                                </button>
                            </div>
                        </div>

                        {/* Details — collapsed by default for new recipes, expanded in edit mode */}
                        <div data-section="details" className="recipe-band px-4 py-6 sm:px-8 sm:py-10">
                            <button
                                type="button"
                                onClick={() => setShowDetails(v => !v)}
                                aria-expanded={showDetails}
                                className="w-full flex flex-wrap items-center gap-x-2.5 gap-y-2 text-left"
                            >
                                <SlidersHorizontal className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                                <span className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Details</span>
                                {showDetails ? (
                                    <span className="text-xs text-muted-foreground">optional — AI fills what it can</span>
                                ) : detailsSummary.length > 0 ? (
                                    <span className="flex flex-wrap gap-1.5">
                                        {detailsSummary.map((chip, i) => (
                                            <span key={i} className={CHIP_META}>{chip}</span>
                                        ))}
                                    </span>
                                ) : (
                                    <span className="text-xs text-muted-foreground">All optional — tap to add time, servings, cuisine…</span>
                                )}
                                <ChevronDown size={20} className={`ml-auto text-muted-foreground transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`} />
                            </button>

                            {showDetails && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mt-5 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1">Time</label>
                                    <select value={recipeTime} onChange={(e) => setRecipeTime(e.target.value)} className="input-modern">
                                        <option value="">Unknown</option>
                                        <option value="short">Zap (Under 30min)</option>
                                        <option value="medium">Standard (30-60min)</option>
                                        <option value="long">Slow Roast (60min+)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1">Servings</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={recipeServings}
                                        onChange={(e) => setRecipeServings(e.target.value)}
                                        placeholder="4"
                                        className="input-modern"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1">Cuisine</label>
                                    <select value={recipeGenre} onChange={(e) => setRecipeGenre(e.target.value)} className="input-modern">
                                        <option value="">Uncategorized</option>
                                        {['Italian', 'Mexican', 'Asian', 'Indian', 'Mediterranean', 'American', 'French', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Greek', 'Chinese', 'Vietnamese', 'Other'].map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1">Meal occasions</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Breakfast', 'Lunch', 'Main', 'Snack'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => recipeMealTypes.includes(type) ? setRecipeMealTypes(recipeMealTypes.filter(t => t !== type)) : setRecipeMealTypes([...recipeMealTypes, type])}
                                                className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${recipeMealTypes.includes(type)
                                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                                    : 'bg-secondary border-border text-muted-foreground hover:border-accent'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block ml-1">Carb type</label>
                                    <select value={recipeCarbType} onChange={(e) => setRecipeCarbType(e.target.value)} className="input-modern">
                                        <option value="">Uncategorized</option>
                                        {['Rice', 'Bread/Wraps', 'Pasta/Noodles', 'Potato', 'Quinoa', 'None/Other'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <div className="flex items-center justify-between ml-1">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Source link</label>
                                        {recipeSourceUrl && (
                                            <a href={recipeSourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-accent hover:underline">
                                                Open ↗
                                            </a>
                                        )}
                                    </div>
                                    <input
                                        type="url"
                                        value={recipeSourceUrl}
                                        onChange={(e) => setRecipeSourceUrl(e.target.value)}
                                        placeholder="Where this recipe came from (URL)"
                                        className="input-modern"
                                    />
                                </div>
                            </div>
                            )}
                        </div>
                    </div>

                    {/* Sticky save bar: always one tap away */}
                    <div className="sticky bottom-3 z-30 mt-6">
                        <div className="recipe-band px-4 sm:px-8">
                            <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3 pl-4 shadow-2xl shadow-black/40">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">{recipeName.trim() || 'Untitled recipe'}</p>
                                    <p className="text-[11px] text-muted-foreground tabular-nums">
                                        {ingreds.length} ingredient{ingreds.length === 1 ? '' : 's'}· {instructions.length} step{instructions.length === 1 ? '' : 's'}
                                    </p>
                                </div>
                                <button
                                    onClick={onSubmitRecipe}
                                    disabled={loading}
                                    className="h-12 px-5 sm:px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] shrink-0 disabled:opacity-50"
                                >
                                    {loading ? <><Loader2 size={16} className="animate-spin" /> Saving&#8230;</> : <><Check size={16} /> Save recipe</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
