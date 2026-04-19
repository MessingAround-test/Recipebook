import React from 'react'
import { useRouter } from 'next/router'
import { Button } from './ui/button'
import { Flame, DollarSign, Clock, Utensils, Trash2 } from 'lucide-react'

interface Recipe {
    _id: string
    name: string
    image?: string
    cost?: number
    time?: 'short' | 'medium' | 'long'
    genre?: string
    priceCategory?: 'cheap' | 'medium' | 'expensive'
    approxCost?: number
}

interface ImageCardProps {
    recipe: Recipe
    allowDelete?: boolean
    onDelete?: (id: string) => void
    onRedirect?: (path: string) => void
    cardHeight?: string
}

const timeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    short: { label: 'Quick', icon: <Flame size={10} />, color: 'text-orange-400 bg-orange-400/10' },
    medium: { label: 'Medium', icon: <Clock size={10} />, color: 'text-emerald-400 bg-emerald-400/10' },
    long: { label: 'Slow Cook', icon: <Utensils size={10} />, color: 'text-blue-400 bg-blue-400/10' }
}

const priceConfig: Record<string, { label: string; color: string }> = {
    cheap: { label: '$', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    medium: { label: '$$', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    expensive: { label: '$$$', color: 'text-rose-400 bg-rose-400/10 border-rose-400/20' }
}

export default function ImageCard({ recipe, allowDelete, onDelete, onRedirect, cardHeight = '14rem' }: ImageCardProps) {
    const router = useRouter()
    const currentPath = router.pathname

    const handleRedirect = (path: string) => {
        if (onRedirect) onRedirect(path)
        else router.push(path)
    }

    const stringToHslColor = (str: string, s: number, l: number) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360;
        return `hsl(${h}, ${s}%, ${l}%)`;
    }

    const dynamicBgColor = recipe.image ? 'transparent' : stringToHslColor(recipe.name, 40, 30);
    const isRecipesPage = currentPath.includes('recipes');

    return (
        <div 
            className="group relative flex flex-col bg-secondary/30 backdrop-blur-md border border-border/50 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:border-accent/40 hover:shadow-2xl hover:shadow-accent/5 cursor-pointer"
            style={{ height: cardHeight }}
            onClick={() => handleRedirect(`${currentPath}/${recipe._id}`)}
        >
            {/* Delete Action */}
            {allowDelete && onDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(recipe._id); }}
                    className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center bg-rose-500 text-white rounded-full shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-200 hover:bg-rose-600"
                >
                    <Trash2 size={14} />
                </button>
            )}

            {/* Image Section */}
            <div className="relative w-full h-[60%] shrink-0 overflow-hidden border-b border-border/20">
                {recipe.image ? (
                    <img
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        src={recipe.image}
                        alt={recipe.name}
                    />
                ) : (
                    <div
                        className="w-full h-full flex items-center justify-center relative"
                        style={{ background: `linear-gradient(135deg, ${dynamicBgColor}, ${stringToHslColor(recipe.name, 40, 20)})` }}
                    >
                        <Utensils size={40} className="text-white/10" />
                        
                        {currentPath.includes('shoppingList') && (
                            <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white border border-white/10">
                                {recipe.cost !== undefined ? `$${recipe.cost.toFixed(2)}` : '?'}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Visual Overlay for contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Quick Genre Badge if available and image exists */}
                {recipe.genre && (
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-md text-[9px] font-bold text-white border border-white/10 uppercase tracking-wider">
                        {recipe.genre}
                    </div>
                )}
            </div>

            {/* Info Section */}
            <div className="flex flex-col flex-1 p-3 gap-2 justify-between">
                <h3 className="text-sm font-bold leading-tight line-clamp-2 tracking-tight">
                    {recipe.name}
                </h3>

                {isRecipesPage && (recipe.time || recipe.priceCategory) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {recipe.time && timeConfig[recipe.time] && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter ${timeConfig[recipe.time].color}`}>
                                {timeConfig[recipe.time].icon}
                                {timeConfig[recipe.time].label}
                            </span>
                        )}
                        {recipe.priceCategory && priceConfig[recipe.priceCategory] && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${priceConfig[recipe.priceCategory].color}`}>
                                {priceConfig[recipe.priceCategory].label}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
