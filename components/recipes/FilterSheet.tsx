import React from 'react'
import { X, Flame, DollarSign, Utensils, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '../ui/button'

interface FilterSheetProps {
    isOpen: boolean
    onClose: () => void
    filterTime: string[]
    setFilterTime: (v: string[]) => void
    filterPrice: string[]
    setFilterPrice: (v: string[]) => void
    filterGenre: string
    setFilterGenre: (v: string) => void
    filterCooked: string
    setFilterCooked: (v: string) => void
    filterMealTypes: string[]
    setFilterMealTypes: (v: string[]) => void
    clearFilters: () => void
    hasActiveFilters: boolean
}

const TIME_OPTIONS = [
    { id: 'short', label: 'Quick', icon: <Flame size={14} className="text-orange-400" />, sub: '< 30 mins' },
    { id: 'medium', label: 'Medium', icon: <Flame size={14} className="text-emerald-400" />, sub: '30-60 mins' },
    { id: 'long', label: 'Slow Cook', icon: <Flame size={14} className="text-blue-400" />, sub: '1h+' }
]

const PRICE_OPTIONS = [
    { id: 'cheap', label: 'Budget', icon: <DollarSign size={14} />, color: 'bg-emerald-500' },
    { id: 'medium', label: 'Standard', icon: <><DollarSign size={14} /><DollarSign size={14} /></>, color: 'bg-amber-500' },
    { id: 'expensive', label: 'Premium', icon: <><DollarSign size={14} /><DollarSign size={14} /><DollarSign size={14} /></>, color: 'bg-rose-500' }
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
    clearFilters,
    hasActiveFilters
}: FilterSheetProps) {
    if (!isOpen) return null

    const toggleMulti = (val: string, current: string[], setter: (v: string[]) => void) => {
        if (current.includes(val)) setter(current.filter(v => v !== val))
        else setter([...current, val])
    }

    return (
        <div className="fixed inset-0 z-[2000] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div 
                className="absolute inset-0 cursor-pointer" 
                onClick={onClose}
            />
            
            <div className="relative w-full max-w-md bg-card border-t sm:border border-border/10 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300 ease-out">
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-border/10 bg-card/80 backdrop-blur-md shrink-0">
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
                            <Utensils size={12} className="text-accent" /> Cook Time
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {TIME_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => toggleMulti(opt.id, filterTime, setFilterTime)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                                        filterTime.includes(opt.id)
                                            ? 'bg-accent/10 border-accent ring-1 ring-accent/50'
                                            : 'bg-secondary/30 border-border/10 hover:border-accent/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl transition-colors ${filterTime.includes(opt.id) ? 'bg-accent text-accent-foreground' : 'bg-secondary'}`}>
                                            {opt.icon}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold leading-tight">{opt.label}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium">{opt.sub}</p>
                                        </div>
                                    </div>
                                    {filterTime.includes(opt.id) && <CheckCircle2 size={16} className="text-accent animate-in zoom-in duration-300" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Price Range */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                             <DollarSign size={12} className="text-accent" /> Price Category
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {PRICE_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => toggleMulti(opt.id, filterPrice, setFilterPrice)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all duration-300 ${
                                        filterPrice.includes(opt.id)
                                            ? `${opt.color} text-white border-transparent shadow-lg shadow-${opt.color.split('-')[1]}-500/20`
                                            : 'bg-secondary/30 border-border/10 hover:border-accent/30'
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
                                    onClick={() => setFilterGenre(filterGenre === g ? '' : g)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                                        filterGenre === g
                                            ? 'bg-accent text-accent-foreground shadow-md'
                                            : 'bg-secondary/30 border border-border/10 text-muted-foreground hover:text-foreground hover:border-accent/30'
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
                                        ? 'bg-accent/10 border-accent text-accent ring-1 ring-accent/50'
                                        : 'bg-secondary/30 border-border/10 text-muted-foreground hover:border-accent/30'
                                }`}
                            >
                                <div className={`p-1.5 rounded-full ${filterCooked === 'cooked' ? 'bg-accent text-accent-foreground' : 'bg-secondary'}`}>
                                    {filterCooked === 'cooked' ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                                </div>
                                <span className="text-xs font-bold">Already Cooked</span>
                            </button>
                            <button
                                onClick={() => setFilterCooked(filterCooked === 'uncooked' ? '' : 'uncooked')}
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                                    filterCooked === 'uncooked'
                                        ? 'bg-accent/10 border-accent text-accent ring-1 ring-accent/50'
                                        : 'bg-secondary/30 border-border/10 text-muted-foreground hover:border-accent/30'
                                }`}
                            >
                                <div className={`p-1.5 rounded-full ${filterCooked === 'uncooked' ? 'bg-accent text-accent-foreground' : 'bg-secondary'}`}>
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
                                            ? 'bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20'
                                            : 'bg-secondary/30 border-border/10 text-muted-foreground hover:border-accent/30'
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-card border-t border-border/10 flex gap-3 shrink-0">
                    {hasActiveFilters && (
                        <Button 
                            variant="outline" 
                            className="flex-1 rounded-2xl py-6 border-accent/20 text-accent hover:bg-accent/5 font-bold text-xs uppercase tracking-widest h-auto"
                            onClick={clearFilters}
                        >
                            Reset
                        </Button>
                    )}
                    <Button 
                        className="flex-[2] rounded-2xl py-6 font-black shadow-xl shadow-accent/20 h-auto text-xs uppercase tracking-[0.2em]"
                        onClick={onClose}
                    >
                        Show Results
                    </Button>
                </div>
            </div>
        </div>
    )
}
