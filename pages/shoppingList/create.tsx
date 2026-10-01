import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useState } from 'react'
import Router from 'next/router'
import GenericForm from '../../components/GenericForm'
import { useFeatureGuard } from '../../lib/useFeatureGuard'
import { ClipboardPlus } from 'lucide-react'
import pageShell from '../../styles/PageShell.module.css'

export default function Home() {
    useFeatureGuard('shoppingList')
    const [loading, setLoading] = useState(false)

    // Local calendar date (not UTC — a UTC default can land on "tomorrow"
    // for half the world's day).
    const toLocalDateString = (d: Date) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }
    const today = toLocalDateString(new Date())

    async function handleSubmit(e: any) {
        setLoading(true)
        let res = await fetch("/api/ShoppingList/", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': localStorage.getItem('Token') || ''
            },
            body: JSON.stringify(e.value)
        })
        let data = await res.json()
        setLoading(false)
        if (data.success === false || data.success === undefined) {
            if (data.message !== undefined) {
                alert(data.message)
            } else {
                alert("failed, unexpected error")
            }
        } else {
            Router.push("/shoppingList/")
        }
    }

    return (
        <Layout title="Create a new List">
            <div className={`max-w-2xl mx-auto pb-24 md:pb-8 ${pageShell.shell}`}>
                <PageHeader
                    title="New Shopping List"
                    icon={<ClipboardPlus size={18} />}
                    accent="water"
                    subtitle="Name it after the trip it's for"
                />

                <div className="mt-1">
                    <GenericForm
                        formInitialState={{ "name": { "value": "", "placeholder": today }, "note": { "value": "" } }}
                        handleSubmitProp={(e: any) => handleSubmit(e)}
                    />
                    {loading && (
                        <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Creating list…</p>
                    )}
                </div>
            </div>
        </Layout>
    )
}
