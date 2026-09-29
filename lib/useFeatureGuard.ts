import { useEffect } from 'react'
import Router from 'next/router'
import { useUser } from './UserContext'
import { needsOnboarding } from './features'

/**
 * Auth + feature guard for client pages. Returns true only once the user is
 * known, authenticated, onboarded and (when `key` is given) has the feature
 * enabled. Redirects handled centrally in UserProvider; this hook adds a
 * page-local fallback so gated pages never render their content early.
 */
export function useFeatureGuard(key?: string) {
    const { ready, isAuthed, hasFeature, user } = useUser()
    const allowed = ready && isAuthed && (!key || hasFeature(key))

    useEffect(() => {
        if (!ready) return
        if (!isAuthed) {
            Router.replace('/login')
            return
        }
        if (needsOnboarding(user)) return // provider sends to /welcome
        if (key && !hasFeature(key)) Router.replace('/')
    }, [ready, isAuthed, key, hasFeature, user])

    return allowed
}
