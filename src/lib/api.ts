import { API_BASE_URL, USE_COOKIE_AUTH } from './env'
import { clearTokens, getTokens, setTokens } from './tokenStorage'

export type ApiError = {
  status: number
  message: string
  details?: unknown
}

// Custom event name fired whenever the request layer decides the session
// has irrecoverably expired (refresh failed, or a freshly-refreshed access
// token is still rejected). AuthContext listens for it and flips status to
// 'unauthenticated', which lets ProtectedRoute redirect to the landing
// page instead of leaving the user on a broken protected screen that keeps
// firing failing API calls.
export const AUTH_EXPIRED_EVENT = 'ff:auth-expired'

function fireAuthExpired() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  auth?: boolean
  signal?: AbortSignal
}

const SAFE_METHODS = new Set(['GET'])

function getCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = document.cookie ? document.cookie.split(';') : []
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split('=')
    if (key === name) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(`${API_BASE_URL}/users/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken, refresh_token: refreshToken }),
  })

  if (!response.ok) {
    throw new Error('Unable to refresh token')
  }

  const data = (await response.json()) as { access?: string; access_token?: string; refresh?: string }
  const accessToken = data.access ?? data.access_token ?? null
  const nextRefresh = data.refresh ?? refreshToken

  if (!accessToken) {
    throw new Error('No access token returned')
  }

  setTokens({ accessToken, refreshToken: nextRefresh })
  return accessToken
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, auth = true, signal } = options
  const tokens = getTokens()

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (USE_COOKIE_AUTH && !SAFE_METHODS.has(method)) {
    const csrfToken = getCookieValue('csrftoken')
    if (csrfToken) {
      requestHeaders['X-CSRFToken'] = csrfToken
    }
  }

  if (auth && tokens.accessToken) {
    requestHeaders.Authorization = `Bearer ${tokens.accessToken}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal,
    ...(USE_COOKIE_AUTH ? { credentials: 'include' } : {}),
  })

  if (response.status === 401 && auth && tokens.refreshToken) {
    let accessToken: string
    try {
      accessToken = await refreshAccessToken(tokens.refreshToken)
    } catch (error) {
      // Refresh itself failed — tokens really are invalid, log the user out
      // AND notify AuthContext so ProtectedRoute can redirect to landing.
      clearTokens()
      fireAuthExpired()
      throw error
    }

    const retry = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { ...requestHeaders, Authorization: `Bearer ${accessToken}` },
      body: body ? JSON.stringify(body) : undefined,
      signal,
      ...(USE_COOKIE_AUTH ? { credentials: 'include' } : {}),
    })

    if (!retry.ok) {
      // Only treat the retry as an auth failure if it's ALSO 401 — that means
      // the freshly-minted token is somehow rejected (server-side revocation
      // / clock skew / etc), and the user really should be logged out. For
      // 404/403/500 the auth worked fine; the resource just doesn't exist or
      // isn't accessible, and we must NOT nuke the session.
      if (retry.status === 401) {
        clearTokens()
        fireAuthExpired()
      }
      const retryData = await safeJson(retry)
      throw { status: retry.status, message: 'Request failed', details: retryData } as ApiError
    }

    return (await safeJson(retry)) as T
  }

  // Hit a 401 but we have no refresh token to try — session is dead, kick
  // the user back to landing instead of leaving them stranded on a
  // protected page that just keeps firing failing requests.
  if (response.status === 401 && auth && !tokens.refreshToken && tokens.accessToken) {
    clearTokens()
    fireAuthExpired()
  }

  if (!response.ok) {
    const data = await safeJson(response)
    throw { status: response.status, message: 'Request failed', details: data } as ApiError
  }

  return (await safeJson(response)) as T
}

export async function uploadRequest<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestOptions, 'body' | 'headers'> = {},
): Promise<T> {
  const { method = 'POST', auth = true, signal } = options
  const tokens = getTokens()

  const requestHeaders: Record<string, string> = {}

  if (USE_COOKIE_AUTH && !SAFE_METHODS.has(method)) {
    const csrfToken = getCookieValue('csrftoken')
    if (csrfToken) {
      requestHeaders['X-CSRFToken'] = csrfToken
    }
  }

  if (auth && tokens.accessToken) {
    requestHeaders.Authorization = `Bearer ${tokens.accessToken}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: formData,
    signal,
    ...(USE_COOKIE_AUTH ? { credentials: 'include' } : {}),
  })

  // Upload doesn't bother with the refresh-and-retry dance (file bodies
  // are large and re-uploading on every transient 401 is wasteful), but
  // we still need to notify AuthContext on hard 401 so the user gets
  // bounced to landing instead of staring at a "Upload failed" toast.
  if (response.status === 401 && auth && tokens.accessToken) {
    clearTokens()
    fireAuthExpired()
  }

  if (!response.ok) {
    const data = await safeJson(response)
    throw { status: response.status, message: 'Upload failed', details: data } as ApiError
  }

  return (await safeJson(response)) as T
}

async function safeJson(response: Response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
