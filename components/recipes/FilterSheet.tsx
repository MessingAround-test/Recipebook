import React from 'react'
import { X, Flame, DollarSign, Utensils, CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react'
import { Button } from '../ui/button'

interface FilterSheetProps {
    isOpen: boolean
    onClose: () => void
    filterTime: string[]
    setFilterTime: (v: string[]) => void
    filterPrice: string[]
    setFilterPrice: (v: string[]) => void
    filterGenre: string[]
    setFilterGenre: (v: string[]) => void
    filterCooked: string
    setFilterCooked: (v: string) => void
    filterMealTypes: string[]
    setFilterMealTypes: (v: string[]) => void
    showHidden: boolean
    setShowHidden: (v: boolean) => void
    clearFilters: () => void
    hasActiveFilters: boolean
}

const TIME_OPTIONS = [
    { id: 'short', label: 'Quick', icon: <Flame size={14} className="text-terracotta" />, sub: '< 30 mins' },
    { id: 'medium', label: 'Medium', icon: <Flame size={14} className="text-olive" />, sub: '30-60 mins' },
    { id: 'long', label: 'Slow Cook', icon: <Flame size={14} className="text-water" />, sub: '1h+' }
]

const PRICE_OPTIONS = [
    { id: 'cheap', label: 'Budget', icon: <DollarSign size={14} />, color: 'bg-olive' },
    { id: 'medium', label: 'Standard', icon: <><DollarSign size={14} /><DollarSign size={14} /></>, color: 'bg-butter' },
    { id: 'expensive', label: 'Premium', icon: <><DollarSign size={14} /><DollarSign size={14} /><DollarSign size={14} /></>, color: 'bg-berry' }
]

const GENRE_OPTIONS = [
    'Italian', 'Mexican', 'Asian', 'Indian', 'Mediterranean', 'American',
    'French', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Greek',
    'Chinese', 'Vietnamese', 'Other'
]
const MEAL_OPTIONS = ['Breakfast', 'Lunch', 'Main', 'Entree', 'Dessert', 'Snack']

export function FilterSheet({
    isOpen,
    onClose,
    filterTime,
    setFilterTime,
    filterPrice,
    setFilterPrice,
    filterGenre,
    setFilterGenre,
    filterCooked,
    setFilterCooked,
    filterMealTypes,
    setFilterMealTypes,
    showHidden,
    setShowHidden,
    clearFilters,
    hasActiveFilters
}: FilterSheetProps) {
    if (!isOpen) return null

    const toggleMulti = (val: string, current: string[], setter: (v: string[]) => void) => {
        if (current.includes(val)) setter(current.filter(v => v !== val))
        else setter([...current, val])
    }

    return (
        <div className="fixed inset-0 z-[2000] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:pb-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div 
                className="absolute inset-0 cursor-pointer" 
                onClick={onClose}
            />
            
            <div className="relative w-full max-w-md bg-card border-t sm:border border-border rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300 ease-out">
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-border bg-card/80 backdrop-blur-md shrink-0">
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Filter Recipes</h2>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">Refine your collection</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-secondary rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                    {/* Cook Time */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                            <Utensils size={12} className="text-terracotta" /> Cook Time
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {TIME_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => toggleMulti(opt.id, filterTime, setFilterTime)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                                        filterTime.includes(opt.id)
                                            ? 'bg-terracotta/10 border-terracotta ring-1 ring-terracotta/50'
                                            : 'bg-secondary/30 border-border hover:border-terracotta/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl transition-colors ${filterTime.includes(opt.id) ? 'bg-terracotta text-primary-foreground' : 'bg-secondary'}`}>
                                            {opt.icon}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold leading-tight">{opt.label}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium">{opt.sub}</p>
                                        </div>
                                    </div>
                                    {filterTime.includes(opt.id) && <CheckCircle2 size={16} className="text-terracotta animate-in zoom-in duration-300" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Price Range */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                             <DollarSign size={12} className="text-terracotta" /> Price Category
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {PRICE_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => toggleMulti(opt.id, filterPrice, setFilterPrice)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all duration-300 ${
                                        filterPrice.includes(opt.id)
                                            ? `${opt.color} text-white border-transparent`
                                            : 'bg-secondary/30 border-border hover:border-terracotta/30'
                                    }`}
                                >
                                    <span className="flex items-center opacity-80">{opt.icon}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cuisine */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Cuisine</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {GENRE_OPTIONS.map(g => (
                                <button
                                    key={g}
                                    onClick={() => toggleMulti(g, filterGenre, setFilterGenre)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                                        filterGenre.includes(g)
                                            ? 'bg-terracotta text-primary-foreground shadow-md'
                                            : 'bg-secondary/30 border border-border text-muted-foreground hover:text-foreground hover:border-terracotta/30'
                                    }`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Cook Status</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setFilterCooked(filterCooked === 'cooked' ? '' : 'cooked')}
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                                    filterCooked === 'cooked'
                                        ? 'bg-terracotta/10 border-terracotta text-terracotta ring-1 ring-terracotta/50'
                                        : 'bg-secondary/30 border-border text-muted-foreground hover:border-terracotta/30'
                                }`}
                            >
                                <div className={`p-1.5 rounded-full ${filterCooked === 'cooked' ? 'bg-terracotta text-primary-foreground' : 'bg-secondary'}`}>
                                    {filterCooked === 'cooked' ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                                </div>
                                <span className="text-xs font-bold">Already Cooked</span>
                            </button>
                            <button
                                onClick={() => setFilterCooked(filterCooked === 'uncooked' ? '' : 'uncooked')}
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                                    filterCooked === 'uncooked'
                                        ? 'bg-terracotta/10 border-terracotta text-terracotta ring-1 ring-terracotta/50'
                                        : 'bg-secondary/30 border-border text-muted-foreground hover:border-terracotta/30'
                                }`}
                            >
                                <div className={`p-1.5 rounded-full ${filterCooked === 'uncooked' ? 'bg-terracotta text-primary-foreground' : 'bg-secondary'}`}>
                                    {filterCooked === 'uncooked' ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                                </div>
                                <span className="text-xs font-bold">Never Cooked</span>
                            </button>
                        </div>
                    </div>

                    {/* Meal Type */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                            🍽️ Meal Type
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {MEAL_OPTIONS.map(m => (
                                <button
                                    key={m}
                                    onClick={() => toggleMulti(m, filterMealTypes, setFilterMealTypes)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-300 ${
                                        filterMealTypes.includes(m)
                                            ? 'bg-terracotta text-primary-foreground border-terracotta shadow-lg shadow-terracotta/20'
                                            : 'bg-secondary/30 border-border text-muted-foreground hover:border-terracotta/30'
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Show Hidden */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                            <Eye size={12} className="text-terracotta" /> Hidden Items
                        </h3>
                        <button
                            onClick={() => setShowHidden(!showHidden)}
                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 w-full ${
                                showHidden
                                    ? 'bg-butter/10 border-butter ring-1 ring-butter/50 text-butter'
                                    : 'bg-secondary/30 border-border text-muted-foreground hover:border-butter/30'
                            }`}
                        >
                            <div className={`p-1.5 rounded-full ${showHidden ? 'bg-butter text-primary-foreground' : 'bg-secondary'}`}>
                                {showHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-bold">Show Hidden Items</p>
                                <p className="text-[10px] text-muted-foreground font-medium">Include health-tracked foods</p>
                            </div>
                            {showHidden && <CheckCircle2 size={16} className="text-butter ml-auto animate-in zoom-in duration-300" />}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-card border-t border-border flex gap-3 shrink-0">
                    {hasActiveFilters && (
                        <Button 
                            variant="outline" 
                            className="flex-1 rounded-2xl py-6 border-terracotta/20 text-terracotta hover:bg-terracotta/5 font-bold text-xs uppercase tracking-widest h-auto"
                            onClick={clearFilters}
                        >
                            Reset
                        </Button>
                    )}
                    <Button 
                        className="flex-[2] rounded-2xl py-6 font-black shadow-xl shadow-terracotta/20 h-auto text-xs uppercase tracking-[0.2em]"
                        onClick={onClose}
                    >
                        Show Results
                    </Button>
                </div>
            </div>
        </div>
    )
}



