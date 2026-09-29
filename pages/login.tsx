import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { MdVisibility, MdVisibilityOff, MdErrorOutline, MdCheckCircleOutline } from 'react-icons/md'
import { useUser } from '../lib/UserContext'

export default function Login() {
    const router = useRouter()
    const { refresh } = useUser()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const justRegistered = router.query.registered === '1'

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res = await fetch("/api/login", {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            })
            const data = await res.json()
            if (data.success === true) {
                localStorage.setItem('Token', data.data.token)
                // Cookie lets <img>/<link> navigations authenticate (proxy.js maps
                // it onto the edgetoken header for API routes).
                document.cookie = `edgetoken=${encodeURIComponent(data.data.token)}; path=/; max-age=31536000; SameSite=Lax`
                // Load the user into context so guards/nav know we're authed
                // (and whether onboarding is still required).
                await refresh()
                router.push('/')
            } else {
                setError(typeof data.message === 'string' ? data.message : 'Incorrect email or password.')
                setLoading(false)
            }
        } catch {
            setError('Something went wrong. Please try again.')
            setLoading(false)
        }
    }

    return (
        <AuthShell title="Welcome back" subtitle="Sign in to continue to your kitchen.">
            <form onSubmit={onSubmit} className="space-y-4">
                {justRegistered && !error && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-400">
                        <MdCheckCircleOutline className="mt-0.5 shrink-0" size={16} />
                        <span>Account created. Sign in to get cooking.</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-400">
                        <MdErrorOutline className="mt-0.5 shrink-0" size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        Email
                    </Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        Password
                    </Label>
                    <div className="relative">
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-12 pr-11"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-emerald-400"
                        >
                            {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                        </button>
                    </div>
                </div>

                <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full bg-emerald-500 text-xs font-black uppercase tracking-[0.2em] text-black shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-60"
                >
                    {loading ? 'Signing in…' : 'Sign In'}
                </Button>

                <p className="pt-2 text-center text-sm text-muted-foreground">
                    New here?{' '}
                    <Link href="/register" className="font-bold text-emerald-400 transition-colors hover:text-emerald-300">
                        Create an account
                    </Link>
                </p>
            </form>
        </AuthShell>
    )
}
