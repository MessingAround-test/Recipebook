import React from "react"
import { AiFillPlusCircle } from "react-icons/ai"
import { MdOutlineMenuBook, MdBuild, MdShoppingCart, MdHome, MdTimeline, MdApps } from 'react-icons/md'
import Link from 'next/link'
import styles from '../styles/Toolbar.module.css'
import { HiOutlineCog } from 'react-icons/hi'
import { useRouter } from 'next/router'

export function Toolbar({ hideMobile = false }: { hideMobile?: boolean }) {
    const router = useRouter();

    const isActive = (path: string) => {
        if (path === '/') return router.pathname === '/';
        return router.pathname.startsWith(path);
    };

    return (
        <header className={`${styles.Container} ${hideMobile ? styles.hide_mobile : ''}`}>
            <nav className={styles.nav_wrapper}>
                <Link href="/" className={styles.brand}>BRYNS GARBAGE</Link>

                <ul className={styles.nav_links}>
                    <li className={styles.nav_item}>
                        <Link href="/" className={`${styles.nav_link} ${isActive('/') ? styles.active : ''}`}>
                            <div className={styles.icon_wrapper}><MdHome size={30} /></div>
                            <span className={styles.nav_label}>Home</span>
                        </Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/recipes" className={`${styles.nav_link} ${isActive('/recipes') ? styles.active : ''}`}>
                            <div className={styles.icon_wrapper}><MdOutlineMenuBook size={30} /></div>
                            <span className={styles.nav_label}>Recipes</span>
                        </Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/shoppingList" className={`${styles.nav_link} ${isActive('/shoppingList') ? styles.active : ''}`}>
                            <div className={styles.icon_wrapper}><MdShoppingCart size={30} /></div>
                            <span className={styles.nav_label}>List</span>
                        </Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/dailyTracker" className={`${styles.nav_link} ${isActive('/dailyTracker') ? styles.active : ''}`}>
                            <div className={styles.icon_wrapper}><MdTimeline size={30} /></div>
                            <span className={styles.nav_label}>Health</span>
                        </Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/quickTools" className={`${styles.nav_link} ${isActive('/quickTools') ? styles.active : ''}`}>
                            <div className={styles.icon_wrapper}><MdBuild size={30} /></div>
                            <span className={styles.nav_label}>Quick Tools</span>
                        </Link>
                    </li>
                    <li className={`${styles.nav_item} ${styles.hide_mobile}`}>
                        <Link href="/tools" className={`${styles.nav_link} ${isActive('/tools') ? styles.active : ''}`}>
                            <div className={styles.icon_wrapper}><MdApps size={30} /></div>
                            <span className={styles.nav_label}>Tools</span>
                        </Link>
                    </li>
                    <li className={`${styles.nav_item} ${styles.hide_mobile}`}>
                        <Link href="/profile" className={`${styles.nav_link} ${isActive('/profile') ? styles.active : ''}`}>
                            <div className={styles.icon_wrapper}><HiOutlineCog size={30} /></div>
                            <span className={styles.nav_label}>Settings</span>
                        </Link>
                    </li>
                </ul>
            </nav>
        </header>
    )
}
