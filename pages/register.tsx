import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { MdVisibility, MdVisibilityOff, MdErrorOutline } from 'react-icons/md'

export default function Register() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res = await fetch("/api/signup", {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, username })
            })
            const data = await res.json()
            if (data.success === true) {
                router.push('/login?registered=1')
            } else {
                setError(typeof data.message === 'string' ? data.message : 'Could not create your account.')
                setLoading(false)
            }
        } catch {
            setError('Something went wrong. Please try again.')
            setLoading(false)
        }
    }

    return (
        <AuthShell title="Create your account" subtitle="Start organising your recipes and nutrition.">
            <form onSubmit={onSubmit} className="space-y-4">
                {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-400">
                        <MdErrorOutline className="mt-0.5 shrink-0" size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        Username
                    </Label>
                    <Input
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        placeholder="Chef Bryn"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-12"
                        required
                    />
                </div>

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
                            autoComplete="new-password"
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
                    {loading ? 'Creating account…' : 'Create Account'}
                </Button>

                <p className="pt-2 text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link href="/login" className="font-bold text-emerald-400 transition-colors hover:text-emerald-300">
                        Sign in
                    </Link>
                </p>
            </form>
        </AuthShell>
    )
}
