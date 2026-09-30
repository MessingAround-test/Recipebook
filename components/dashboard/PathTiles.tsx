import { ReactNode } from 'react'
import Router from 'next/router'
import { FiBookOpen, FiCalendar, FiShoppingCart, FiCompass, FiGrid } from 'react-icons/fi'
import { FeatureMap } from '../../lib/features'
import dashStyles from '../../styles/Dashboard.module.css'

interface PathTile {
    key: string
    title: string
    sub: string
    href: string
    icon: ReactNode
    /** RGB-triplet token name — sets the tile's ink. */
    ink: string
}

const PATHS: (PathTile & { feature?: keyof FeatureMap })[] = [
    {
        key: 'recipes',
        title: 'Recipes',
        sub: 'Browse & cook',
        href: '/recipes',
        icon: <FiBookOpen size={20} />,
        ink: 'var(--terracotta)',
        feature: 'recipes',
    },
    {
        key: 'plan',
        title: 'Plan week',
        sub: 'Meals ahead',
        href: '/weeklyPlanner',
        icon: <FiCalendar size={20} />,
        ink: 'var(--olive)',
        feature: 'weeklyPlanner',
    },
    {
        key: 'shopping',
        title: 'Shopping',
        sub: 'Lists & buys',
        href: '/shoppingList',
        icon: <FiShoppingCart size={20} />,
        ink: 'var(--water)',
        feature: 'shoppingList',
    },
    {
        key: 'explore',
        title: 'Explore',
        sub: 'World dishes',
        href: '/dishLists',
        icon: <FiCompass size={20} />,
        ink: 'var(--butter)',
        feature: 'worldList',
    },
    {
        key: 'tools',
        title: 'Tools',
        sub: 'Timers & guides',
        href: '/tools',
        icon: <FiGrid size={20} />,
        ink: 'var(--plum)',
    },
]

export default function PathTiles({ features }: { features: FeatureMap }) {
    const tiles = PATHS.filter(t => !t.feature || features[t.feature])
    if (tiles.length === 0) return null

    return (
        <nav className={dashStyles.tiles} aria-label="Quick paths">
            {tiles.map(t => (
                <button
                    key={t.key}
                    type="button"
                    onClick={() => Router.push(t.href)}
                    className={dashStyles.tile}
                    style={{ '--tile': t.ink } as React.CSSProperties}
                >
                    <span className={dashStyles.tileIcon}>{t.icon}</span>
                    <span className={dashStyles.tileText}>
                        <span className={dashStyles.tileTitle}>{t.title}</span>
                        <span className={dashStyles.tileSub}>{t.sub}</span>
                    </span>
                </button>
            ))}
        </nav>
    )
}
