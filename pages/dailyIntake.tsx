import React, { useEffect, useState, FormEvent } from 'react'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { PageHeader } from '../components/PageHeader'
import { useAuthGuard } from '../lib/useAuthGuard'
import { useRouter } from 'next/router'
import { calculateDailyIntake, NUTRIENT_LABELS, UserProfile, DailyIntakeTargets } from '../lib/dailyIntake'
import { MdArrowBack, MdPerson, MdFitnessCenter, MdRestaurant, MdScience } from 'react-icons/md'

const ACTIVITY_OPTIONS = [
    { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
    { value: 'light', label: 'Light', desc: '1–3 days/week exercise' },
    { value: 'moderate', label: 'Moderate', desc: '3–5 days/week exercise' },
    { value: 'active', label: 'Active', desc: '6–7 days/week exercise' },
    { value: 'very_active', label: 'Very Active', desc: 'Hard daily training' },
]

const GENDER_OPTIONS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other / Prefer not to say' },
]

const DIETARY_OPTIONS = [
    { value: 'none', label: 'None', desc: 'No restrictions' },
    { value: 'vegetarian', label: 'Vegetarian', desc: 'No meat or seafood' },
    { value: 'vegan', label: 'Vegan', desc: 'No animal products' },
    { value: 'pescetarian', label: 'Pescetarian', desc: 'No meat, but seafood is okay' },
]

type Group = 'macro' | 'mineral' | 'vitamin'

function NutrientBar({ label, value, target, unit }: { label: string; value?: number; target: number; unit: string }) {
    const pct = value !== undefined ? Math.min((value / target) * 100, 120) : 0
    const color = pct >= 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#6366f1'
    return (
        <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground">
                    {target}{unit}
                </span>
            </div>
            <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                />
            </div>
        </div>
    )
}

export default function DailyIntakePage() {
    const isAuthed = useAuthGuard()
    const router = useRouter()

    const [profile, setProfile] = useState<UserProfile>({
        age: undefined,
        gender: undefined,
        weight_kg: undefined,
        height_cm: undefined,
        activity_level: undefined,
        dietary_preference: 'none',
        daily_exercise_kj: 0,
    })

    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [activeGroup, setActiveGroup] = useState<Group>('macro')

    // Live-computed targets from profile
    const targets: DailyIntakeTargets = calculateDailyIntake(profile)

    // Load existing profile data from server
    async function loadProfile() {
        const token = localStorage.getItem('Token')
        if (!token) return
        try {
            const res = await fetch('/api/UserDetails', { headers: { edgetoken: token } })
            const data = await res.json()
            console.log("Loaded profile data:", data.res)
            if (data.res) {
                const u = data.res
                setProfile({
                    age: u.age,
                    gender: u.gender,
                    weight_kg: u.weight_kg,
                    height_cm: u.height_cm,
                    activity_level: u.activity_level,
                    dietary_preference: u.dietary_preference || 'none',
                    daily_exercise_kj: u.daily_exercise_kj ?? 0,
                })
            }
        } catch (e) {
            console.error("Failed to load profile", e)
        }
    }

    async function saveProfile(e: FormEvent) {
        e.preventDefault()
        setSaving(true)
        const token = localStorage.getItem('Token')
        if (!token) return
        
        console.log("Saving profile data:", profile)
        try {
            const res = await fetch('/api/UserDetails', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', edgetoken: token },
                body: JSON.stringify(profile),
            })
            
            const data = await res.json()
            if (res.ok) {
                console.log("Save successful. Updated user:", data.res)
                if (data.res) {
                    const u = data.res
                    setProfile({
                        age: u.age,
                        gender: u.gender,
                        weight_kg: u.weight_kg,
                        height_cm: u.height_cm,
                        activity_level: u.activity_level,
                        dietary_preference: u.dietary_preference || 'none',
                        daily_exercise_kj: u.daily_exercise_kj ?? 0,
                    })
                }
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
            } else {
                alert('Failed to save profile: ' + (data.message || res.statusText))
            }
        } catch (e) {
            console.error("Save error:", e)
            alert('Failed to save profile.')
        } finally {
            setSaving(false)
        }
    }

    useEffect(() => {
        if (isAuthed) loadProfile()
    }, [isAuthed])

    if (!isAuthed) return null

    const groupedKeys = (group: Group) =>
        (Object.entries(NUTRIENT_LABELS) as [keyof DailyIntakeTargets, typeof NUTRIENT_LABELS[keyof DailyIntakeTargets]][])
            .filter(([, meta]) => meta.group === group)

    const isProfileComplete = profile.age && profile.gender && profile.weight_kg && profile.height_cm && profile.activity_level

    return (
        <Layout title="Daily Intake" description="Manage your personalised daily nutritional intake targets">
            <PageHeader title="Daily Intake" />

            <div className="max-w-5xl px-4 pb-20">
                {/* Back to profile */}
                <button
                    onClick={() => router.push('/profile')}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
                >
                    <MdArrowBack size={16} /> Back to Profile
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* ── Left: Input form ── */}
                    <div className="glass-card">
                        <div className="flex items-center gap-2 mb-6">
                            <MdPerson className="text-emerald-500" size={20} />
                            <h2 className="text-sm font-black uppercase tracking-widest text-emerald-500">Body Profile</h2>
                        </div>

                        <form onSubmit={saveProfile} className="space-y-6">
                            {/* Gender */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                                    Biological Sex
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {GENDER_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            id={`gender-${opt.value}`}
                                            onClick={() => setProfile(p => ({ ...p, gender: opt.value as any }))}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                                                profile.gender === opt.value
                                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                                    : 'bg-muted/10 border-border/40 text-foreground hover:border-emerald-500/50'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Age / Weight / Height */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { key: 'age', label: 'Age', unit: 'yrs', min: 10, max: 120 },
                                    { key: 'weight_kg', label: 'Weight', unit: 'kg', min: 20, max: 300 },
                                    { key: 'height_cm', label: 'Height', unit: 'cm', min: 100, max: 250 },
                                ].map(field => (
                                    <div key={field.key}>
                                        <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                                            {field.label}
                                        </label>
                                        <div className="relative">
                                            <input
                                                id={`field-${field.key}`}
                                                type="number"
                                                min={field.min}
                                                max={field.max}
                                                value={(profile as any)[field.key] ?? ''}
                                                onChange={e => setProfile(p => ({ ...p, [field.key]: e.target.value ? Number(e.target.value) : undefined }))}
                                                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 pr-10 shadow-sm"
                                                placeholder="—"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">{field.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Activity level */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                                    <span className="inline-flex items-center gap-1"><MdFitnessCenter size={14} /> Activity Level</span>
                                </label>
                                <div className="space-y-2">
                                    {ACTIVITY_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            id={`activity-${opt.value}`}
                                            onClick={() => setProfile(p => ({ ...p, activity_level: opt.value as any }))}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all ${
                                                profile.activity_level === opt.value
                                                    ? 'bg-emerald-500/20 border-emerald-500 text-foreground'
                                                    : 'bg-muted/10 border-border/40 text-foreground hover:border-emerald-500/40'
                                            }`}
                                        >
                                            <span className="font-semibold">{opt.label}</span>
                                            <span className="text-xs opacity-70 italic">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dietary Preference */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                                    <span className="inline-flex items-center gap-1"><MdRestaurant size={14} /> Dietary Preference</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {DIETARY_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            id={`dietary-${opt.value}`}
                                            onClick={() => setProfile(p => ({ ...p, dietary_preference: opt.value as any }))}
                                            className={`flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all ${
                                                profile.dietary_preference === opt.value
                                                    ? 'bg-emerald-500/20 border-emerald-500 text-foreground'
                                                    : 'bg-muted/10 border-border/40 text-foreground hover:border-emerald-500/40'
                                            }`}
                                        >
                                            <span className="font-semibold text-xs">{opt.label}</span>
                                            <span className="text-[10px] opacity-70 italic leading-tight">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Exercise KJ */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                                    <span className="inline-flex items-center gap-1"><MdFitnessCenter size={14} /> Extra Exercise (approx. KJ/day)</span>
                                </label>
                                <p className="text-[11px] text-muted-foreground mb-3 leading-tight">Add KJ from workouts not captured in your activity level. 1 kcal ≈ 4.18 kJ.</p>
                                <div className="relative">
                                    <input
                                        id="field-daily_exercise_kj"
                                        type="number"
                                        min={0}
                                        max={20000}
                                        step={100}
                                        value={profile.daily_exercise_kj ?? ''}
                                        onChange={e => setProfile(p => ({ ...p, daily_exercise_kj: e.target.value ? Number(e.target.value) : 0 }))}
                                        className="w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 pr-10 shadow-sm"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">kJ</span>
                                </div>
                            </div>

                            <Button
                                id="save-intake-profile"
                                type="submit"
                                disabled={saving}
                                className="w-full py-6 text-sm font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                            >
                                {saving ? 'Saving Profile…' : saved ? '✓ Settings Saved' : 'Save Profile Settings'}
                            </Button>
                        </form>
                    </div>

                    {/* ── Right: Live targets panel ── */}
                    <div className="glass-card">
                        <div className="flex items-center gap-2 mb-4">
                            <MdRestaurant className="text-emerald-500" size={20} />
                            <h2 className="text-sm font-black uppercase tracking-widest text-emerald-500">Your Daily Targets</h2>
                        </div>

                        {!isProfileComplete && (
                            <div className="mb-4 text-xs font-medium text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                                ⚠ Fill in your profile for personalised targets. Showing generic 2000kcal defaults.
                            </div>
                        )}

                        {/* Summary chips */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
                                <div className="text-2xl font-black text-emerald-400">{targets.energy_kcal.toLocaleString()}</div>
                                <div className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest">kcal / day</div>
                            </div>
                            <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/30 p-4 text-center">
                                <div className="text-2xl font-black text-indigo-400">{Math.round(targets.energy_kcal * 4.184).toLocaleString()}</div>
                                <div className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest">kJ / day</div>
                            </div>
                        </div>

                        {/* Group tabs */}
                        <div className="flex gap-1 mb-5 bg-muted/20 rounded-lg p-1">
                            {(['macro', 'mineral', 'vitamin'] as Group[]).map(g => (
                                <button
                                    key={g}
                                    id={`tab-${g}`}
                                    onClick={() => setActiveGroup(g)}
                                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeGroup === g
                                            ? 'bg-emerald-500 text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {g === 'macro' ? '🥗 Macros' : g === 'mineral' ? '⚗️ Minerals' : '💊 Vitamins'}
                                </button>
                            ))}
                        </div>

                        {/* Nutrient rows */}
                        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {groupedKeys(activeGroup).map(([key, meta]) => {
                                if (key === 'energy_kcal') return null
                                return (
                                    <NutrientBar
                                        key={key}
                                        label={meta.label}
                                        target={targets[key]}
                                        unit={meta.unit}
                                    />
                                )
                            })}
                        </div>

                        <p className="text-[10px] text-muted-foreground mt-6 border-t border-border/20 pt-4 leading-relaxed">
                            <MdScience size={14} className="inline mr-1 text-emerald-500" />
                            <strong>Methodology:</strong> Targets calculated using the <em>Mifflin-St Jeor</em> equation and standard dietary reference values. These are estimates for general health guidance and not medical advice.
                        </p>
                    </div>
                </div>
            </div>
            
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 10px;
                }
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
            `}</style>
        </Layout>
    )
}
