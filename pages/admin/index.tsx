import { useState } from 'react'
import { useAdminGuard } from '../../lib/useAdminGuard'
import Router from 'next/router'
import { Layout } from '../../components/Layout'
import styles from '../../styles/Home.module.css'
import { PageHeader } from '../../components/PageHeader'

export default function AdminDashboard() {
    const isAuthorized = useAdminGuard()

    const [adminPages] = useState([
        { name: "Analytics Dashboard", _id: "/admin/dashboard", image: "/avo xl.png" },
        { name: "Search Logs", _id: "/searchLogs", image: "/avo xl.png" },
        { name: "Migrate Search Logs", _id: "MIGRATE", image: "/avo.ico" },
        { name: "DB Inspector", _id: "/admin/dbInspector", image: "/avo.ico" },
        { name: "One Off Extracts", _id: "/oneOffExtracts", image: "/forklift_oragami.png" }
    ])

    if (!isAuthorized) return null

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

    if (!isAuthorized) return null

    return (
        <Layout title="Admin Board" description="Administrative tools and logs">
            <div className="max-w-6xl mx-auto mt-8 px-4">
                <PageHeader title="Admin Dashboard" />
                <div className={styles.card_grid}>
                    {adminPages.map((page) => (
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
            </div>
        </Layout>
    )
}
