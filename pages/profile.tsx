import { useEffect, useState, FormEvent } from 'react'
import { Layout } from '../components/Layout'
import { FormField } from '../components/FormField'
import { Button } from '../components/ui/button'
import { useAuthGuard } from '../lib/useAuthGuard'
import { PageHeader } from '../components/PageHeader'

export default function Profile() {
    const isAuthed = useAuthGuard()
    const [userData, setUserData] = useState<Record<string, string>>({})

    async function getUserDetails() {
        const token = localStorage.getItem('Token')
        if (!token) return
        const res = await fetch("/api/UserDetails?EDGEtoken=" + token)
        const data = await res.json()
        if (data.res) {
            setUserData(data.res)
        }
    }

    async function updateUserDetails(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const token = localStorage.getItem('Token')
        const res = await fetch("/api/UserDetails?EDGEtoken=" + token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        })
        const data = await res.json()
        if (data.success === false || data.success === undefined) {
            if (data.message !== undefined) {
                alert(data.message)
            } else {
                alert("Failed, unexpected error")
            }
        } else {
            alert("Profile updated successfully")
        }
    }

    useEffect(() => {
        if (isAuthed) {
            getUserDetails()
        }
    }, [isAuthed])

    if (!isAuthed) return null

    return (
        <Layout title="Profile" description="Manage your account profile">
            <PageHeader title="Profile Settings" />

            <div className="max-w-2xl">
                <div className="glass-card">
                    <form onSubmit={updateUserDetails}>
                        {Object.keys(userData).map((key) => {
                            if (key === '_id') return null // Optionally hide the internal _id

                            return (
                                <FormField
                                    key={key}
                                    label={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                                    id={key}
                                    value={userData[key] || ''}
                                    onChange={(e) => setUserData((prev) => ({ ...prev, [key]: e.target.value }))}
                                />
                            )
                        })}

                        <div className="mt-8 flex gap-4">
                            <Button type="submit">
                                Save Changes
                            </Button>
                            <Button type="button" variant="outline" onClick={() => console.log(userData)}>
                                Show State
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    )
}
