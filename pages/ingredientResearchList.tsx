import React, { useEffect } from 'react'
import { Layout } from '../components/Layout'
import Router from 'next/router'
import { IngredientSearchList } from "../components/IngredientSearchList"
import { useFeatureGuard } from '../lib/useFeatureGuard'

export default function Home() {
    const isAllowed = useFeatureGuard('ingredients')
    useEffect(() => {
        if (!localStorage.getItem('Token')) {
            Router.push("/login")
        }
    }, [])

    if (!isAllowed) return null

    return (
        <Layout title="Ingredients">
            <div className="mt-8">
                <IngredientSearchList />
            </div>
        </Layout>
    )
}
