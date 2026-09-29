import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { useRouter } from 'next/router'
import { FeatureMap, keyForPath, needsOnboarding, resolveFeatures } from './features'

interface UserContextValue {
    /** Full user document (minus password) once loaded, else null. */
    user: any | null
    /** Resolved feature map (defaults merged with the user's stored values). */
    features: FeatureMap
    isAdmin: boolean
    isAuthed: boolean
    /** True once the initial user details fetch has settled. */
    ready: boolean
    hasFeature: (key: string) => boolean
    refresh: () => Promise<void>
}

const noop = async () => { }

const UserContext = createContext<UserContextValue>({
    user: null,
    features: {},
    isAdmin: false,
    isAuthed: false,
    ready: false,
    hasFeature: () => false,
    refresh: noop,
})

const AUTH_EXEMPT = ['/login', '/register']

export function UserProvider({ children }: { children: ReactNode }) {
    const router = useRouter()
    const [user, setUser] = useState<any | null>(null)
    const [isAuthed, setIsAuthed] = useState(false)
    const [ready, setReady] = useState(false)

    const refresh = useCallback(async () => {
        if (typeof window === 'undefined') return
        const token = localStorage.getItem('Token')
        if (!token) {
            setIsAuthed(false)
            setUser(null)
            setReady(true)
            return
        }
        setIsAuthed(true)
        try {
            const res = await fetch('/api/UserDetails', { headers: { edgetoken: token } })
            if (res.status === 401) {
                localStorage.removeItem('Token')
                document.cookie = 'edgetoken=; path=/; max-age=0; SameSite=Lax'
                setIsAuthed(false)
                setUser(null)
            } else {
                const data = await res.json()
                setUser(data?.res || null)
            }
        } catch {
            /* keep current state on transient errors */
        } finally {
            setReady(true)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const features = useMemo(() => resolveFeatures(user), [user])
    const isAdmin = user?.role === 'admin'

    const hasFeature = useCallback((key: string) => features[key] === true, [features])

    // Global route protection: onboarding redirect takes priority, then
    // per-feature route gating. Page-level `useFeatureGuard` mirrors this for
    // render gating, but this covers every route in one place.
    useEffect(() => {
        if (!ready || !router.isReady) return
        const path = router.pathname
        if (AUTH_EXEMPT.includes(path)) return
        if (!isAuthed) {
            router.replace('/login')
            return
        }
        if (path === '/welcome') return
        if (needsOnboarding(user)) {
            router.replace('/welcome')
            return
        }
        const owner = keyForPath(path)
        if (owner && features[owner] !== true) {
            router.replace('/')
        }
    }, [ready, router, router.isReady, router.pathname, isAuthed, user, features])

    const value = useMemo<UserContextValue>(() => ({
        user,
        features,
        isAdmin,
        isAuthed,
        ready,
        hasFeature,
        refresh,
    }), [user, features, isAdmin, isAuthed, ready, hasFeature, refresh])

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
    return useContext(UserContext)
}
