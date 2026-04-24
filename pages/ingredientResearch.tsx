import React, { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import Router from 'next/router'
import IngredientResearchComponent from '../components/IngredientResearchComponent'

export default function Home() {
    const [userData, setUserData] = useState<any>({})

    useEffect(() => {
        if (!localStorage.getItem('Token')) {
            Router.push("/login")
            return
        }
        async function getUserDetails() {
            let res = await fetch("/api/UserDetails", {
                headers: { 'edgetoken': localStorage.getItem('Token') || '' }
            })
            let data = await res.json()
            setUserData(data.res)
        }
        getUserDetails()
    }, [])

    return (
        <Layout title="Ingredients">
            <div className="max-w-4xl mx-auto mt-8">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-8 shadow-xl">
                    <h1 className="text-center text-3xl font-bold mb-4 text-primary">Ingredient Explorer</h1>
                    <p className="text-center text-muted-foreground mb-8">
                        Check out how much stuff costs at "Woolworths", "Aldi", "Panetta" or "IGA".
                    </p>
                    <div className="mt-4">
                        <IngredientResearchComponent isAdmin={userData.role === 'admin'} />
                    </div>
                </div>
            </div>
        </Layout>
    )
}
