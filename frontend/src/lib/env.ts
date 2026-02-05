export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
  /\/$/,
  '',
) || 'http://localhost:8000/api/v1'

export const USE_COOKIE_AUTH = (import.meta.env.VITE_API_USE_COOKIES as string | undefined) === 'true'
