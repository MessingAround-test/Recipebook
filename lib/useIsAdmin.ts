import { useEffect, useState } from 'react'

/**
 * Client-side admin check for UI gating. Defaults to false so privileged
 * controls stay hidden until the role is confirmed. Server routes enforce the
 * real authorization independently.
 */
export function useIsAdmin() {
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('Token')
        if (!token) return
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch('/api/UserDetails', { headers: { edgetoken: token } })
                const data = await res.json()
                if (!cancelled) setIsAdmin(data?.res?.role === 'admin')
            } catch {
                /* ignore */
            }
        })()
        return () => { cancelled = true }
    }, [])

    return isAdmin
}
