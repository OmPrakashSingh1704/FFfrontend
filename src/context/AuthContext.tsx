import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../lib/api'
import { clearActiveCallIds, getActiveCallIds } from '../lib/callSession'
import { clearTokens, getTokens, setTokens } from '../lib/tokenStorage'
import type { User } from '../types/user'

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

type AuthContextValue = {
  status: AuthStatus
  user: User | null
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('idle')
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(getTokens().accessToken)

  // Track whether we ever successfully loaded a user. Lets the catch branch
  // decide between "transient blip on top of a known session" (keep status)
  // vs. "we never had a session, bail" (flip to unauthenticated). A ref —
  // NOT user state — because keying useCallback on user causes the effect
  // below to re-fire every successful load → infinite fetch loop.
  const hasLoadedUserRef = useRef(false)

  const refreshUser = useCallback(async () => {
    const tokens = getTokens()
    if (!tokens.accessToken) {
      setStatus('unauthenticated')
      setUser(null)
      setAccessToken(null)
      hasLoadedUserRef.current = false
      return
    }

    setStatus('loading')
    try {
      const me = await apiRequest<User>('/users/me/', { auth: true })
      setUser(me)
      setStatus('authenticated')
      setAccessToken(tokens.accessToken)
      hasLoadedUserRef.current = true
    } catch (err: unknown) {
      // Only nuke the session for real auth failures. A transient 500 / network
      // blip / 404 (shouldn't happen on /users/me/ but defensively) must not
      // log the user out — apiRequest already handles real 401 by clearing
      // tokens for us inside the retry path.
      const apiStatus = (err as { status?: number })?.status
      if (apiStatus === 401 || apiStatus === 403) {
        clearTokens()
        setAccessToken(null)
        setUser(null)
        setStatus('unauthenticated')
        hasLoadedUserRef.current = false
      } else if (!hasLoadedUserRef.current) {
        // No prior successful load — bail to unauthenticated so ProtectedRoute
        // can redirect. Don't clear tokens, the user can retry.
        setStatus('unauthenticated')
      }
      // else: keep the stale user + 'authenticated' status. Caller can retry.
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    setStatus('loading')
    const data = await apiRequest<{ access?: string; refresh?: string; access_token?: string; refresh_token?: string }>(
      '/users/auth/login/',
      {
        method: 'POST',
        body: { email, password },
        auth: false,
      },
    )

    const access = data.access ?? data.access_token ?? null
    const refresh = data.refresh ?? data.refresh_token ?? null

    if (access) {
      setTokens({ accessToken: access, refreshToken: refresh })
      setAccessToken(access)
      await refreshUser()
      return
    }

    setStatus('unauthenticated')
    throw new Error('Login failed')
  }, [refreshUser])

  const logout = useCallback(async () => {
    const tokens = getTokens()
    try {
      const activeCallIds = getActiveCallIds()
      if (activeCallIds.length) {
        await Promise.all(
          activeCallIds.map(async (callId) => {
            try {
              await apiRequest(`/chat/calls/${callId}/end/`, {
                method: 'POST',
                body: { reason: 'logout' },
              })
            } catch {
              try {
                await apiRequest(`/chat/calls/${callId}/leave/`, { method: 'POST' })
              } catch {
                // best-effort only
              }
            }
          }),
        )
      }
      clearActiveCallIds()
      if (tokens.refreshToken) {
        await apiRequest('/users/auth/logout/', {
          method: 'POST',
          body: { refresh_token: tokens.refreshToken },
        })
      }
    } finally {
      clearTokens()
      setAccessToken(null)
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  const value = useMemo(
    () => ({
      status,
      user,
      accessToken,
      login,
      logout,
      refreshUser,
    }),
    [status, user, accessToken, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
