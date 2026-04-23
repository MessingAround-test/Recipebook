import React from "react"
import { AiFillPlusCircle } from "react-icons/ai"
import { MdOutlineMenuBook, MdSearch, MdShoppingCart, MdHome, MdTimeline } from 'react-icons/md'
import Link from 'next/link'
import styles from '../styles/Toolbar.module.css'
import { HiOutlineCog } from 'react-icons/hi'

export function Toolbar() {

    return (
        <header className={styles.Container}>
            <nav className={styles.nav_wrapper}>
                <Link href="/" className={styles.brand}>BRYNS GARBAGE</Link>

                <ul className={styles.nav_links}>
                    <li className={styles.nav_item}>
                        <Link href="/" className={styles.nav_link}>
                            <MdHome size={24} />
                            <span className={styles.nav_label}>Home</span>
                        </Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/recipes" className={styles.nav_link}>
                            <MdOutlineMenuBook size={24} />
                            <span className={styles.nav_label}>Recipes</span>
                        </Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/createRecipe" className={styles.nav_link}>
                            <AiFillPlusCircle size={24} />
                            <span className={styles.nav_label}>Create</span>
                        </Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/ingredientResearch" className={styles.nav_link}>
                            <MdSearch size={24} />
                            <span className={styles.nav_label}>Research</span>
                        </Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/shoppingList" className={styles.nav_link}>
                            <MdShoppingCart size={24} />
                            <span className={styles.nav_label}>Shopping</span>
                        </Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/dailyTracker" className={styles.nav_link}>
                            <MdTimeline size={24} />
                            <span className={styles.nav_label}>Intake</span>
                        </Link>
                    </li>
                    <li className={styles.nav_item}>
                        <Link href="/profile" className={styles.nav_link}>
                            <HiOutlineCog size={24} />
                            <span className={styles.nav_label}>Settings</span>
                        </Link>
                    </li>
                </ul>
            </nav>
        </header>
    )
}
