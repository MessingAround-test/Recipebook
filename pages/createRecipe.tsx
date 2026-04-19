import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import Head from 'next/head'
import Router, { useRouter } from 'next/router'
import { Layout } from '../components/Layout'
import { PageHeader } from '../components/PageHeader'
import { FormField } from '../components/FormField'
import { Button } from '../components/ui/button'
import { quantity_unit_conversions } from "../lib/conversion"
import { RiDeleteBin7Line } from 'react-icons/ri'
import AddShoppingItem from '../components/AddShoppingItem'
import { useAuthGuard } from '../lib/useAuthGuard'

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
                "genre": recipeGenre || undefined
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

        const res = await fetch(`/api/recipeSiteExtract/${siteProvider}?url=${tasteURL}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': token || ''
            }
        })
        const data = await res.json()

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
            instructNote: { value: string }
            reset: () => void
        }

        let InstructObj: Instruction = {
            "Text": target.instructText.value,
            "Note": target.instructNote.value
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

    const getBase64 = function (file: File, cb: (data: string) => void) {
        let reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function () {
            cb(reader.result as string)
        };
        reader.onerror = function (error) {
            console.log('Error: ', error);
        };
    }

    if (!isAuthed) return null

    return (
        <Layout title={isEditMode ? "Edit Recipe" : "Create Recipe"} description={isEditMode ? "Modify your recipe" : "Add a new recipe to your collection"}>
            <PageHeader title={isEditMode ? "Edit Recipe" : "Create new Recipe"} />

            <div className="flex flex-col gap-6 w-full">
                {/* General Details & Import Row */}
                <div className="glass-card w-full">
                    <h2 className="text-xl font-bold mb-4">General</h2>

                    <div className="mb-6">
                        <FormField
                            label="Recipe Name"
                            id="recipeName"
                            placeholder="Enter Recipe Name"
                            value={recipeName}
                            onChange={(e) => setRecipeName(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="label-modern text-sm font-medium mb-1 block">
                                ⏱️ Cook Time <span className="text-muted-foreground font-normal">(optional — AI will guess if blank)</span>
                            </label>
                            <select
                                value={recipeTime}
                                onChange={(e) => setRecipeTime(e.target.value)}
                                className="input-modern"
                            >
                                <option value="">Select time...</option>
                                <option value="short">⚡ Short (under 30 min)</option>
                                <option value="medium">⏱️ Medium (30–60 min)</option>
                                <option value="long">🍲 Long (over 60 min)</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-modern text-sm font-medium mb-1 block">
                                🍳 Cuisine Genre <span className="text-muted-foreground font-normal">(optional — AI will guess if blank)</span>
                            </label>
                            <select
                                value={recipeGenre}
                                onChange={(e) => setRecipeGenre(e.target.value)}
                                className="input-modern"
                            >
                                <option value="">Select genre...</option>
                                {['Italian', 'Mexican', 'Asian', 'Indian', 'Mediterranean', 'American', 'French', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Greek', 'Chinese', 'Vietnamese', 'Other'].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <form onSubmit={onSubmitRecipeSiteImport} className="flex flex-row items-end gap-2">
                        <div className="flex-1">
                            <FormField
                                label="Import from site"
                                id="tasteURL"
                                placeholder="Paste URL (Taste.com, recipetineats.com, vegkit.com)"
                                className="w-full"
                            />
                        </div>
                        <div className="mb-3">
                            <Button type="submit" variant="outline">Import</Button>
                        </div>
                    </form>
                </div>

                {/* Builder Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full px-2 sm:px-0">
                    {/* Add Ingredients */}
                    <div className="glass-card p-4 md:p-8">
                        <h2 className="text-xl font-bold mb-4 border-b border-border pb-2">Add Ingredients</h2>
                        <AddShoppingItem handleSubmit={onSubmitIngred} hideCategories={true} />
                    </div>

                    {/* Current Ingredients */}
                    <div className="glass-card p-4 md:p-8">
                        <h2 className="text-xl font-bold mb-4 border-b border-border pb-2">Current Ingredients</h2>
                        {ingreds.length === 0 ? (
                            <p className="text-muted-foreground italic">No ingredients added yet.</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {ingreds.map((ingred, i) => (
                                    <li key={i} className="flex flex-row justify-between items-center p-2 rounded-lg bg-secondary/50 border border-glass-border">
                                        <span className="text-sm">
                                            <span className="font-bold">{ingred.Amount} {ingred.AmountType}</span> - {ingred.Name}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-white hover:bg-destructive"
                                            onClick={() => setIngreds(ingreds.filter((item) => item.Name !== ingred.Name))}
                                        >
                                            <RiDeleteBin7Line />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Add Instructions */}
                    <div className="glass-card p-4 md:p-8">
                        <h2 className="text-xl font-bold mb-4 border-b border-border pb-2">Instructions</h2>
                        <form onSubmit={onSubmitInstruc} className="flex flex-col gap-4">
                            <FormField
                                label="Step Description"
                                id="instructText"
                                placeholder="What to do..."
                                required
                            />
                            <FormField
                                label="Note (Optional)"
                                id="instructNote"
                                placeholder="Additional details..."
                            />
                            <Button type="submit">Add Instruction</Button>
                        </form>
                    </div>

                    {/* Current Instructions */}
                    <div className="glass-card p-4 md:p-8">
                        <h2 className="text-xl font-bold mb-4 border-b border-border pb-2">Step-by-Step</h2>
                        {instructions.length === 0 ? (
                            <p className="text-muted-foreground italic">No instructions added yet.</p>
                        ) : (
                            <ol className="list-decimal list-inside flex flex-col gap-2">
                                {instructions.map((instruction, i) => (
                                    <li key={i} className="p-2 rounded-lg bg-secondary/50 border border-glass-border flex flex-row justify-between items-center">
                                        <span className="text-sm pr-4">{instruction.Text}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-white hover:bg-destructive shrink-0"
                                            onClick={() => setInstructions(instructions.filter((item) => item.Text !== instruction.Text))}
                                        >
                                            <RiDeleteBin7Line />
                                        </Button>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>

                    {/* Add Image */}
                    <div className="glass-card md:col-span-2">
                        <h2 className="text-xl font-bold mb-2 border-b border-border pb-2">Recipe Image</h2>
                        <p className="text-sm text-muted-foreground mb-4">Upload an image or leave blank to AI-generate one based on the recipe name.</p>

                        <div className="flex flex-col md:flex-row gap-4 items-start">
                            <div className="flex-1">
                                <input
                                    accept="image/*"
                                    type="file"
                                    className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                                    onChange={(e) => { e.target.files && e.target.files[0] ? getBase64(e.target.files[0], (data) => setImageData(data)) : undefined }}
                                />
                            </div>

                            {imageData && (
                                <div className="relative w-full max-w-[300px] aspect-video rounded-lg overflow-hidden border border-border">
                                    <img src={imageData} alt="Recipe Preview" className="w-full h-full object-cover" />
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="absolute top-2 right-2 rounded-full w-8 h-8 p-0"
                                        onClick={() => setImageData(undefined)}
                                    >
                                        x
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Submit Action */}
                <div className="flex justify-center mt-6 mb-12">
                    <Button
                        onClick={onSubmitRecipe}
                        size="lg"
                        className="w-full max-w-sm font-bold text-lg bg-accent text-accent-foreground hover:bg-accent-hover"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"></div>
                                Saving...
                            </div>
                        ) : "Save and Submit"}
                    </Button>
                </div>
            </div>
        </Layout>
    )
}
