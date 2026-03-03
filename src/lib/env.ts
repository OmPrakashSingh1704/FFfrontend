export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
  /\/$/,
  '',
) || 'http://localhost:8000/api/v1'

/** Backend origin derived from API_BASE_URL (e.g. "http://localhost:8000") */
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+$/, '')

/** Resolve a relative media path (e.g. "/media/pic.jpg") to a full URL on the backend. */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${BACKEND_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`
}

export const USE_COOKIE_AUTH = (import.meta.env.VITE_API_USE_COOKIES as string | undefined) === 'true'
