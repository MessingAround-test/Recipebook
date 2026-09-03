import { useEffect, useState, FormEvent } from 'react'
import Head from 'next/head'
import Router, { useRouter } from 'next/router'
import { Layout } from '../components/Layout'
import { PageHeader } from '../components/PageHeader'
import { FormField } from '../components/FormField'
import { Button } from '../components/ui/button'
import { quantity_unit_conversions } from "../lib/conversion"
import { RiDeleteBin7Line, RiArrowDownSLine, RiArrowUpSLine } from 'react-icons/ri'
import IngredientEditor from '../components/IngredientEditor'
import { fileToBase64 } from '../lib/recipeImage'
import { extractRecipeFromImage, extractRecipeFromNotes, saveRecipe, Ingredient, getEachUnitIngredientNames, warmIngredientConversions } from '../lib/recipeExtraction'
import { useAuthGuard } from '../lib/useAuthGuard'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface Instruction {
    Text: string
    Note?: string
}

export default function CreateRecipe() {
    const isAuthed = useAuthGuard()
    const [ingreds, setIngreds] = useState<Ingredient[]>([])
    const [instructions, setInstructions] = useState<Instruction[]>([])
    const [loading, setLoading] = useState(false)
    const [imageData, setImageData] = useState<string | undefined>()
    const [recipeName, setRecipeName] = useState("")
    const [quantityTypes, setQuantityTypes] = useState({})
    const [recipeTime, setRecipeTime] = useState<string>("")
    const [recipeGenre, setRecipeGenre] = useState<string>("")
    const [recipeMealTypes, setRecipeMealTypes] = useState<string[]>([])
    const [recipeCarbType, setRecipeCarbType] = useState<string>("")
    const [recipeServings, setRecipeServings] = useState<number | string>("")
    const [recipeSourceUrl, setRecipeSourceUrl] = useState("")
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [recipeNotes, setRecipeNotes] = useState("")
    const [isExtracting, setIsExtracting] = useState(false)
    const [creationMethod, setCreationMethod] = useState<'url' | 'notes' | 'manual' | 'image' | 'social' | null>(null)
    const [imageNotes, setImageNotes] = useState("")
    const [extractImage, setExtractImage] = useState<string | undefined>()
    const [formPhase, setFormPhase] = useState<'setup' | 'builder'>('setup')
    const [extractionStatus, setExtractionStatus] = useState("")
    const [pendingConversions, setPendingConversions] = useState<string[]>([])

    const router = useRouter();
    const { id } = router.query || {};
    const isEditMode = id !== undefined;

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
    // downstream. Rows are never modified — failures are left for manual entry.
    const startConversionWarmup = (list: Ingredient[]) => {
        const names = getEachUnitIngredientNames(list)
        if (names.length === 0) return
        setPendingConversions(names)
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

    const onSubmitRecipe = async () => {
        setLoading(true)
        let localImage: string | undefined;

        if (imageData === undefined) {
            localImage = await generateImage(recipeName)
        } else {
            localImage = imageData
        }

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
                        "ingreds": ingreds,
                        "instructions": instructions,
                        "image": localImage,
                        "name": recipeName,
                        "time": recipeTime || undefined,
                        "genre": recipeGenre || undefined,
                        "mealTypes": recipeMealTypes,
                        "carbType": recipeCarbType || undefined,
                        "servings": recipeServings !== "" ? Number(recipeServings) : undefined,
                        "sourceUrl": recipeSourceUrl || undefined
                    })
                })
                const data = await res.json()
                if (data.success === false || data.success === undefined) {
                    alert(data.message || "failed, unexpected error")
                } else {
                    Router.push("/recipes")
                }
            } else {
                await saveRecipe({
                    name: recipeName,
                    ingreds,
                    instructions,
                    image: localImage,
                    time: recipeTime || undefined,
                    genre: recipeGenre || undefined,
                    mealTypes: recipeMealTypes,
                    carbType: recipeCarbType || undefined,
                    servings: recipeServings !== "" ? Number(recipeServings) : undefined,
                    sourceUrl: recipeSourceUrl || undefined
                })
                Router.push("/recipes")
            }
        } catch (error: any) {
            console.error("Error saving recipe:", error)
            alert(error?.message || "failed, unexpected error")
        } finally {
            setLoading(false)
        }
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
                let tasteIngredsList: Ingredient[] = []
                data.data.ingredients.forEach(function (ingred: any) {
                    if (ingred.converted !== undefined) {
                        let IngredObj = {
                            "Name": ingred.converted.name,
                            "Amount": ingred.converted.quantity,
                            "AmountType": ingred.converted.quantity_unit,
                            "Note": "Imported from Taste"
                        }
                        tasteIngredsList.push(IngredObj)
                    }
                })
                setIngreds(tasteIngredsList)

                let tasteInstructionList: Instruction[] = []
                data.data.instructions.forEach(function (instruction: any) {
                    let InstructObj = {
                        "Text": instruction.instruction,
                        "Note": instruction.stepNumber
                    }
                    tasteInstructionList.push(InstructObj)
                })
                setInstructions(tasteInstructionList)

                if (data.data.name !== undefined) {
                    setRecipeName(data.data.name)
                }
                setFormPhase('builder')
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
                throw new Error("Couldn't find a description on that post — check the link is public.")
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

                setFormPhase('builder')
            } catch (extractError) {
                console.error("Facebook AI extraction error:", extractError)
                throw new Error("Got the post description, but AI parsing failed. The raw text is saved in AI Notes — try Extract & Continue there.")
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
            setFormPhase('builder')
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
            setFormPhase('builder')
            alert("Recipe extracted successfully!")
        } catch (error: any) {
            console.error("[AI-Extract-Client] Process Error:", error);
            alert(`Extraction Error: ${error?.message || String(error)}`);
        }
        setIsExtracting(false)
        setExtractionStatus("")
    }

    const onSubmitInstruc = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const target = e.target as typeof e.target & {
            instructText: { value: string }
            instructNote?: { value: string }
            reset: () => void
        }

        let InstructObj: Instruction = {
            "Text": target.instructText.value,
            "Note": target.instructNote?.value || ""
        }

        setInstructions([...instructions, InstructObj])
        target.reset()
    }

    useEffect(() => {
        setQuantityTypes(quantity_unit_conversions)
    }, [])

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
                        setInstructions(data.res.instructions.map((i: any) => ({ Text: i.Text, Note: i.note })))
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
        }
    }, [isEditMode]);

    if (!isAuthed) return null

    return (
        <Layout title={isEditMode ? "Edit Recipe" : "Create Recipe"} description={isEditMode ? "Modify your recipe" : "Add a new recipe to your collection"}>
            <PageHeader title={isEditMode ? "Edit Recipe" : "Create new Recipe"} />

            <div className="flex flex-col gap-6 w-full">
                {/* Phase 1: Setup */}
                {formPhase === 'setup' && (
                    <div className="glass-card group-highlight w-full animate-in fade-in slide-in-from-top-4 duration-500">
                        <h2 className="text-xl font-bold mb-4">Recipe Setup</h2>

                        <div className="mb-6">
                            <FormField
                                label="Recipe Name"
                                id="recipeName"
                                placeholder="What are we cooking?"
                                value={recipeName}
                                onChange={(e) => setRecipeName(e.target.value)}
                            />
                        </div>

                        <div className="mb-6">
                            <label className="label-modern text-sm font-medium mb-3 block">
                                How would you like to start?
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setCreationMethod('image')}
                                    className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-300 ${creationMethod === 'image'
                                        ? 'bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20'
                                        : 'bg-secondary/30 border-border/10 text-muted-foreground hover:border-accent/30 hover:bg-secondary/50'
                                        }`}
                                >
                                    <span className="text-2xl mb-1">📸</span>
                                    <span className="font-bold text-sm">Photo</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCreationMethod('url')}
                                    className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-300 ${creationMethod === 'url'
                                        ? 'bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20'
                                        : 'bg-secondary/30 border-border/10 text-muted-foreground hover:border-accent/30 hover:bg-secondary/50'
                                        }`}
                                >
                                    <span className="text-2xl mb-1">🌐</span>
                                    <span className="font-bold text-sm">Web URL</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCreationMethod('social')}
                                    className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-300 ${creationMethod === 'social'
                                        ? 'bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20'
                                        : 'bg-secondary/30 border-border/10 text-muted-foreground hover:border-accent/30 hover:bg-secondary/50'
                                        }`}
                                >
                                    <span className="text-2xl mb-1">🔗</span>
                                    <span className="font-bold text-sm">Social</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCreationMethod('notes')}
                                    className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-300 ${creationMethod === 'notes'
                                        ? 'bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20'
                                        : 'bg-secondary/30 border-border/10 text-muted-foreground hover:border-accent/30 hover:bg-secondary/50'
                                        }`}
                                >
                                    <span className="text-2xl mb-1">🪄</span>
                                    <span className="font-bold text-sm">AI Notes</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCreationMethod('manual')}
                                    className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-300 ${creationMethod === 'manual'
                                        ? 'bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20'
                                        : 'bg-secondary/30 border-border/10 text-muted-foreground hover:border-accent/30 hover:bg-secondary/50'
                                        }`}
                                >
                                    <span className="text-2xl mb-1">✍️</span>
                                    <span className="font-bold text-sm">Manually</span>
                                </button>
                            </div>
                        </div>

                        {creationMethod === 'url' && (
                            <form onSubmit={onSubmitRecipeSiteImport} className="border-t border-border pt-6 mb-2 animate-in fade-in slide-in-from-top-4">
                                <FormField
                                    label="Source URL"
                                    id="tasteURL"
                                    placeholder="Paste URL (Taste, RecipeTinEats, VegKit)"
                                    className="w-full mb-4"
                                />
                                <Button type="submit" className="w-full bg-accent hover:bg-accent-hover font-bold" disabled={loading}>
                                    {loading ? "Parsing Recipe..." : "Import & Continue"}
                                </Button>
                            </form>
                        )}

                        {creationMethod === 'social' && (
                            <form onSubmit={onSubmitFacebookImport} className="border-t border-border pt-6 mb-2 animate-in fade-in slide-in-from-top-4">
                                <FormField
                                    label="Social Media Link"
                                    id="tasteURL"
                                    placeholder="Paste a Facebook link (fb.watch, facebook.com/share/...)"
                                    className="w-full mb-4"
                                />
                                <Button type="submit" className="w-full bg-accent hover:bg-accent-hover font-bold" disabled={loading}>
                                    {loading ? "Parsing Post..." : "Import & Continue"}
                                </Button>
                            </form>
                        )}

                        {creationMethod === 'notes' && (
                            <div className="border-t border-border pt-6 mb-2 animate-in fade-in slide-in-from-top-4">
                                <label className="label-modern text-sm font-medium mb-2 block">Recipe Snippet</label>
                                <textarea
                                    value={recipeNotes}
                                    onChange={(e) => setRecipeNotes(e.target.value)}
                                    placeholder="Paste ingredients or method here..."
                                    className="input-modern min-h-[150px] mb-4 resize-none"
                                />
                                <Button
                                    type="button"
                                    onClick={onSubmitNotesExtract}
                                    disabled={isExtracting}
                                    className="w-full bg-accent hover:bg-accent-hover font-bold flex items-center justify-center gap-2"
                                >
                                    {isExtracting ? "AI is working..." : "Extract & Continue"}
                                </Button>
                            </div>
                        )}

                        {creationMethod === 'image' && (
                            <div className="border-t border-border pt-6 mb-2 animate-in fade-in slide-in-from-top-4">
                                {extractImage ? (
                                    <label className="block w-full border-2 border-dashed border-border/20 rounded-3xl p-6 text-center cursor-pointer hover:bg-accent/5 hover:border-accent/40 transition-all duration-300 group mb-4">
                                        <input
                                            accept="image/*"
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => { if (e.target.files && e.target.files[0]) fileToBase64(e.target.files[0], setExtractionStatus).then(setExtractImage) }}
                                        />
                                        <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-md">
                                            <img src={extractImage} alt="Recipe Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm">
                                                Click to change photo
                                            </div>
                                        </div>
                                    </label>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <label className="block border-2 border-dashed border-border/20 rounded-3xl p-6 text-center cursor-pointer hover:bg-accent/5 hover:border-accent/40 transition-all duration-300 group">
                                            <input
                                                accept="image/*"
                                                capture="environment"
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => { if (e.target.files && e.target.files[0]) fileToBase64(e.target.files[0], setExtractionStatus).then(setExtractImage) }}
                                            />
                                            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📸</div>
                                            <span className="text-xs font-bold block">Camera</span>
                                        </label>
                                        <label className="block border-2 border-dashed border-border/20 rounded-3xl p-6 text-center cursor-pointer hover:bg-accent/5 hover:border-accent/40 transition-all duration-300 group">
                                            <input
                                                accept="image/*"
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => { if (e.target.files && e.target.files[0]) fileToBase64(e.target.files[0], setExtractionStatus).then(setExtractImage) }}
                                            />
                                            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🖼️</div>
                                            <span className="text-xs font-bold block">Gallery</span>
                                        </label>
                                    </div>
                                )}

                                <label className="label-modern text-sm font-medium mb-2 block">Adaptation Notes (Optional)</label>
                                <input
                                    type="text"
                                    value={imageNotes}
                                    onChange={(e) => setImageNotes(e.target.value)}
                                    placeholder="e.g., Make it vegetarian, double the serving size..."
                                    className="input-modern mb-4 w-full"
                                />
                                <Button
                                    type="button"
                                    onClick={onSubmitImageExtract}
                                    disabled={isExtracting}
                                    className="w-full bg-accent hover:bg-accent-hover font-bold flex flex-col items-center justify-center gap-1 py-6"
                                >
                                    <div className="flex items-center gap-2">
                                        {isExtracting ? (
                                            <>
                                                <LoadingSpinner />
                                                <span>Working on it...</span>
                                            </>
                                        ) : (
                                            "Extract from Photo & Continue"
                                        )}
                                    </div>
                                    {extractionStatus && (
                                        <span className="text-[10px] font-medium text-accent-foreground/70 animate-pulse uppercase tracking-wider">
                                            {extractionStatus}
                                        </span>
                                    )}
                                </Button>
                            </div>
                        )}

                        {creationMethod === 'manual' && (
                            <div className="border-t border-border pt-6 animate-in fade-in slide-in-from-top-4">
                                <Button
                                    type="button"
                                    onClick={handleContinue}
                                    className="w-full bg-accent hover:bg-accent-hover font-bold"
                                >
                                    Start Building
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Phase 2: Builder */}
                {formPhase === 'builder' && (
                    <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Navigation & Prominent Recipe Title */}
                        <div className="flex flex-col gap-4">
                            {!isEditMode && (
                                <button
                                    onClick={handleBack}
                                    className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-accent transition-colors w-fit"
                                >
                                    ⬅️ Back to Setup
                                </button>
                            )}
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/10 pb-4">
                                <input
                                    type="text"
                                    value={recipeName}
                                    onChange={(e) => setRecipeName(e.target.value)}
                                    placeholder="Untitled Recipe"
                                    className="text-4xl font-black tracking-tight bg-transparent border-none outline-none focus:ring-0 p-0 text-foreground w-full placeholder:text-foreground/30 leading-tight focus:bg-background/20 rounded transition-colors"
                                />
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/60 bg-accent/5 px-3 py-1 rounded-full border border-accent/10 w-fit shrink-0">
                                    {creationMethod || 'manual'} builder
                                </div>
                            </div>
                        </div>

                        {/* Main Interaction Area: Ingredients & Instructions */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            {/* Ingredients Module */}
                            <div className="glass-card group-highlight p-0 overflow-hidden border-t-4 border-t-accent">
                                <div className="p-4 md:p-6 bg-gradient-to-b from-accent/5 to-transparent">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="bg-accent text-accent-foreground w-8 h-8 rounded-lg flex items-center justify-center text-sm">🛒</span>
                                        Ingredients
                                    </h3>
                                </div>

                                <div className="p-6 md:p-8 pt-0">
                                    <div className="bg-secondary/20 rounded-2xl p-4 md:p-6 border border-border/5">
                                        <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4">Current List</h4>
                                        <IngredientEditor ingredients={ingreds} onChange={setIngreds} autoDefaults pendingConversions={pendingConversions} />
                                    </div>
                                </div>
                            </div>

                            {/* Instructions Module: Grouped Add + List */}
                            <div className="glass-card group-highlight p-0 overflow-hidden border-t-4 border-t-accent-hover">
                                <div className="p-6 md:p-8 bg-gradient-to-b from-accent-hover/5 to-transparent">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                                        <span className="bg-accent-hover text-accent-foreground w-8 h-8 rounded-lg flex items-center justify-center text-sm">🔥</span>
                                        Cooking Method
                                    </h3>
                                    <form onSubmit={onSubmitInstruc} className="flex flex-col gap-4">
                                        <textarea
                                            id="instructText"
                                            required
                                            placeholder="What's the next step?"
                                            className="input-modern min-h-[100px] text-sm resize-none"
                                        />
                                        <div className="flex flex-col gap-2">
                                            <label htmlFor="instructNote" className="text-[10px] font-black uppercase text-muted-foreground/60 ml-1">Step Note (Optional)</label>
                                            <input
                                                id="instructNote"
                                                placeholder="e.g. medium heat, 5 mins"
                                                className="input-modern py-2 text-xs bg-background/30"
                                            />
                                        </div>
                                        <Button type="submit" className="bg-secondary/50 hover:bg-secondary text-foreground font-black py-4 h-auto rounded-xl">
                                            Add This Step
                                        </Button>
                                    </form>
                                </div>

                                <div className="p-6 md:p-8 pt-0">
                                    <div className="bg-secondary/20 rounded-2xl p-4 md:p-6 border border-border/5">
                                        <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4">Step-by-Step</h4>
                                        {instructions.length === 0 ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-center opacity-30 select-none">
                                                <div className="text-5xl mb-4">📖</div>
                                                <p className="text-sm italic">The story starts here...</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-6">
                                                {instructions.map((instruction, i) => (
                                                    <div key={i} className="flex gap-5 group relative">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 text-accent flex items-center justify-center text-xs font-black shrink-0 z-10">
                                                                {i + 1}
                                                            </div>
                                                            {i !== instructions.length - 1 && (
                                                                <div className="w-0.5 h-full bg-gradient-to-b from-accent/20 to-transparent absolute top-8 left-4 -ml-[1px]"></div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 pb-4 border-b border-border/5 group-last:border-0">
                                                            <div className="flex justify-between items-start">
                                                                <p className="text-sm leading-relaxed font-medium pt-1.5">{instruction.Text}</p>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                                                    onClick={() => setInstructions(instructions.filter((item) => item.Text !== instruction.Text))}
                                                                >
                                                                    <RiDeleteBin7Line size={16} />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mid Section: Recipe Image */}
                        <div className="glass-card group-highlight p-6 md:p-8">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                                <span className="bg-muted-foreground/20 text-muted-foreground w-8 h-8 rounded-lg flex items-center justify-center text-sm">🖼️</span>
                                Recipe Visuals
                            </h3>
                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                <div className="flex-1 w-full">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <label className="block w-full border-2 border-dashed border-border/20 rounded-3xl p-8 text-center cursor-pointer hover:bg-accent/5 hover:border-accent/40 transition-all duration-300 group">
                                            <input
                                                accept="image/*"
                                                capture="environment"
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => { if (e.target.files && e.target.files[0]) fileToBase64(e.target.files[0], setExtractionStatus).then(setImageData) }}
                                            />
                                            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📸</div>
                                            <span className="text-sm font-bold block">Camera</span>
                                        </label>
                                        <label className="block w-full border-2 border-dashed border-border/20 rounded-3xl p-8 text-center cursor-pointer hover:bg-accent/5 hover:border-accent/40 transition-all duration-300 group">
                                            <input
                                                accept="image/*"
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => { if (e.target.files && e.target.files[0]) fileToBase64(e.target.files[0], setExtractionStatus).then(setImageData) }}
                                            />
                                            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🖼️</div>
                                            <span className="text-sm font-bold block">Gallery</span>
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/30 uppercase tracking-widest font-black mt-4 text-center">AI will generate a cover if left blank</p>
                                </div>

                                {imageData && (
                                    <div className="relative w-full md:w-64 aspect-video md:aspect-square rounded-3xl overflow-hidden border-2 border-accent/20 group shadow-2xl shadow-accent/10">
                                        <img src={imageData} alt="Recipe Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                        <button
                                            onClick={() => setImageData(undefined)}
                                            className="absolute top-3 right-3 bg-destructive/90 backdrop-blur-md text-white p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0"
                                        >
                                            <RiDeleteBin7Line size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom Section: Advanced Details (Collapsed by default) */}
                        <div className="glass-card border-none bg-secondary/10 p-0 overflow-hidden rounded-3xl">
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full flex items-center justify-between p-6 md:p-8 hover:bg-secondary/20 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">⚙️</span>
                                    <span className="font-black text-sm uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Advanced Recipe Metadata</span>
                                </div>
                                <div className={`transition-transform duration-500 ${showAdvanced ? 'rotate-180 text-accent' : 'text-muted-foreground'}`}>
                                    <RiArrowDownSLine size={24} />
                                </div>
                            </button>

                            <div className={`transition-all duration-700 ease-in-out overflow-hidden ${showAdvanced ? 'max-h-[800px] opacity-100 pointer-events-auto' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 p-6 md:p-8 pt-0 animate-in fade-in slide-in-from-top-4">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground block ml-1 underline decoration-accent/20 underline-offset-4">Prep Time</label>
                                        <select value={recipeTime} onChange={(e) => setRecipeTime(e.target.value)} className="input-modern bg-background/50 border-border/10 focus:ring-accent/20">
                                            <option value="">Unknown</option>
                                            <option value="short">Zap (Under 30min)</option>
                                            <option value="medium">Standard (30-60min)</option>
                                            <option value="long">Slow Roast (60min+)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground block ml-1 underline decoration-accent/20 underline-offset-4">Cuisine Style</label>
                                        <select value={recipeGenre} onChange={(e) => setRecipeGenre(e.target.value)} className="input-modern bg-background/50 border-border/10 focus:ring-accent/20">
                                            <option value="">Uncategorized</option>
                                            {['Italian', 'Mexican', 'Asian', 'Indian', 'Mediterranean', 'American', 'French', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Greek', 'Chinese', 'Vietnamese', 'Other'].map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground block ml-1 underline decoration-accent/20 underline-offset-4">Target Servings</label>
                                        <div className="relative">
                                            <input type="number" value={recipeServings} onChange={(e) => setRecipeServings(e.target.value)} className="input-modern bg-background/50 border-border/10 pr-12" placeholder="4" />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground uppercase">px</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground block ml-1 underline decoration-accent/20 underline-offset-4">Meal Occasions</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Breakfast', 'Lunch', 'Main', 'Snack'].map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => recipeMealTypes.includes(type) ? setRecipeMealTypes(recipeMealTypes.filter(t => t !== type)) : setRecipeMealTypes([...recipeMealTypes, type])}
                                                    className={`px-3 py-1.5 rounded-xl border text-[10px] font-black transition-all duration-300 ${recipeMealTypes.includes(type) ? 'bg-accent/10 border-accent text-accent' : 'border-border/10 text-muted-foreground hover:border-accent/40'}`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground block ml-1 underline decoration-accent/20 underline-offset-4">Carb Type</label>
                                        <select value={recipeCarbType} onChange={(e) => setRecipeCarbType(e.target.value)} className="input-modern bg-background/50 border-border/10 focus:ring-accent/20">
                                            <option value="">Uncategorized</option>
                                            {['Rice', 'Bread/Wraps', 'Pasta/Noodles', 'Potato', 'Quinoa', 'None/Other'].map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Final Action - Large and Bold */}
                        <div className="flex justify-center pt-10 pb-32">
                            <Button
                                onClick={onSubmitRecipe}
                                size="lg"
                                className="w-full max-w-xl font-black text-2xl h-24 bg-accent text-accent-foreground hover:bg-accent-hover shadow-[0_10px_50px_rgba(235,53,101,0.2)] hover:shadow-accent/40 hover:-translate-y-1 transition-all rounded-[2rem]"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full border-4 border-accent-foreground border-t-transparent animate-spin"></div>
                                        <span>Curating...</span>
                                    </div>
                                ) : (
                                    "✨ Publish to Collection"
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
