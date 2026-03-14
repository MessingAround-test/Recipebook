import { useEffect, useState } from 'react'
import Router from 'next/router'

export function useAdminGuard() {
    const [isAuthorized, setIsAuthorized] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('Token')
        if (!token) {
            Router.push('/login')
            return
        }

        checkAuth(token)
    }, [])

    async function checkAuth(token: string) {
        try {
            const res = await fetch("/api/UserDetails", {
                headers: { 'edgetoken': token }
            })
            const data = await res.json()
            if (data.res && data.res.role === 'admin') {
                setIsAuthorized(true)
            } else {
                Router.push("/")
            }
        } catch (error) {
            console.error("Admin auth check failed:", error)
            Router.push("/")
        }
    }

    return isAuthorized
}
