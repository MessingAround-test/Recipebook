import Head from 'next/head'
import { useEffect, useState } from 'react'
import Router from 'next/router'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import ImageCard from '../../components/ImageCard'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useAuthGuard } from '../../lib/useAuthGuard'

export default function Recipes() {
    const isAuthed = useAuthGuard()
    const [userData, setUserData] = useState<any>({})
    const [recipes, setRecipes] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [allowDelete, setAllowDelete] = useState(false)

    async function getUserDetails() {
        const token = localStorage.getItem('Token')
        if (!token) return
        let res = await fetch("/api/UserDetails", {
            headers: { 'edgetoken': token }
        })
        let data = await res.json()
        setUserData(data.res)
    }

    async function getRecipeDetails() {
        const token = localStorage.getItem('Token')
        if (!token) return
        let res = await fetch("/api/Recipe", {
            headers: { 'edgetoken': token }
        })
        let data = await res.json()
        setRecipes(data.res || [])
    }

    useEffect(() => {
        if (isAuthed) {
            getUserDetails()
            getRecipeDetails()
        }
    }, [isAuthed])

    const redirect = (page: string) => {
        Router.push(page)
    }

    function filterList(list: any[], term: string) {
        if (term) {
            return list.filter(item =>
                Object.values(item).some(value =>
                    String(value).toLowerCase().includes(term.toLowerCase())
                )
            )
        }
        return list
    }

    const filteredRecipes = filterList(recipes, searchTerm)

    const deleteRecipe = async (id: string) => {
        const token = localStorage.getItem('Token')
        let res = await fetch("/api/Recipe/" + String(id), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': token || ''
            },
        })
        let data = await res.json()
        if (data.success === false || data.success === undefined) {
            alert(data.message || "failed, unexpected error")
        } else {
            setRecipes((prev) => prev.filter(obj => obj._id !== id))
        }
    }

    if (!isAuthed) return null

    return (
        <Layout title="Your Recipes" description="View and manage your recipes">
            <PageHeader
                title="Your Recipes"
                actions={
                    <>
                        <Button onClick={() => redirect("/createRecipe")}>
                            Add recipe
                        </Button>
                        {userData?.role === "admin" && (
                            <Button
                                variant={allowDelete ? "destructive" : "outline"}
                                onClick={() => setAllowDelete(!allowDelete)}
                            >
                                {allowDelete ? "Disable Mass Delete" : "Allow Mass Delete"}
                            </Button>
                        )}
                    </>
                }
            />

            <div className="mb-8">
                <Input
                    placeholder="Search recipes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredRecipes.map((recipe) => (
                    <ImageCard
                        key={recipe._id}
                        recipe={recipe}
                        allowDelete={allowDelete}
                        onDelete={deleteRecipe}
                        onRedirect={redirect}
                    />
                ))}
            </div>
        </Layout>
    )
}
