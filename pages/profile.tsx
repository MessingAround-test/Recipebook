import React, { useEffect, useState, useMemo, FormEvent } from 'react'
import { Layout } from '../components/Layout'
import { FormField } from '../components/FormField'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useAuthGuard } from '../lib/useAuthGuard'
import { PageHeader } from '../components/PageHeader'
import { useRouter } from 'next/router'
import { MdLogout, MdArrowForward, MdMonitorHeart } from 'react-icons/md'
import { NUTRIENT_LABELS } from '../lib/dailyIntake'
import {
    calculateHealthScore,
    DEFAULT_HEALTH_SCORE_CONFIG,
    ALL_SCORE_NUTRIENT_KEYS,
    HealthScoreConfig,
} from '../lib/healthScore'

const SCORE_GROUPS = ['macro', 'mineral', 'vitamin'] as const

const getLocalDateString = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

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

    // Health Score settings
    const [healthScoreConfig, setHealthScoreConfig] = useState<HealthScoreConfig>(DEFAULT_HEALTH_SCORE_CONFIG)
    const [targets, setTargets] = useState<Record<string, number> | null>(null)
    const [todayTotals, setTodayTotals] = useState<Record<string, number>>({})

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

    async function loadHealthScoreData() {
        const token = localStorage.getItem('Token')
        if (!token) return
        const [intakeRes, logRes] = await Promise.all([
            fetch('/api/dailyIntake', { headers: { edgetoken: token } }).then(r => r.json()),
            fetch(`/api/dailyLog?date=${getLocalDateString(new Date())}`, { headers: { edgetoken: token } }).then(r => r.json()),
        ])
        if (intakeRes.success) {
            setTargets(intakeRes.targets)
            setHealthScoreConfig(intakeRes.healthScoreConfig || DEFAULT_HEALTH_SCORE_CONFIG)
        }
        if (logRes.success && logRes.log?.items) {
            const totals: Record<string, number> = {}
            logRes.log.items.forEach((item: any) => {
                Object.keys(item.nutrients || {}).forEach(k => {
                    totals[k] = (totals[k] || 0) + (item.nutrients[k] || 0)
                })
            })
            setTodayTotals(totals)
        }
    }

    async function updateUserDetails(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const token = localStorage.getItem('Token')
        const payload: Record<string, string> = {}
        for (const [k, v] of Object.entries(userData)) {
            if (v !== null && typeof v === 'object') continue // skip nested objects (e.g. health_score_config)
            payload[k] = v
        }
        const res = await fetch("/api/UserDetails", {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': token || ''
            },
            body: JSON.stringify(payload)
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

    async function saveHealthScoreConfig() {
        const token = localStorage.getItem('Token')
        if (!token) return
        const res = await fetch('/api/dailyIntake', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
            body: JSON.stringify({ healthScoreConfig })
        })
        const data = await res.json()
        if (data.success) {
            setHealthScoreConfig(data.healthScoreConfig)
            alert("Health score settings saved")
        } else {
            alert("Failed to save: " + (data.message || "Unknown error"))
        }
    }

    function resetHealthScoreConfig() {
        setHealthScoreConfig(JSON.parse(JSON.stringify(DEFAULT_HEALTH_SCORE_CONFIG)))
    }

    function setGroupWeight(field: 'macroWeight' | 'microWeight', value: number) {
        const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
        setHealthScoreConfig(prev => ({ ...prev, [field]: v }))
    }

    function setNutrientWeight(key: string, value: number) {
        const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
        setHealthScoreConfig(prev => ({ ...prev, weights: { ...prev.weights, [key]: v } }))
    }

    function toggleLimit(key: string) {
        setHealthScoreConfig(prev => {
            const limitNutrients = prev.limitNutrients.includes(key)
                ? prev.limitNutrients.filter(k => k !== key)
                : [...prev.limitNutrients, key]
            return { ...prev, limitNutrients }
        })
    }

    const effectiveWeight = (key: string): number => {
        if (healthScoreConfig.weights[key] !== undefined) return healthScoreConfig.weights[key]
        return NUTRIENT_LABELS[key as keyof typeof NUTRIENT_LABELS].group === 'macro'
            ? healthScoreConfig.macroWeight
            : healthScoreConfig.microWeight
    }

    const previewScore = useMemo(() => {
        if (!targets || Object.keys(todayTotals).length === 0) return null
        return calculateHealthScore(todayTotals, targets, healthScoreConfig)
    }, [todayTotals, targets, healthScoreConfig])

    const previewColor = previewScore === null
        ? 'text-muted-foreground'
        : previewScore > 80
            ? 'text-emerald-400'
            : previewScore > 50
                ? 'text-amber-400'
                : 'text-rose-400'

    useEffect(() => {
        if (isAuthed) {
            getUserDetails()
            loadHealthScoreData()
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
                            const val = userData[key]
                            if (key === '_id' || key === 'passwordHash' || key === '__v') return null // Hide internal/sensitive fields
                            if (val !== null && typeof val === 'object') return null // Skip nested objects (e.g. health_score_config)

                            return (
                                <FormField
                                    key={key}
                                    label={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                                    id={key}
                                    value={val || ''}
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
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/20 rounded-lg border border-border/20 mb-4 transition-colors">
                        <div className="min-w-0">
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
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/20 rounded-lg border border-border/20 transition-colors">
                        <div className="min-w-0">
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

                {/* Health Score Settings */}
                <div className="glass-card mt-8">
                    <div className="flex items-center gap-2 mb-2">
                        <MdMonitorHeart className="text-emerald-500" size={20} />
                        <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">Health Score</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                        The Health % score is a weighted average of how well your intake hits each target (capped at 100%).
                        Macros default to 2x weight, micronutrients 1x. Set any weight to 0 to exclude that nutrient. Toggle
                        <span className="font-bold text-foreground"> L</span> to mark a nutrient as a limit &mdash; under target scores perfect, over is penalised.
                    </p>

                    {/* Live preview */}
                    <div className="p-4 bg-muted/20 rounded-lg border border-border/20 mb-4">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="font-semibold text-foreground">Today's score with current settings</p>
                                <p className="text-xs text-muted-foreground">Updates live as you change the weights below.</p>
                            </div>
                            <span className={`text-3xl font-black shrink-0 ${previewColor}`}>{previewScore === null ? '—' : `${previewScore}%`}</span>
                        </div>
                        {previewScore === null && (
                            <p className="text-xs text-muted-foreground mt-2">Log some food today to see a live preview.</p>
                        )}
                    </div>

                    {/* Group default weights */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Macro weight (default)</span>
                            <Input type="number" min={0} step={0.5} value={healthScoreConfig.macroWeight} onChange={(e) => setGroupWeight('macroWeight', Number(e.target.value))} />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Micro weight (default)</span>
                            <Input type="number" min={0} step={0.5} value={healthScoreConfig.microWeight} onChange={(e) => setGroupWeight('microWeight', Number(e.target.value))} />
                        </label>
                    </div>

                    {/* Per-nutrient table */}
                    {SCORE_GROUPS.map((group) => (
                        <div key={group} className="mb-5">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
                                {group === 'macro' ? 'Macros' : group === 'mineral' ? 'Minerals' : 'Vitamins'}
                            </h4>
                            <div className="space-y-1.5">
                                {ALL_SCORE_NUTRIENT_KEYS[group].map((key) => {
                                    const info = NUTRIENT_LABELS[key as keyof typeof NUTRIENT_LABELS]
                                    const isLimit = healthScoreConfig.limitNutrients.includes(key)
                                    return (
                                        <div key={key} className="flex items-center gap-3 p-2 bg-muted/20 rounded-lg border border-border/20">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold truncate">{info.label}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase font-bold">{info.unit}</div>
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="toggle toggle-emerald"
                                                checked={isLimit}
                                                onChange={() => toggleLimit(key)}
                                                title="Limit: under target = perfect, over = penalised"
                                            />
                                            <Input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={effectiveWeight(key)}
                                                onChange={(e) => setNutrientWeight(key, Number(e.target.value))}
                                                className="w-20 h-9 px-2 text-center"
                                                title={`Weight for ${info.label} (0 = excluded)`}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <Button type="button" onClick={saveHealthScoreConfig}>
                            Save Health Score Settings
                        </Button>
                        <Button type="button" variant="outline" onClick={resetHealthScoreConfig}>
                            Reset to Defaults
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
