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
        { name: "One Off Extracts", _id: "/oneOffExtracts", image: "/forklift_oragami.png" },
        { name: "Search Logs", _id: "/searchLogs", image: "/avo xl.png" },
        { name: "Migrate Search Logs", _id: "MIGRATE", image: "/avo.ico" }
    ])

    const redirect = async (page: string) => {
        if (page === "MIGRATE") {
            if (confirm("Are you sure you want to migrate existing ingredient records to the Search Log?")) {
                let data = await (await fetch("/api/Ingredients/migrate_search_logs", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'edgetoken': localStorage.getItem('Token') || ""
                    }
                })).json()
                if (data.success === false || data.success === undefined) {
                    alert(data.message || "Failed, unexpected error")
                } else {
                    alert(data.message)
                }
            }
            return;
        }
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
