import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import Head from 'next/head'
import Router, { useRouter } from 'next/router'
import { Layout } from '../components/Layout'
import { PageHeader } from '../components/PageHeader'
import { FormField } from '../components/FormField'
import { Button } from '../components/ui/button'
import { quantity_unit_conversions } from "../lib/conversion"
import { RiDeleteBin7Line, RiArrowDownSLine, RiArrowUpSLine } from 'react-icons/ri'
import AddShoppingItem from '../components/AddShoppingItem'
import { useAuthGuard } from '../lib/useAuthGuard'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface Ingredient {
    Name: string
    Amount: string | number
    AmountType: string
    Note?: string
}

interface Instruction {
    Text: string
    Note?: string
}

// Ensure the implicit types are correct for the legacy AddShoppingItem events
interface CustomEvent {
    value: {
        name: string
        quantity: string | number
        quantity_type: string
        note: string
    }
    target: any
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
    const [recipeServings, setRecipeServings] = useState<number | string>("")
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [recipeNotes, setRecipeNotes] = useState("")
    const [isExtracting, setIsExtracting] = useState(false)
    const [creationMethod, setCreationMethod] = useState<'url' | 'notes' | 'manual' | 'image' | null>(null)
    const [imageNotes, setImageNotes] = useState("")
    const [extractImage, setExtractImage] = useState<string | undefined>()
    const [formPhase, setFormPhase] = useState<'setup' | 'builder'>('setup')
    const [extractionStatus, setExtractionStatus] = useState("")

    const router = useRouter();
    const { id } = router.query || {};
    const isEditMode = id !== undefined;

    const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    const convertBlobToBase64 = async (blob: Blob) => {
        return await blobToBase64(blob);
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

        const token = localStorage.getItem('Token')
        const url = isEditMode ? `/api/Recipe/${id}` : "/api/Recipe"
        const method = isEditMode ? 'PUT' : 'POST'
        const res = await fetch(url, {
            method: method,
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
                "servings": recipeServings !== "" ? Number(recipeServings) : undefined
            })
        })

        const data = await res.json()
        console.log(data)
        if (data.success === false || data.success === undefined) {
            if (data.message !== undefined) {
                alert(data.message)
            } else {
                alert("failed, unexpected error")
            }
            setLoading(false)
        } else {
            Router.push("/recipes")
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

    const onSubmitNotesExtract = async () => {
        if (!recipeNotes.trim()) {
            alert("Please paste some notes first!")
            return
        }

        if (!confirmOverwrite()) return;

        setIsExtracting(true)
        try {
            const token = localStorage.getItem('Token')
            const res = await fetch('/api/ai/extract_from_notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': token || ''
                },
                body: JSON.stringify({ notes: recipeNotes })
            })

            const result = await res.json()
            if (result.success && result.data) {
                const { name, ingredients, instructions, time, genre, mealTypes, servings } = result.data

                if (name) setRecipeName(name)
                if (ingredients) setIngreds(ingredients)
                if (instructions) setInstructions(instructions)
                if (time) setRecipeTime(time)
                if (genre) setRecipeGenre(genre)
                if (mealTypes) setRecipeMealTypes(mealTypes)
                if (servings) setRecipeServings(servings)

                setRecipeNotes("") // Clear notes after successful extraction
                setFormPhase('builder')
                alert("Recipe extracted successfully!")
            } else {
                alert(result.message || "Failed to extract recipe.")
            }
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
            const token = localStorage.getItem('Token')

            // Artificial delay for first step to show status
            setTimeout(() => setExtractionStatus("Uploading to Gemini Vision..."), 800);

            console.log(`[AI-Extract-Client] Starting fetch. Payload size: ${(extractImage.length / 1024 / 1024).toFixed(2)} MB`);
            
            const res = await fetch('/api/ai/extract_from_image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': token || ''
                },
                body: JSON.stringify({ image: extractImage, notes: imageNotes })
            })

            setExtractionStatus("Extracting recipe details...")
            const result = await res.json()
            console.log(`[AI-Extract-Client] Response received. Success: ${result.success}, Status: ${res.status}`);

            if (result.success && result.data) {
                setExtractionStatus("Finalizing recipe structure...")
                const { name, ingredients, instructions, time, genre, mealTypes, servings } = result.data

                if (name) setRecipeName(name)
                if (ingredients) setIngreds(ingredients)
                if (instructions) setInstructions(instructions)
                if (time) setRecipeTime(time)
                if (genre) setRecipeGenre(genre)
                if (mealTypes) setRecipeMealTypes(mealTypes)
                if (servings) setRecipeServings(servings)
                setImageData(extractImage)

                setExtractImage(undefined)
                setImageNotes("")
                setFormPhase('builder')
                alert("Recipe extracted successfully!")
            } else {
                console.error("[AI-Extract-Client] Extraction failed:", result.message);
                alert(result.message || "Failed to extract recipe.");
            }
        } catch (error: any) {
            console.error("[AI-Extract-Client] Fetch/Process Error:", error);
            const errorMsg = error.message || String(error);
            alert(`Extraction Error: ${errorMsg}`);
        }
        setIsExtracting(false)
        setExtractionStatus("")
    }

    const onSubmitIngred = async (e: any) => {
        e.preventDefault();
        let IngredObj: Ingredient = {
            "Name": e.value.name,
            "Amount": e.value.quantity,
            "AmountType": e.value.quantity_type,
            "Note": e.value.note
        }

        setIngreds([...ingreds, IngredObj])
        if (e.target.reset) e.target.reset()
        if (e.resetForm) e.resetForm()
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
                        setRecipeServings(data.res.servings || "")
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

    const compressImage = async (base64String: string, maxMB: number = 2): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64String;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const maxDim = 1600;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = (height / width) * maxDim;
                        width = maxDim;
                    } else {
                        width = (width / height) * maxDim;
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                let quality = 0.8;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);

                while (dataUrl.length > maxMB * 1024 * 1024 * 1.33 && quality > 0.1) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(dataUrl);
            };
        });
    };

    const getBase64 = function (file: File, cb: (data: string) => void) {
        let reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async function () {
            let base64 = reader.result as string;
            if (file.size > 2 * 1024 * 1024) {
                setExtractionStatus("Compressing image...");
                base64 = await compressImage(base64);
                setExtractionStatus("");
            }
            cb(base64)
        };
        reader.onerror = function (error) {
            console.log('Error: ', error);
        };
    }

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
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                                            onChange={(e) => { e.target.files && e.target.files[0] ? getBase64(e.target.files[0], (data) => setExtractImage(data)) : undefined }}
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
                                                onChange={(e) => { e.target.files && e.target.files[0] ? getBase64(e.target.files[0], (data) => setExtractImage(data)) : undefined }}
                                            />
                                            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📸</div>
                                            <span className="text-xs font-bold block">Camera</span>
                                        </label>
                                        <label className="block border-2 border-dashed border-border/20 rounded-3xl p-6 text-center cursor-pointer hover:bg-accent/5 hover:border-accent/40 transition-all duration-300 group">
                                            <input
                                                accept="image/*"
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => { e.target.files && e.target.files[0] ? getBase64(e.target.files[0], (data) => setExtractImage(data)) : undefined }}
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
                            {/* Ingredients Module: Grouped Add + List */}
                            <div className="glass-card group-highlight p-0 overflow-hidden border-t-4 border-t-accent">
                                <div className="p-4 md:p-6 bg-gradient-to-b from-accent/5 to-transparent">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="bg-accent text-accent-foreground w-8 h-8 rounded-lg flex items-center justify-center text-sm">🛒</span>
                                        Ingredients
                                    </h3>
                                    <div className="px-2">
                                        <AddShoppingItem handleSubmit={onSubmitIngred} hideCategories={true} />
                                    </div>
                                </div>

                                <div className="p-6 md:p-8 pt-0">
                                    <div className="bg-secondary/20 rounded-2xl p-4 md:p-6 border border-border/5">
                                        <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4">Current List</h4>
                                        {ingreds.length === 0 ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-center opacity-30 select-none">
                                                <div className="text-5xl mb-4">🥫</div>
                                                <p className="text-sm italic">Nothing in the pantry yet...</p>
                                            </div>
                                        ) : (
                                            <ul className="flex flex-col gap-3">
                                                {ingreds.map((ingred, i) => (
                                                    <li key={i} className="flex items-center justify-between p-4 rounded-xl bg-background/40 border border-border/10 group hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold flex items-center gap-2">
                                                                <span className="text-accent underline decoration-accent/30 underline-offset-4">{ingred.Amount} {ingred.AmountType}</span>
                                                                {ingred.Name}
                                                            </span>
                                                            {ingred.Note && <span className="text-[10px] text-muted-foreground italic mt-0.5">{ingred.Note}</span>}
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-muted-foreground hover:text-white hover:bg-destructive rounded-lg h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-all"
                                                            onClick={() => setIngreds(ingreds.filter((item) => item.Name !== ingred.Name))}
                                                        >
                                                            <RiDeleteBin7Line size={16} />
                                                        </Button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
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
                                                onChange={(e) => { e.target.files && e.target.files[0] ? getBase64(e.target.files[0], (data) => setImageData(data)) : undefined }}
                                            />
                                            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📸</div>
                                            <span className="text-sm font-bold block">Camera</span>
                                        </label>
                                        <label className="block w-full border-2 border-dashed border-border/20 rounded-3xl p-8 text-center cursor-pointer hover:bg-accent/5 hover:border-accent/40 transition-all duration-300 group">
                                            <input
                                                accept="image/*"
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => { e.target.files && e.target.files[0] ? getBase64(e.target.files[0], (data) => setImageData(data)) : undefined }}
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
