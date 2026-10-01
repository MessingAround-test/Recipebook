import Head from 'next/head'
import { useEffect, useState } from 'react'
import Router, { useRouter } from 'next/router'
import { Layout } from '../../components/Layout'
import ImageCard, { Recipe } from '../../components/ImageCard'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useFeatureGuard } from '../../lib/useFeatureGuard'
import { 
    Search, 
    SlidersHorizontal, 
    Plus, 
    Dices, 
    Sparkles,
    Calendar,
    ArrowUpDown,
    ChefHat,
    Trash2,
    EyeOff,
    Compass,
    Globe2
} from 'lucide-react'
import { FilterSheet } from '../../components/recipes/FilterSheet'
import pageShell from '../../styles/PageShell.module.css'

interface UserData {
    _id: string
    username: string
    role: string
    email?: string
}

export default function Recipes() {
    const isAuthed = useFeatureGuard('recipes')
    const router = useRouter()
    const [userData, setUserData] = useState<UserData | null>(null)
    const [recipes, setRecipes] = useState<Recipe[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [idFilter, setIdFilter] = useState<string[]>([])
    const [bulkAction, setBulkAction] = useState<'delete' | 'hide' | null>(null)
    const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
    const [filterTime, setFilterTime] = useState<string[]>([])
    const [filterPrice, setFilterPrice] = useState<string[]>([])
    const [filterGenre, setFilterGenre] = useState<string[]>([])
    const [filterCooked, setFilterCooked] = useState<string>('')
    const [filterMealTypes, setFilterMealTypes] = useState<string[]>([])
    const [showHidden, setShowHidden] = useState(false)
    const [showFilters, setShowFilters] = useState(false)
    const [loading, setLoading] = useState(true)

    async function getUserDetails() {
        const token = localStorage.getItem('Token')
        if (!token) return
        let res = await fetch("/api/UserDetails", {
            headers: { 'edgetoken': token }
        })
        let data = await res.json()
        setUserData(data.res)
    }

    async function getRecipeDetails() {
        setLoading(true)
        const token = localStorage.getItem('Token')
        if (!token) return
        try {
            let res = await fetch("/api/Recipe", {
                headers: { 'edgetoken': token }
            })
            let data = await res.json()
            setRecipes(data.res || [])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthed) {
            getUserDetails()
            getRecipeDetails()
        }
    }, [isAuthed])

    // Filter to a specific set of recipes (e.g. the ones linked to a dish) via
    // /recipes?ids=a,b,c, and seed the search box from ?search=.
    useEffect(() => {
        const rawIds = router.query.ids
        const ids = typeof rawIds === 'string' ? rawIds.split(',').filter(Boolean) : []
        setIdFilter(ids)
        const q = typeof router.query.search === 'string' ? router.query.search : ''
        if (q) setSearchTerm(q)
    }, [router.query.ids, router.query.search])

    const redirect = (page: string) => {
        Router.push(page)
    }

    const pickRandomRecipe = () => {
        if (filteredRecipes.length === 0) return;
        const randomIndex = Math.floor(Math.random() * filteredRecipes.length);
        const randomRecipe = filteredRecipes[randomIndex];
        redirect(`/recipes/${randomRecipe._id}`);
    }

    const hasActiveFilters = filterTime.length > 0 || filterPrice.length > 0 || filterGenre.length > 0 || filterCooked !== '' || filterMealTypes.length > 0 || showHidden

    const clearFilters = () => {
        setFilterTime([])
        setFilterPrice([])
        setFilterGenre([])
        setFilterCooked('')
        setFilterMealTypes([])
        setShowHidden(false)
    }

    const filteredRecipes = recipes
        .filter(recipe => {
            if (idFilter.length > 0 && !idFilter.includes(recipe._id)) return false
            if (recipe.hidden && !showHidden && !searchTerm && idFilter.length === 0 && bulkAction !== 'hide') return false
            if (searchTerm) {
                const term = searchTerm.toLowerCase()
                const matches = ['name', 'genre', 'time', 'priceCategory'].some(key =>
                    String(recipe[key] || '').toLowerCase().includes(term)
                )
                if (!matches) return false
            }
            if (filterTime.length > 0 && !filterTime.includes(recipe.time)) return false
            if (filterPrice.length > 0 && !filterPrice.includes(recipe.priceCategory)) return false
            if (filterGenre.length > 0 && !filterGenre.includes(recipe.genre)) return false
            if (filterCooked === 'cooked' && (recipe.timesCooked || 0) === 0) return false
            if (filterCooked === 'uncooked' && (recipe.timesCooked || 0) > 0) return false
            if (filterMealTypes.length > 0) {
                const recipeMeals = recipe.mealTypes || []
                if (!filterMealTypes.some(meal => recipeMeals.includes(meal))) return false
            }
            return true
        })
        .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.timesCooked || 0) - (a.timesCooked || 0))

    const deleteRecipe = async (id: string) => {
        const token = localStorage.getItem('Token')
        let res = await fetch("/api/Recipe/" + String(id), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': token || ''
            },
        })
        let data = await res.json()
        if (data.success === false || data.success === undefined) {
            alert(data.message || "failed, unexpected error")
        } else {
            setRecipes((prev) => prev.filter(obj => obj._id !== id))
        }
    }

    const toggleHiddenRecipe = async (recipe: Recipe) => {
        const token = localStorage.getItem('Token')
        const newVal = !recipe.hidden
        setRecipes((prev) => prev.map(obj => obj._id === recipe._id ? { ...obj, hidden: newVal } : obj))
        try {
            const res = await fetch("/api/Recipe/" + String(recipe._id), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': token || ''
                },
                body: JSON.stringify({ hidden: newVal })
            })
            const data = await res.json()
            if (data.success === false) {
                setRecipes((prev) => prev.map(obj => obj._id === recipe._id ? { ...obj, hidden: !newVal } : obj))
            }
        } catch (e) {
            setRecipes((prev) => prev.map(obj => obj._id === recipe._id ? { ...obj, hidden: !newVal } : obj))
        }
    }

    if (!isAuthed) return null

    return (
        <Layout title="Your Recipes" description="View and manage your recipes">
            <div className={`relative min-h-screen pb-24 ${pageShell.shell}`}>
                {/* Modern Header */}
                <header className="flex flex-col gap-2.5 md:mt-2">
                    <div className="flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terracotta/15 text-terracotta">
                                <ChefHat size={18} />
                            </span>
                            <div className="min-w-0">
                                <h1 className="font-cursive truncate text-2xl leading-tight text-foreground md:text-3xl">Your Recipes</h1>
                                {recipes.length > 0 && (
                                    <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                        {filteredRecipes.length} recipe{filteredRecipes.length === 1 ? '' : 's'}
                                    </p>
                                )}
                            </div>
                        </div>
                            {recipes.length > 0 && (
                            <div className="flex items-center gap-2">
                                {userData && (
                                    <div className="relative">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => bulkAction ? setBulkAction(null) : setBulkMenuOpen(!bulkMenuOpen)}
                                            className={bulkAction ? "text-terracotta bg-terracotta/10" : "text-muted-foreground"}
                                        >
                                            {bulkAction ? "Done" : "Bulk Actions"}
                                        </Button>
                                        {bulkMenuOpen && !bulkAction && (
                                            <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-card border border-border rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <button
                                                    onClick={() => { setBulkAction('hide'); setBulkMenuOpen(false) }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold hover:bg-muted/60 text-left"
                                                >
                                                    <EyeOff size={14} className="text-butter" /> Hide / Unhide
                                                </button>
                                                {userData?.role === "admin" && (
                                                    <button
                                                        onClick={() => { setBulkAction('delete'); setBulkMenuOpen(false) }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold hover:bg-muted/60 text-left text-berry"
                                                    >
                                                        <Trash2 size={14} /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            )}
                        </div>

                        {/* Search Bar Group */}
                        {recipes.length > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-terracotta" size={18} />
                                <Input
                                    placeholder="Search recipes..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-10 bg-foreground/[0.05] border-none rounded-xl focus-visible:ring-2 focus-visible:ring-terracotta/50 text-sm"
                                />
                            </div>
                            <Button
                                size="icon"
                                variant={hasActiveFilters ? "default" : "secondary"}
                                onClick={() => setShowFilters(true)}
                                className={`h-10 w-10 rounded-xl shrink-0 transition-all ${hasActiveFilters ? 'bg-terracotta text-primary-foreground shadow-lg shadow-terracotta/20' : 'bg-foreground/[0.06]'}`}
                            >
                                <SlidersHorizontal size={18} />
                                {hasActiveFilters && (
                                    <span className="absolute -top-1 -right-1 bg-berry text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-background shadow-lg">
                                        {filterTime.length + filterPrice.length + filterGenre.length + (filterCooked ? 1 : 0) + filterMealTypes.length + (showHidden ? 1 : 0)}
                                    </span>
                                )}
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                onClick={pickRandomRecipe}
                                disabled={filteredRecipes.length === 0}
                                className="h-10 w-10 rounded-xl shrink-0 bg-foreground/[0.06] hover:bg-terracotta/15 hover:text-terracotta transition-colors"
                                title="Pick for me"
                            >
                                <Dices size={18} />
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                onClick={() => redirect('/recipes/quiz')}
                                className="h-10 w-10 rounded-xl shrink-0 bg-foreground/[0.06] hover:bg-terracotta/15 hover:text-terracotta transition-colors"
                                title="Recipe quiz"
                            >
                                <Sparkles size={18} />
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                onClick={() => redirect('/map?recipes=1&from=/recipes')}
                                className="h-10 w-10 rounded-xl shrink-0 bg-foreground/[0.06] hover:bg-terracotta/15 hover:text-terracotta transition-colors"
                                title="View recipes on the world map"
                            >
                                <Compass size={18} />
                            </Button>
                        </div>
                        )}
                </header>

                 {/* Active Filter Chips (Scrollable Row) */}
                {recipes.length > 0 && hasActiveFilters && (
                    <div className="flex items-center gap-2 py-1 overflow-x-auto no-scrollbar">
                         {filterTime.map(t => (
                            <button key={t} onClick={() => setFilterTime(prev => prev.filter(i => i !== t))} className="shrink-0 px-3 py-1.5 rounded-full bg-terracotta/10 text-terracotta text-xs font-bold flex items-center gap-1">
                                {t} <Plus size={12} className="rotate-45" />
                            </button>
                        ))}
                        {filterPrice.map(p => (
                            <button key={p} onClick={() => setFilterPrice(prev => prev.filter(i => i !== p))} className="shrink-0 px-3 py-1.5 rounded-full bg-terracotta/10 text-terracotta text-xs font-bold flex items-center gap-1">
                                {p === 'cheap' ? '$' : p === 'medium' ? '$$' : '$$$'} <Plus size={12} className="rotate-45" />
                            </button>
                        ))}
                        {filterGenre.map(g => (
                            <button key={g} onClick={() => setFilterGenre(prev => prev.filter(i => i !== g))} className="shrink-0 px-3 py-1.5 rounded-full bg-terracotta/10 text-terracotta text-xs font-bold flex items-center gap-1">
                                {g} <Plus size={12} className="rotate-45" />
                            </button>
                        ))}
                         {filterCooked && (
                            <button onClick={() => setFilterCooked('')} className="shrink-0 px-3 py-1.5 rounded-full bg-terracotta/10 text-terracotta text-xs font-bold flex items-center gap-1">
                                {filterCooked === 'cooked' ? '👨‍🍳 Already Cooked' : '📝 Never Cooked'} <Plus size={12} className="rotate-45" />
                            </button>
                        )}
                        {filterMealTypes.map(m => (
                            <button key={m} onClick={() => setFilterMealTypes(prev => prev.filter(i => i !== m))} className="shrink-0 px-3 py-1.5 rounded-full bg-terracotta/10 text-terracotta text-xs font-bold flex items-center gap-1">
                                🍽️ {m} <Plus size={12} className="rotate-45" />
                            </button>
                        ))}
                        {showHidden && (
                            <button onClick={() => setShowHidden(false)} className="shrink-0 px-3 py-1.5 rounded-full bg-butter/10 text-butter text-xs font-bold flex items-center gap-1">
                                👁️ Hidden <Plus size={12} className="rotate-45" />
                            </button>
                        )}
                        <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-berry whitespace-nowrap px-2">
                            Clear all
                        </button>
                    </div>
                )}

                {/* Dish-linked filter banner */}
                {recipes.length > 0 && idFilter.length > 0 && (
                    <div className="flex items-center gap-2 py-1">
                        <span className="px-3 py-1.5 rounded-full bg-terracotta/10 text-terracotta text-xs font-bold flex items-center gap-2">
                            <ChefHat size={12} /> Showing recipes for this dish
                        </span>
                        <button
                            onClick={() => { setIdFilter([]); Router.push('/recipes') }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            Clear
                        </button>
                    </div>
                )}

                {/* Results Info */}
                {recipes.length > 0 && (
                    <div className="flex items-center justify-between py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span>{filteredRecipes.length} Recipes</span>
                        <div className="flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors">
                            <ArrowUpDown size={10} />
                            Sort
                        </div>
                    </div>
                )}

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 pt-2">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-foreground/[0.05] rounded-2xl" style={{ height: '11rem', animationDelay: `${i * 40}ms` }} />
                        ))}
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6 mt-4 border border-dashed border-border rounded-3xl bg-muted/40">
                        <div className="w-20 h-20 bg-terracotta/10 rounded-full flex items-center justify-center mb-6 text-4xl">
                            🍳
                        </div>
                        <h2 className="text-xl font-bold mb-2">Your cookbook is empty</h2>
                        <p className="text-sm text-muted-foreground max-w-[340px] mb-6">
                            Explore dish lists to find dishes from around the world. Tap one, then use its recipe creation flow to save your first recipe.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button onClick={() => redirect('/dishLists')} className="rounded-xl bg-terracotta text-primary-foreground hover:bg-terracotta/85">
                                <Globe2 size={16} /> Explore dish lists
                            </Button>
                            <Button onClick={() => redirect('/createRecipe')} variant="outline" className="rounded-xl">
                                <Plus size={16} /> Create one manually
                            </Button>
                        </div>
                    </div>
                ) : filteredRecipes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6 mt-4 border border-dashed border-border rounded-3xl bg-muted/40">
                        <div className="w-20 h-20 bg-terracotta/10 rounded-full flex items-center justify-center mb-6 text-4xl">
                            🍳
                        </div>
                        <h2 className="text-xl font-bold mb-2">No recipes found</h2>
                        <p className="text-sm text-muted-foreground max-w-[240px] mb-6">
                            Try adjusting your filters or search terms to find what you're looking for.
                        </p>
                        <Button onClick={clearFilters} variant="outline" className="rounded-xl">
                            Reset Filters
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                        {filteredRecipes.map((recipe, index) => {
                            const extraTags = []
                            if (filterPrice.length > 1 && recipe.priceCategory) {
                                extraTags.push({ type: 'price' as const, value: recipe.priceCategory })
                            }
                            if (filterGenre.length > 1 && recipe.genre) {
                                extraTags.push({ type: 'genre' as const, value: recipe.genre })
                            }
                            if (filterMealTypes.length > 1) {
                                (recipe.mealTypes || []).forEach(m => {
                                    if (filterMealTypes.includes(m)) {
                                        extraTags.push({ type: 'mealType' as const, value: m })
                                    }
                                })
                            }
                            return (
                                <div key={recipe._id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                                    <ImageCard
                                        recipe={recipe}
                                        bulkAction={bulkAction}
                                        allowDelete={bulkAction === 'delete'}
                                        onDelete={deleteRecipe}
                                        onToggleHidden={toggleHiddenRecipe}
                                        onRedirect={redirect}
                                        extraTags={extraTags}
                                    />
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Mobile Floating Action Button */}
                <Button
                    onClick={() => redirect("/createRecipe")}
                    className="fixed bottom-24 sm:bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl shadow-terracotta/40 bg-terracotta text-primary-foreground hover:scale-110 active:scale-95 transition-all z-50 p-0"
                >
                    <Plus size={28} />
                </Button>
            </div>

            <FilterSheet
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                filterTime={filterTime}
                setFilterTime={setFilterTime}
                filterPrice={filterPrice}
                setFilterPrice={setFilterPrice}
                filterGenre={filterGenre}
                setFilterGenre={setFilterGenre}
                filterCooked={filterCooked}
                setFilterCooked={setFilterCooked}
                filterMealTypes={filterMealTypes}
                setFilterMealTypes={setFilterMealTypes}
                showHidden={showHidden}
                setShowHidden={setShowHidden}
                clearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
            />

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </Layout>
    )
}
