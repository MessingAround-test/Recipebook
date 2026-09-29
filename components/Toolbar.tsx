import React from "react"
import { MdOutlineMenuBook, MdBuild, MdShoppingCart, MdHome, MdTimeline, MdApps } from 'react-icons/md'
import Link from 'next/link'
import styles from '../styles/Toolbar.module.css'
import { HiOutlineCog } from 'react-icons/hi'
import { useRouter } from 'next/router'
import { useUser } from '../lib/UserContext'

interface NavItem {
    href: string
    label: string
    icon: React.ReactNode
    /** Feature required to see/reach this link; undefined = always visible. */
    feature?: string
    hideMobile?: boolean
}

export function Toolbar({ hideMobile = false }: { hideMobile?: boolean }) {
    const router = useRouter();
    const { hasFeature } = useUser();

    const isActive = (path: string) => {
        if (path === '/') return router.pathname === '/';
        return router.pathname.startsWith(path);
    };

    const items: NavItem[] = [
        { href: '/', label: 'Home', icon: <MdHome size={30} /> },
        { href: '/recipes', label: 'Recipes', icon: <MdOutlineMenuBook size={30} />, feature: 'recipes' },
        { href: '/shoppingList', label: 'List', icon: <MdShoppingCart size={30} />, feature: 'shoppingList' },
        { href: '/dailyTracker', label: 'Health', icon: <MdTimeline size={30} />, feature: 'healthTracker' },
        { href: '/quickTools', label: 'Quick Tools', icon: <MdBuild size={30} />, feature: 'quickTools' },
        { href: '/tools', label: 'Tools', icon: <MdApps size={30} />, hideMobile: true },
        { href: '/profile', label: 'Settings', icon: <HiOutlineCog size={30} />, hideMobile: true },
    ];

    const visibleItems = items.filter(item => !item.feature || hasFeature(item.feature));

    return (
        <header className={`${styles.Container} ${hideMobile ? styles.hide_mobile : ''}`}>
            <nav className={styles.nav_wrapper}>
                <Link href="/" className={styles.brand}>BRYNS GARBAGE</Link>

                <ul className={styles.nav_links}>
                    {visibleItems.map(item => (
                        <li
                            key={item.href}
                            className={`${styles.nav_item} ${item.hideMobile ? styles.hide_mobile : ''}`}
                        >
                            <Link href={item.href} className={`${styles.nav_link} ${isActive(item.href) ? styles.active : ''}`}>
                                <div className={styles.icon_wrapper}>{item.icon}</div>
                                <span className={styles.nav_label}>{item.label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </header>
    )
}
