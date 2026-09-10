import React from 'react'
import { useRouter } from 'next/router'
import { Button } from './ui/button'
import { Flame, DollarSign, Clock, Utensils, Trash2, Eye, EyeOff } from 'lucide-react'

export interface Recipe {
    _id: string
    name: string
    image?: string
    hasImage?: boolean
    cost?: number
    time?: 'short' | 'medium' | 'long'
    genre?: string
    priceCategory?: 'cheap' | 'medium' | 'expensive'
    mealTypes?: string[]
    approxCost?: number
    timesCooked?: number
    hidden?: boolean
    instructions?: Array<{ time?: number }>
    prepWork?: Array<{ timeEstimate?: number; optional?: boolean }>
}

interface ImageCardProps {
    recipe: Recipe
    allowDelete?: boolean
    onDelete?: (id: string) => void
    onRedirect?: (path: string) => void
    cardHeight?: string
    bulkAction?: 'delete' | 'hide' | null
    onToggleHidden?: (recipe: Recipe) => void
    extraTags?: Array<{ type: 'price' | 'genre' | 'mealType', value: string }>
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

export default function ImageCard({ recipe, allowDelete, onDelete, onRedirect, cardHeight = '11rem', bulkAction, onToggleHidden, extraTags = [] }: ImageCardProps) {
    const router = useRouter()
    const currentPath = router.pathname

    const extraTagLabels = extraTags.map(t => {
        if (t.type === 'price' && recipe.priceCategory && priceConfig[recipe.priceCategory]) {
            return { key: `${t.type}-${t.value}`, label: priceConfig[recipe.priceCategory].label, color: priceConfig[recipe.priceCategory].color }
        }
        const color = t.type === 'genre' ? 'text-emerald-400 bg-emerald-400/10'
            : t.type === 'mealType' ? 'text-violet-400 bg-violet-400/10'
            : 'text-white bg-white/10'
        return { key: `${t.type}-${t.value}`, label: t.value, color }
    })

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

    const imageUrl = recipe.image ?? (recipe.hasImage ? `/api/Recipe/${recipe._id}/image?q=thumb` : undefined)
    const dynamicBgColor = imageUrl ? 'transparent' : stringToHslColor(recipe.name, 40, 30);
    const isRecipesPage = currentPath.includes('recipes');

    const totalMinutes = (recipe.instructions || []).reduce((sum, i) => sum + (i.time || 0), 0)
        + (recipe.prepWork || []).filter(p => !p.optional).reduce((sum, p) => sum + (p.timeEstimate || 0), 0)
    const formatTime = (mins: number) => {
        const h = Math.floor(mins / 60)
        const m = mins % 60
        if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ''}`
        return `${m} min`
    }
    const timeTag = totalMinutes > 0
        ? formatTime(totalMinutes)
        : (recipe.time && timeConfig[recipe.time] ? timeConfig[recipe.time].label : null)
    const timeTagColor = totalMinutes > 0 && recipe.time && timeConfig[recipe.time]
        ? timeConfig[recipe.time].color
        : totalMinutes > 0 ? 'text-white bg-white/10' : ''

    return (
        <div 
            className="group relative flex flex-col bg-secondary/30 backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:bg-secondary/40 hover:shadow-2xl hover:shadow-accent/5 cursor-pointer"
            style={{ height: cardHeight }}
            onClick={() => handleRedirect(`${currentPath}/${recipe._id}`)}
        >
            {/* Background Image / Placeholder */}
            <div className="absolute inset-0 w-full h-full overflow-hidden">
                {imageUrl ? (
                    <>
                        <img
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            src={imageUrl}
                            alt={recipe.name}
                        />
                    </>
                ) : (
                    <div
                        className="w-full h-full flex items-center justify-center relative"
                        style={{ background: `linear-gradient(135deg, ${dynamicBgColor}, ${stringToHslColor(recipe.name, 40, 20)})` }}
                    >
                        <Utensils size={40} className="text-white/10" />

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
                <div className="flex flex-col gap-1 items-start">
                    {recipe.hidden && (
                        <div className="px-2 py-1 rounded-lg bg-amber-500/80 backdrop-blur-md text-[9px] font-bold text-white uppercase tracking-wider border border-white/10 flex items-center gap-1">
                            <EyeOff size={9} /> Hidden
                        </div>
                    )}
                </div>
                
                {onDelete && (bulkAction === 'delete' || (!bulkAction && allowDelete)) && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(recipe._id); }}
                        className="w-8 h-8 flex items-center justify-center bg-rose-500 text-white rounded-full shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-200 hover:bg-rose-600 ml-auto"
                    >
                        <Trash2 size={14} />
                    </button>
                )}

                {bulkAction === 'hide' && onToggleHidden && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleHidden(recipe); }}
                        className={`w-8 h-8 flex items-center justify-center text-white rounded-full shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-200 hover:opacity-90 ml-auto ${
                            recipe.hidden ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'
                        }`}
                        title={recipe.hidden ? 'Unhide' : 'Hide'}
                    >
                        {recipe.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                )}
            </div>

            {/* Bottom Info Strip */}
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 via-black/85 to-black/70 backdrop-blur-md">
                <div className="p-3 flex flex-col gap-1.5">
                    <h3 className="text-sm font-bold leading-tight line-clamp-2 tracking-tight text-white">
                        {recipe.name}
                    </h3>

                    {isRecipesPage && (timeTag || extraTagLabels.length > 0) && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {timeTag && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tighter ${timeTagColor}`}>
                                    <Clock size={10} />
                                    {timeTag}
                                </span>
                            )}
                            {extraTagLabels.map(tag => (
                                <span key={tag.key} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter ${tag.color}`}>
                                    {tag.label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
