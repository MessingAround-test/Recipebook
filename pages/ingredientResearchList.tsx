import React, { useEffect } from 'react'
import { Layout } from '../components/Layout'
import Router from 'next/router'
import { IngredientSearchList } from "../components/IngredientSearchList"

export default function Home() {
    useEffect(() => {
        if (!localStorage.getItem('Token')) {
            Router.push("/login")
        }
    }, [])

    return (
        <Layout title="Ingredients">
            <div className="mt-8">
                <IngredientSearchList />
            </div>
        </Layout>
    )
}
