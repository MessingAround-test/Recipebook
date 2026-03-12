import React, { useEffect, useState, FormEvent } from 'react'
import { Layout } from '../components/Layout'
import { FormField } from '../components/FormField'
import { Button } from '../components/ui/button'
import { useAuthGuard } from '../lib/useAuthGuard'
import { PageHeader } from '../components/PageHeader'

export default function Profile() {
    const isAuthed = useAuthGuard()
    const [userData, setUserData] = useState<Record<string, string>>({})

    const [skipConversion, setSkipConversion] = useState(localStorage.getItem('skipConversion') === 'true')

    async function getUserDetails() {
        const token = localStorage.getItem('Token')
        if (!token) return
        const res = await fetch("/api/UserDetails", {
            headers: { 'edgetoken': token }
        })
        const data = await res.json()
        if (data.res) {
            setUserData(data.res)
        }
    }

    async function updateUserDetails(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const token = localStorage.getItem('Token')
        const res = await fetch("/api/UserDetails", {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': token || ''
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

                <div className="glass-card mt-8">
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-4">General Settings</h3>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                        <div>
                            <p className="font-semibold text-white">Automatic Quantity Conversion</p>
                            <p className="text-sm text-gray-400">Normalize prices across different units using shared factors.</p>
                        </div>
                        <input
                            type="checkbox"
                            className="toggle toggle-emerald"
                            checked={!skipConversion}
                            onChange={(e) => {
                                const newValue = !e.target.checked;
                                localStorage.setItem('skipConversion', newValue.toString());
                                setSkipConversion(newValue);
                                window.dispatchEvent(new Event('storage'));
                            }}
                        />
                    </div>
                </div>

                {userData.role === 'admin' && (
                    <div className="glass-card mt-8 border-destructive/50">
                        <h3 className="text-sm font-black uppercase tracking-widest text-destructive mb-4">Admin settings (DANGEROUS)</h3>
                        <p className="text-sm text-muted-foreground mb-6">These actions affect the entire system. Use with extreme caution.</p>
                        <Button
                            variant="destructive"
                            className="w-full sm:w-auto"
                            onClick={async () => {
                                if (confirm('EXTREME CAUTION: Are you sure you want to DELETE ALL cached ingredients from the database? This cannot be undone.')) {
                                    const token = localStorage.getItem('Token')
                                    const res = await fetch("/api/Ingredients/", {
                                        method: "DELETE",
                                        headers: { 'edgetoken': token || "" }
                                    })
                                    const data = await res.json()
                                    if (data.success) {
                                        alert("All ingredients deleted successfully.")
                                    } else {
                                        alert("Failed to delete ingredients: " + (data.message || "Unknown error"))
                                    }
                                }
                            }}
                        >
                            DELETE ALL CACHED INGREDIENTS
                        </Button>
                    </div>
                )}
            </div>
        </Layout>
    )
}
