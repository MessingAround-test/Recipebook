import { useState, useEffect } from 'react'
import Router from 'next/router'
import { Layout } from '../components/Layout'
import { useAuthGuard } from '../lib/useAuthGuard'
import styles from '../styles/Home.module.css'

interface NavPage {
    name: string
    _id: string
    image: string
    adminOnly: boolean
}

export default function Home() {
    const isAuthed = useAuthGuard()
    const [userRole, setUserRole] = useState<string | null>(null)

    const [allPages] = useState<NavPage[]>([
        { name: "Health Tracker", _id: "/dailyTracker", image: "", adminOnly: false },
        { name: "Recipes", _id: "/recipes", image: "/cookbook_oragami.png", adminOnly: false },
        { name: "Shopping List", _id: "/shoppingList", image: "/shop_list_oragami.png", adminOnly: false },
        { name: "Ingredients", _id: "/ingredientResearch", image: "", adminOnly: false },
        { name: "DB Inspector", _id: "/admin/dbInspector", image: "/avo.ico", adminOnly: true },
        { name: "Admin", _id: "/admin", image: "/avo xl.png", adminOnly: true }
    ])

    useEffect(() => {
        if (isAuthed) {
            fetchUserDetails()
        }
    }, [isAuthed])

    async function fetchUserDetails() {
        const token = localStorage.getItem('Token')
        if (!token) return
        try {
            const res = await fetch("/api/UserDetails", {
                headers: { 'edgetoken': token }
            })
            const data = await res.json()
            if (data.res && data.res.role) {
                setUserRole(data.res.role)
            }
        } catch (error) {
            console.error("Failed to fetch user details:", error)
        }
    }

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

    const visiblePages = allPages.filter(page => !page.adminOnly || userRole === 'admin')

    return (
        <Layout title="Collection" description="Modern recipe and shopping management">
            <div className={styles.card_grid}>
                {visiblePages.map((page) => (
                    <div
                        key={page._id}
                        className={styles.paperCard}
                        onClick={() => redirect(page._id)}
                    >
                        <div className={`${styles.card_image_wrapper} ${!page.image ? styles.no_image : ''}`}>
                            {page.image && <img src={page.image} alt={page.name} />}
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
