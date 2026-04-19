import Head from 'next/head'
import { useEffect, useState } from 'react'
import Router from 'next/router'
import { Layout } from '../../components/Layout'
import ImageCard from '../../components/ImageCard'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useAuthGuard } from '../../lib/useAuthGuard'
import { 
    Search, 
    SlidersHorizontal, 
    Plus, 
    Dices, 
    Calendar,
    ArrowUpDown,
    ChefHat,
    Loader2
} from 'lucide-react'
import { FilterSheet } from '../../components/recipes/FilterSheet'

export default function Recipes() {
    const isAuthed = useAuthGuard()
    const [userData, setUserData] = useState<any>({})
    const [recipes, setRecipes] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [allowDelete, setAllowDelete] = useState(false)
    const [filterTime, setFilterTime] = useState<string[]>([])
    const [filterPrice, setFilterPrice] = useState<string[]>([])
    const [filterGenre, setFilterGenre] = useState<string>('')
    const [filterCooked, setFilterCooked] = useState<string>('')
    const [filterMealTypes, setFilterMealTypes] = useState<string[]>([])
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

    const redirect = (page: string) => {
        Router.push(page)
    }

    const pickRandomRecipe = () => {
        if (filteredRecipes.length === 0) return;
        const randomIndex = Math.floor(Math.random() * filteredRecipes.length);
        const randomRecipe = filteredRecipes[randomIndex];
        redirect(`/recipes/${randomRecipe._id}`);
    }

    const hasActiveFilters = filterTime.length > 0 || filterPrice.length > 0 || filterGenre !== '' || filterCooked !== '' || filterMealTypes.length > 0

    const clearFilters = () => {
        setFilterTime([])
        setFilterPrice([])
        setFilterGenre('')
        setFilterCooked('')
        setFilterMealTypes([])
    }

    const filteredRecipes = recipes
        .filter(recipe => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase()
                const matches = ['name', 'genre', 'time', 'priceCategory'].some(key =>
                    String(recipe[key] || '').toLowerCase().includes(term)
                )
                if (!matches) return false
            }
            if (filterTime.length > 0 && !filterTime.includes(recipe.time)) return false
            if (filterPrice.length > 0 && !filterPrice.includes(recipe.priceCategory)) return false
            if (filterGenre && recipe.genre !== filterGenre) return false
            if (filterCooked === 'cooked' && (recipe.timesCooked || 0) === 0) return false
            if (filterCooked === 'uncooked' && (recipe.timesCooked || 0) > 0) return false
            if (filterMealTypes.length > 0) {
                const recipeMeals = recipe.mealTypes || []
                if (!filterMealTypes.some(meal => recipeMeals.includes(meal))) return false
            }
            return true
        })
        .sort((a, b) => (b.timesCooked || 0) - (a.timesCooked || 0))

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

    if (!isAuthed) return null

    return (
        <Layout title="Your Recipes" description="View and manage your recipes">
            <div className="relative min-h-screen pb-24">
                {/* Modern Header */}
                <header className="sticky top-0 z-40 -mx-6 sm:-mx-8 px-6 sm:px-8 py-4 bg-background/80 backdrop-blur-xl shadow-sm">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                                <ChefHat className="text-accent" />
                                Your Recipes
                            </h1>
                            <div className="flex items-center gap-2">
                                {userData?.role === "admin" && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setAllowDelete(!allowDelete)}
                                        className={allowDelete ? "text-rose-500 bg-rose-500/10" : "text-muted-foreground"}
                                    >
                                        Mass Delete
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Search Bar Group */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" size={18} />
                                <Input
                                    placeholder="Search recipes..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-12 bg-secondary/50 border-none rounded-2xl focus-visible:ring-2 focus-visible:ring-accent/50"
                                />
                            </div>
                            <Button
                                size="icon"
                                variant={hasActiveFilters ? "default" : "secondary"}
                                onClick={() => setShowFilters(true)}
                                className={`h-12 w-12 rounded-2xl shrink-0 transition-all ${hasActiveFilters ? 'bg-accent text-accent-foreground shadow-lg shadow-accent/20' : 'bg-secondary/50'}`}
                            >
                                <SlidersHorizontal size={20} />
                                {hasActiveFilters && (
                                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-background shadow-lg">
                                        {filterTime.length + filterPrice.length + (filterGenre ? 1 : 0) + (filterCooked ? 1 : 0) + filterMealTypes.length}
                                    </span>
                                )}
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                onClick={pickRandomRecipe}
                                disabled={filteredRecipes.length === 0}
                                className="h-12 w-12 rounded-2xl shrink-0 bg-secondary/50 hover:bg-accent/20 hover:text-accent transition-colors"
                                title="Pick for me"
                            >
                                <Dices size={20} />
                            </Button>
                        </div>
                    </div>
                </header>

                 {/* Active Filter Chips (Scrollable Row) */}
                {hasActiveFilters && (
                    <div className="flex items-center gap-2 py-4 overflow-x-auto no-scrollbar -mx-6 px-6 sm:mx-0 sm:px-0">
                         {filterTime.map(t => (
                            <button key={t} onClick={() => setFilterTime(prev => prev.filter(i => i !== t))} className="shrink-0 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center gap-1 shadow-sm">
                                {t} <Plus size={12} className="rotate-45" />
                            </button>
                        ))}
                        {filterPrice.map(p => (
                            <button key={p} onClick={() => setFilterPrice(prev => prev.filter(i => i !== p))} className="shrink-0 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center gap-1 shadow-sm">
                                {p === 'cheap' ? '$' : p === 'medium' ? '$$' : '$$$'} <Plus size={12} className="rotate-45" />
                            </button>
                        ))}
                        {filterGenre && (
                            <button onClick={() => setFilterGenre('')} className="shrink-0 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center gap-1 shadow-sm">
                                {filterGenre} <Plus size={12} className="rotate-45" />
                            </button>
                        )}
                         {filterCooked && (
                            <button onClick={() => setFilterCooked('')} className="shrink-0 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center gap-1 shadow-sm">
                                {filterCooked === 'cooked' ? '👨‍🍳 Already Cooked' : '📝 Never Cooked'} <Plus size={12} className="rotate-45" />
                            </button>
                        )}
                        {filterMealTypes.map(m => (
                            <button key={m} onClick={() => setFilterMealTypes(prev => prev.filter(i => i !== m))} className="shrink-0 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center gap-1 shadow-sm">
                                🍽️ {m} <Plus size={12} className="rotate-45" />
                            </button>
                        ))}
                        <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-rose-500 whitespace-nowrap px-2">
                            Clear all
                        </button>
                    </div>
                )}

                {/* Results Info */}
                <div className="flex items-center justify-between py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <span>{filteredRecipes.length} Recipes</span>
                    <div className="flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors">
                        <ArrowUpDown size={12} />
                        Sort
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="animate-spin text-accent" size={32} />
                        <p className="text-sm font-medium text-muted-foreground">Fetching your cookbook...</p>
                    </div>
                ) : filteredRecipes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center px-6 border border-dashed border-border/10 rounded-3xl bg-secondary/50 shadow-inner">
                        <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mb-6 text-4xl">
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
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredRecipes.map((recipe, index) => (
                            <div key={recipe._id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                                <ImageCard
                                    recipe={recipe}
                                    allowDelete={allowDelete}
                                    onDelete={deleteRecipe}
                                    onRedirect={redirect}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Mobile Floating Action Button */}
                <Button
                    onClick={() => redirect("/createRecipe")}
                    className="fixed bottom-24 sm:bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl shadow-accent/40 bg-accent text-accent-foreground hover:scale-110 active:scale-95 transition-all z-50 p-0"
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
