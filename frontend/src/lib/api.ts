import { API_BASE_URL, USE_COOKIE_AUTH } from './env'
import { clearTokens, getTokens, setTokens } from './tokenStorage'

export type ApiError = {
  status: number
  message: string
  details?: unknown
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
    try {
      const accessToken = await refreshAccessToken(tokens.refreshToken)
      const retry = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: { ...requestHeaders, Authorization: `Bearer ${accessToken}` },
        body: body ? JSON.stringify(body) : undefined,
        signal,
        ...(USE_COOKIE_AUTH ? { credentials: 'include' } : {}),
      })

      if (!retry.ok) {
        const retryData = await safeJson(retry)
        throw { status: retry.status, message: 'Request failed', details: retryData } as ApiError
      }

      return (await safeJson(retry)) as T
    } catch (error) {
      clearTokens()
      throw error
    }
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
