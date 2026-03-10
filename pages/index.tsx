import { useState } from 'react'
import Router from 'next/router'
import { Layout } from '../components/Layout'
import { useAuthGuard } from '../lib/useAuthGuard'
import styles from '../styles/Home.module.css'

export default function Home() {
    const isAuthed = useAuthGuard()

    const [pages] = useState([
        { name: "Recipes", _id: "/recipes", image: "/cookbook_oragami.png" },
        { name: "Shopping List", _id: "/shoppingList", image: "/shop_list_oragami.png" },
        { name: "One Off Extracts", _id: "/oneOffExtracts", image: "/forklift_oragami.png" }
    ])

    const redirect = async (page: string) => {
        Router.push(page)
    }

    if (!isAuthed) return null

    return (
        <Layout title="Collection" description="Modern recipe and shopping management">
            <div className={styles.card_grid}>
                {pages.map((page) => (
                    <div
                        key={page._id}
                        className={styles.paperCard}
                        onClick={() => redirect(page._id)}
                    >
                        <div className={styles.card_image_wrapper}>
                            {/* @ts-ignore */}
                            <img src={page.image} alt={page.name} />
                        </div>
                        <div className={styles.card_body}>
                            <div className={styles.card_title}>{String(page.name)}</div>
                        </div>
                    </div>
                ))}
            </div>
        </Layout>
    )
}
