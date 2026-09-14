import {
    Check, MapPin, Star, Pencil, UtensilsCrossed, Loader2
} from 'lucide-react'
import { DishListItem } from './types'

interface DishListTableProps {
    items: DishListItem[]
    busyIds?: Set<string>
    onToggle: (item: DishListItem) => void
    onEdit: (item: DishListItem) => void
}

/**
 * TasteAtlas-inspired ranked grid. Each dish is a card with a large image,
 * rank, category, rating, origin and blurb; the tick-off + recipe tools sit in
 * the card footer so nothing from the old table is lost.
 */
export function DishListTable({ items, busyIds, onToggle, onEdit }: DishListTableProps) {
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-3xl bg-secondary/40">
                <div className="text-4xl mb-3">🌍</div>
                <p className="text-sm font-semibold">No dishes to show</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">Add dishes by pasting the TasteAtlas page source, or clear your filters.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => {
                const busy = busyIds?.has(item._id)
                const place = [item.location?.city || item.location?.region, item.location?.country]
                    .filter(Boolean)
                    .join(', ')
                const recipeIds = item.recipeIds?.length ? item.recipeIds : (item.recipeId ? [item.recipeId] : [])

                return (
                    <article
                        key={item._id}
                        className={`group relative flex flex-col overflow-hidden rounded-2xl bg-card border transition-all duration-300 hover:shadow-2xl hover:shadow-accent/5 ${item.cooked ? 'border-emerald-500/40' : 'border-border hover:border-accent/50'}`}
                    >
                        {/* Image + overlays — always opens the dish's info page */}
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                            {item.image ? (
                                <a href={`/dishLists/items/${item._id}`} className="block w-full h-full" title="View dish">
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        loading="lazy"
                                        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${item.cooked ? 'opacity-70' : ''}`}
                                    />
                                </a>
                            ) : (
                                <a href={`/dishLists/items/${item._id}`} className="w-full h-full flex items-center justify-center text-muted-foreground" title="View dish">
                                    <UtensilsCrossed size={28} />
                                </a>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

                            {item.rank != null && (
                                <div className="pointer-events-none absolute top-2.5 left-2.5 min-w-8 h-8 px-2 rounded-lg bg-black/65 backdrop-blur-md text-white text-sm font-black flex items-center justify-center border border-white/10">
                                    {item.rank}
                                </div>
                            )}

                            {item.cooked && (
                                <div className="pointer-events-none absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider border border-white/10">
                                    <Check size={11} /> Cooked
                                </div>
                            )}

                            {item.category && (
                                <div className="pointer-events-none absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/55 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider border border-white/10">
                                    {item.category}
                                </div>
                            )}
                            {item.rating != null && (
                                <div className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2 h-6 rounded-md bg-black/55 backdrop-blur-md text-white text-[11px] font-bold border border-white/10">
                                    <Star size={10} className="text-amber-400" fill="currentColor" /> {item.rating}
                                </div>
                            )}
                        </div>

                        {/* Body */}
                        <div className="flex flex-col gap-1.5 p-3.5 flex-1">
                            <h3 className={`text-[15px] font-bold leading-tight line-clamp-2 ${item.cooked ? 'text-muted-foreground' : 'text-foreground'}`}>
                                <a href={`/dishLists/items/${item._id}`} className="hover:text-accent transition-colors">{item.name}</a>
                            </h3>

                            {place && (
                                <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                    <MapPin size={11} /> {place}
                                </p>
                            )}

                            {item.description && (
                                <p className="text-xs text-muted-foreground/90 leading-snug line-clamp-3">{item.description}</p>
                            )}

                            {/* Footer tools */}
                            <div className="flex items-center gap-1 mt-auto pt-2.5 border-t border-border/60">
                                <button
                                    onClick={() => onToggle(item)}
                                    disabled={busy}
                                    className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-bold transition-colors ${item.cooked ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25' : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-border'}`}
                                    title={item.cooked ? 'Mark as not cooked' : 'Mark as cooked'}
                                >
                                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                    {item.cooked ? 'Cooked' : 'Mark cooked'}
                                </button>

                                <div className="ml-auto flex items-center gap-0.5">
                                    {recipeIds.length > 0 && (
                                        <a
                                            href={`/recipes?ids=${recipeIds.join(',')}`}
                                            title="Show recipes for this dish"
                                            className="p-2 rounded-lg text-accent hover:bg-secondary transition-colors"
                                        >
                                            <UtensilsCrossed size={15} />
                                        </a>
                                    )}
                                    <button onClick={() => onEdit(item)} title="Edit dish" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                                        <Pencil size={15} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {item.cooked && <div className="absolute inset-0 ring-1 ring-inset ring-emerald-500/30 rounded-2xl pointer-events-none" />}
                    </article>
                )
            })}
        </div>
    )
}
