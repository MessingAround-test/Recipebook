import React from 'react'
import { useRouter } from 'next/router'
import { Button } from '../components/ui/button'

interface Recipe {
    _id: string
    name: string
    image?: string
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
                        <div className="w-full h-[70%] bg-secondary flex items-center justify-center text-muted-foreground">
                            <span>No Image</span>
                        </div>
                    )}
                    <div className="flex flex-1 items-center justify-center p-4">
                        <h3 className="m-0 text-lg font-bold text-center">
                            {recipe.name}
                        </h3>
                    </div>
                </div>
            </div>
        </div>
    )
}
