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

/** Public status page URL (e.g. https://status.founderslib.in). Empty if not configured. */
export const STATUS_PAGE_URL =
  (import.meta.env.VITE_STATUS_PAGE_URL as string | undefined)?.replace(/\/$/, '') || ''

/**
 * Better Stack status page slug for fetching the public summary JSON.
 * If set, frontend can poll `https://uptime.betterstack.com/api/v2/status_pages/<slug>/summary`
 * to render a live status indicator. Optional.
 */
export const STATUS_PAGE_SUMMARY_URL =
  (import.meta.env.VITE_STATUS_PAGE_SUMMARY_URL as string | undefined) || ''

/**
 * Cloudflare Turnstile public site key. When set, the signup form renders the
 * Turnstile widget and the backend will require a valid token. Leave empty in
 * dev to skip the captcha entirely.
 */
export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || ''
