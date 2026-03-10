import { useEffect, useState } from 'react'
import Router from 'next/router'

export function useAuthGuard() {
    const [isAuthed, setIsAuthed] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('Token')
        if (!token) {
            Router.push('/login')
        } else {
            setIsAuthed(true)
        }
    }, [])

    return isAuthed
}
