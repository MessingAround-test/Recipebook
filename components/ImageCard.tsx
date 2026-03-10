import React from 'react'
import { useRouter } from 'next/router'
import { Button } from './ui/button'

interface Recipe {
    _id: string
    name: string
    image?: string
    cost?: number
}

interface ImageCardProps {
    recipe: Recipe
    allowDelete?: boolean
    onDelete?: (id: string) => void
    onRedirect?: (path: string) => void
    cardHeight?: string
}

export default function ImageCard({ recipe, allowDelete, onDelete, onRedirect, cardHeight = '15rem' }: ImageCardProps) {
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

    const dynamicBgColor = recipe.image ? 'transparent' : stringToHslColor(recipe.name, 30, 25);

    return (
        <div className="h-full">
            <div
                className="glass-card flex flex-col relative overflow-hidden h-full rounded-xl transition-all hover:scale-[1.02]"
                style={{ minHeight: cardHeight, cursor: 'pointer', padding: 0 }}
            >
                {allowDelete && onDelete && (
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onDelete(recipe._id); }}
                        className="absolute top-2 right-2 z-10 w-8 h-8 p-0 rounded-full"
                    >
                        x
                    </Button>
                )}
                <div
                    className="flex flex-col h-full"
                    onClick={() => handleRedirect(`${currentPath}/${recipe._id}`)}
                >
                    {recipe.image ? (
                        <img
                            className="w-full h-[70%] object-cover"
                            src={recipe.image}
                            alt={recipe.name}
                        />
                    ) : (
                        <div
                            className="w-full h-[70%] flex items-center justify-center relative"
                            style={{ backgroundColor: dynamicBgColor }}
                        >
                            <span className="text-4xl opacity-20 select-none">🛒</span>
                            {currentPath.includes('shoppingList') && (
                                <>
                                    {recipe.cost !== undefined ? (
                                        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white border border-white/10">
                                            ${recipe.cost.toFixed(2)}
                                        </div>
                                    ) : (
                                        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white/50 border border-white/10">
                                            ?
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    <div className="flex flex-1 items-center justify-center p-4">
                        <h3 className="m-0 text-sm font-bold text-center line-clamp-2">
                            {recipe.name}
                        </h3>
                    </div>
                </div>
            </div>
        </div>
    )
}
