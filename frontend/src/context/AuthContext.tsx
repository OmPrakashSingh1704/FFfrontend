import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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

  const refreshUser = useCallback(async () => {
    const tokens = getTokens()
    if (!tokens.accessToken) {
      setStatus('unauthenticated')
      setUser(null)
      setAccessToken(null)
      return
    }

    setStatus('loading')
    try {
      const me = await apiRequest<User>('/users/me/', { auth: true })
      setUser(me)
      setStatus('authenticated')
      setAccessToken(tokens.accessToken)
    } catch {
      clearTokens()
      setAccessToken(null)
      setUser(null)
      setStatus('unauthenticated')
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
