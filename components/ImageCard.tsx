import React from 'react'
import { useRouter } from 'next/router'
import { Button } from './ui/button'
import { Flame, DollarSign, Clock, Utensils, Trash2 } from 'lucide-react'

export interface Recipe {
    _id: string
    name: string
    image?: string
    cost?: number
    time?: 'short' | 'medium' | 'long'
    genre?: string
    priceCategory?: 'cheap' | 'medium' | 'expensive'
    mealTypes?: string[]
    approxCost?: number
    timesCooked?: number
}

interface ImageCardProps {
    recipe: Recipe
    allowDelete?: boolean
    onDelete?: (id: string) => void
    onRedirect?: (path: string) => void
    cardHeight?: string
}

const timeConfig: Record<'short' | 'medium' | 'long', { label: string; icon: React.ReactNode; color: string }> = {
    short: { label: 'Quick', icon: <Flame size={10} />, color: 'text-orange-400 bg-orange-400/10' },
    medium: { label: 'Medium', icon: <Clock size={10} />, color: 'text-emerald-400 bg-emerald-400/10' },
    long: { label: 'Slow Cook', icon: <Utensils size={10} />, color: 'text-blue-400 bg-blue-400/10' }
}

const priceConfig: Record<'cheap' | 'medium' | 'expensive', { label: string; color: string }> = {
    cheap: { label: '$', color: 'text-emerald-400 bg-emerald-400/10' },
    medium: { label: '$$', color: 'text-amber-400 bg-amber-400/10' },
    expensive: { label: '$$$', color: 'text-rose-400 bg-rose-400/10' }
}

export default function ImageCard({ recipe, allowDelete, onDelete, onRedirect, cardHeight = '11rem' }: ImageCardProps) {
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
            className="group relative flex flex-col bg-secondary/30 backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:bg-secondary/40 hover:shadow-2xl hover:shadow-accent/5 cursor-pointer"
            style={{ height: cardHeight }}
            onClick={() => handleRedirect(`${currentPath}/${recipe._id}`)}
        >
            {/* Background Image / Placeholder */}
            <div className="absolute inset-0 w-full h-full overflow-hidden">
                {recipe.image ? (
                    <>
                        <img
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 brightness-[0.7] group-hover:brightness-[0.6]"
                            src={recipe.image}
                            alt={recipe.name}
                        />
                        {/* Dark Gradient Overlay for text readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    </>
                ) : (
                    <div
                        className="w-full h-full flex items-center justify-center relative"
                        style={{ background: `linear-gradient(135deg, ${dynamicBgColor}, ${stringToHslColor(recipe.name, 40, 20)})` }}
                    >
                        <Utensils size={40} className="text-white/10" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        
                        {currentPath.includes('shoppingList') && (
                            <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white uppercase border border-white/10">
                                {recipe.cost !== undefined ? `$${recipe.cost.toFixed(2)}` : '?'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Top Actions/Badges */}
            <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-20">
                {recipe.genre && (
                    <div className="px-2 py-1 rounded-lg bg-black/40 backdrop-blur-md text-[9px] font-bold text-white uppercase tracking-wider border border-white/10">
                        {recipe.genre}
                    </div>
                )}
                
                {allowDelete && onDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(recipe._id); }}
                        className="w-8 h-8 flex items-center justify-center bg-rose-500 text-white rounded-full shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-200 hover:bg-rose-600 ml-auto"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>

            {/* Info Section (Absolute bottom) */}
            <div className="absolute bottom-0 left-0 right-0 p-3 z-20 flex flex-col gap-1.5">
                <h3 className="text-sm font-bold leading-tight line-clamp-2 tracking-tight text-white drop-shadow-md">
                    {recipe.name}
                </h3>

                {isRecipesPage && (recipe.time || recipe.priceCategory) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {recipe.time && timeConfig[recipe.time] && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter bg-white/10 backdrop-blur-md text-white border border-white/10">
                                {React.cloneElement(timeConfig[recipe.time].icon as React.ReactElement<{ size: number }>, { size: 10 })}
                                {timeConfig[recipe.time].label}
                            </span>
                        )}
                        {recipe.priceCategory && priceConfig[recipe.priceCategory] && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 backdrop-blur-md text-white border border-white/10">
                                {priceConfig[recipe.priceCategory].label}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
