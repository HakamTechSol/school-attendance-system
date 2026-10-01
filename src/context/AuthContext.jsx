import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth'

/** Hard ceiling on the initial auth+profile load before we surface an error. */
const AUTH_TIMEOUT_MS = 8000

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [school, setSchool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timedOut, setTimedOut] = useState(false)
  const [profileMissing, setProfileMissing] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Tracks the user id we have already resolved, so repeated auth events for
  // the same user (tab focus, token refresh) never re-trigger the loader.
  const resolvedUserId = useRef(null)
  // Bumped by retry() to force the keyed effect to run again.
  const [reloadNonce, setReloadNonce] = useState(0)

  const clearAuthState = useCallback(() => {
    resolvedUserId.current = null
    setSession(null)
    setProfile(null)
    setSchool(null)
    setProfileMissing(false)
    setLoadError('')
    setTimedOut(false)
  }, [])

  // ---- Session listener -------------------------------------------------
  // The callback MUST stay synchronous. Awaiting a supabase query inside
  // onAuthStateChange deadlocks supabase-js (the auth client holds an
  // internal lock that the data request waits on).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextId = nextSession?.user?.id ?? null

      // Silent update: already resolved this exact user, just keep the token.
      if (event !== 'SIGNED_OUT' && nextId && nextId === resolvedUserId.current) {
        setSession(nextSession)
        return
      }

      if (event === 'SIGNED_OUT') {
        clearAuthState()
        setLoading(false)
        return
      }

      // Everything else (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED for a
      // new user) just stores the session. The effect below does the work.
      setSession(nextSession)
    })

    return () => sub.subscription.unsubscribe()
  }, [clearAuthState])

  // ---- Initial session read ---------------------------------------------
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(
      ({ data }) => {
        if (!active) return
        setSession(data.session ?? null)
        if (!data.session) setLoading(false)
      },
      () => {
        if (!active) return
        setLoadError('Could not reach the server. Check your connection.')
        setLoading(false)
      },
    )

    return () => {
      active = false
    }
  }, [])

  // ---- Profile + school load, keyed on the user id ----------------------
  useEffect(() => {
    const userId = session?.user?.id ?? null

    // Logout already resets everything in the SIGNED_OUT handler above.
    if (!userId) {
      resolvedUserId.current = null
      return
    }

    if (resolvedUserId.current === userId) return

    let active = true
    setLoading(true)
    setLoadError('')
    setTimedOut(false)

    // Single round trip: profile plus its school row.
    supabase
      .from('profiles')
      .select('id, school_id, full_name, email, app_role, designation, school:schools(id, name, timezone, check_in_start, late_after, auto_checkout_at, ip_restriction_enabled)')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return

        if (error) {
          // Not marked resolved, so a later auth event or retry() can recover.
          setLoadError(error.message || 'Could not load your profile.')
          return
        }

        if (!data) {
          resolvedUserId.current = userId
          setTimedOut(false)
          setProfile(null)
          setSchool(null)
          setProfileMissing(true)
          return
        }

        resolvedUserId.current = userId
        // A late answer that beats the 8s guard clears the timeout banner.
        setTimedOut(false)
        const { school: schoolRow, ...profileRow } = data
        setProfile(profileRow)
        setSchool(schoolRow ?? null)
        setProfileMissing(false)
      })
      .catch((err) => {
        if (active) setLoadError(err?.message || 'Could not load your profile.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [session?.user?.id, reloadNonce])

  // ---- Safety net: never spin forever -----------------------------------
  useEffect(() => {
    if (!loading) return undefined

    const id = setTimeout(() => {
      setTimedOut(true)
      setLoading(false)
    }, AUTH_TIMEOUT_MS)

    return () => clearTimeout(id)
  }, [loading])

  const retry = useCallback(() => {
    resolvedUserId.current = null
    setTimedOut(false)
    setLoadError('')
    setLoading(true)
    setReloadNonce((n) => n + 1)
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    clearAuthState()
    if (error) throw error
  }, [clearAuthState])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      school,
      timezone: school?.timezone ?? 'Asia/Karachi',
      lateAfter: school?.late_after ?? '08:00',
      role: profile?.app_role ?? null,
      isAdmin: profile?.app_role === 'admin',
      profileMissing,
      loading,
      timedOut,
      loadError,
      retry,
      signIn,
      signOut,
    }),
    [session, profile, school, profileMissing, loading, timedOut, loadError, retry, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}