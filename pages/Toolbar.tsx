import React from "react"
import { AiFillPlusCircle } from "react-icons/ai"
import Link from 'next/link'
import styles from '../styles/Toolbar.module.css'
import { CgProfile } from 'react-icons/cg'
import { MdLogout } from 'react-icons/md'

export function Toolbar() {
    const clearCookie = () => {
        localStorage.removeItem("Token")
    }

    return (
        <header className={styles.Container}>
            <nav className={styles.nav_wrapper}>
                <Link href="/" className={styles.brand}>BRYNS GARBAGE</Link>

                <ul className={styles.nav_links}>
                    <li className={styles.nav_item}>
                        <Link href="/recipes" className={styles.nav_link}>Recipes</Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/createRecipe" className={styles.nav_link}><AiFillPlusCircle size={20} /></Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/ingredientResearch" className={styles.nav_link}>Research</Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/shoppingList" className={styles.nav_link}>Shopping List</Link>
                    </li>
                </ul>

                <div className={styles.nav_right}>
                    <Link href="/profile" className={styles.nav_link}>
                        <CgProfile size={25} />
                    </Link>
                    <Link href="/login" className={styles.nav_link} onClick={clearCookie}>
                        <MdLogout size={25} />
                    </Link>
                </div>
            </nav>
        </header>
    )
}
