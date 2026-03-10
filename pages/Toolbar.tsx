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
                <Link href="/" passHref>
                    <a className={styles.brand}>BRYNS GARBAGE</a>
                </Link>

                <ul className={styles.nav_links}>
                    <li className={styles.nav_item}>
                        <Link href="/recipes" passHref><a className={styles.nav_link}>Recipes</a></Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/createRecipe" passHref><a className={styles.nav_link}><AiFillPlusCircle size={20} /></a></Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/ingredientResearch" passHref><a className={styles.nav_link}>Research</a></Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/shoppingList" passHref><a className={styles.nav_link}>Shopping List</a></Link>
                    </li>
                </ul>

                <div className={styles.nav_right}>
                    <Link href="/profile" passHref>
                        <a className={styles.nav_link}>
                            <CgProfile size={25} />
                        </a>
                    </Link>
                    <Link href="/login" passHref>
                        <a className={styles.nav_link} onClick={clearCookie}>
                            <MdLogout size={25} />
                        </a>
                    </Link>
                </div>
            </nav>
        </header>
    )
}
