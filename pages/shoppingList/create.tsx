import Head from 'next/head'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useEffect, useState } from 'react'
import Router, { useRouter } from 'next/router'
import GenericForm from '../../components/GenericForm'
import { useAuthGuard } from '../../lib/useAuthGuard'

export default function Home() {
    useAuthGuard()
    const router = useRouter()
    const { id } = router.query
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: any) {
        let res = await fetch("/api/ShoppingList/" + "?EDGEtoken=" + localStorage.getItem('Token'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(e.value)
        })
        let data = await res.json()
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
            <div className="max-w-2xl mx-auto mt-8">
                <PageHeader title="Create a new List" />

                <div className="mt-8">
                    <GenericForm
                        formInitialState={{ "name": { "value": "" }, "note": { "value": "" } }}
                        handleSubmitProp={(e: any) => handleSubmit(e)}
                    >
                        hi
                    </GenericForm>
                    {loading && (
                        <div className="mt-4 flex items-center justify-center text-muted-foreground">
                            loading...<object type="image/svg+xml" data="/loading.svg" className="ml-2 w-6 h-6">svg-animation</object>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
