const FALLBACK_API_BASE_URL = 'http://localhost:8000/api/v1'

function normalizeApiBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return FALLBACK_API_BASE_URL

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '')
  if (!withoutTrailingSlash) return FALLBACK_API_BASE_URL

  if (withoutTrailingSlash.startsWith('/')) return withoutTrailingSlash

  const absolute = /^https?:\/\//i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `https://${withoutTrailingSlash}`

  try {
    // Validate absolute URLs, fallback only when malformed.
    new URL(absolute)
    return absolute
  } catch {
    return FALLBACK_API_BASE_URL
  }
}

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL as string | undefined,
)

/** Backend origin derived from API_BASE_URL (e.g. "http://localhost:8000") */
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+$/, '')

/** Resolve a relative media path (e.g. "/media/pic.jpg") to a full URL on the backend. */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${BACKEND_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`
}

export const USE_COOKIE_AUTH = (import.meta.env.VITE_API_USE_COOKIES as string | undefined) === 'true'
