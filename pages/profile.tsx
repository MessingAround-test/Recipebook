import React, { useEffect, useState, FormEvent } from 'react'
import { Layout } from '../components/Layout'
import { FormField } from '../components/FormField'
import { Button } from '../components/ui/button'
import { useAuthGuard } from '../lib/useAuthGuard'
import { PageHeader } from '../components/PageHeader'
import { useRouter } from 'next/router'
import { MdLogout, MdArrowForward, MdMonitorHeart } from 'react-icons/md'

export default function Profile() {
    const isAuthed = useAuthGuard()
    const router = useRouter()
    const [userData, setUserData] = useState<Record<string, string>>({})

    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'dark'
        }
        return 'dark'
    })

    const [skipConversion, setSkipConversion] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('skipConversion') === 'true'
        }
        return false
    })

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
                            if (key === '_id' || key === 'passwordHash' || key === '__v') return null // Hide internal/sensitive fields

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

                {/* Daily Intake Link */}
                <div className="glass-card mt-8 border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <MdMonitorHeart className="text-emerald-500" size={20} />
                        <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">Daily Intake Profile</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                        Set your age, weight, height and activity level to get personalised daily nutritional targets used across the app.
                    </p>
                    <Button
                        id="goto-daily-intake"
                        variant="outline"
                        className="w-full sm:w-auto border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => router.push('/dailyIntake')}
                    >
                        Manage Daily Intake
                        <MdArrowForward className="ml-2" size={16} />
                    </Button>
                </div>

                <div className="glass-card mt-8">
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-4">General Settings</h3>
                    
                    {/* Theme Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border/20 mb-4 transition-colors">
                        <div>
                            <p className="font-semibold text-foreground">Interface Theme</p>
                            <p className="text-sm text-muted-foreground">Select between deep Midnight Dark or clean Slate Light mode.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold uppercase tracking-widest ${theme === 'light' ? 'text-primary' : 'text-muted-foreground opacity-50'}`}>Light</span>
                            <input
                                type="checkbox"
                                className="toggle toggle-emerald"
                                checked={theme === 'dark'}
                                onChange={(e) => {
                                    const newTheme = e.target.checked ? 'dark' : 'light';
                                    setTheme(newTheme);
                                    localStorage.setItem('theme', newTheme);
                                    if (newTheme === 'light') {
                                        document.documentElement.classList.add('light');
                                    } else {
                                        document.documentElement.classList.remove('light');
                                    }
                                }}
                            />
                            <span className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-primary' : 'text-muted-foreground opacity-50'}`}>Dark</span>
                        </div>
                    </div>

                    {/* Conversion Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border/20 transition-colors">
                        <div>
                            <p className="font-semibold text-foreground">Automatic Quantity Conversion</p>
                            <p className="text-sm text-muted-foreground">Normalize prices across different units using shared factors.</p>
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

                    {/* Logout Button */}
                    <div className="mt-8 pt-4 border-t border-border/10">
                        <Button
                            variant="outline"
                            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                            onClick={() => {
                                if (confirm('Are you sure you want to logout?')) {
                                    localStorage.removeItem('Token')
                                    router.push('/login')
                                }
                            }}
                        >
                            <MdLogout className="mr-2" size={20} />
                            Logout from Account
                        </Button>
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
