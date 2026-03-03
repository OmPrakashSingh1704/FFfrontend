import { API_BASE_URL } from './env'

function getWsBaseUrl() {
  try {
    const apiUrl = new URL(API_BASE_URL)
    const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${apiUrl.host}`
  } catch {
    const fallback = new URL(window.location.origin)
    const protocol = fallback.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${fallback.host}`
  }
}

export function buildWsUrl(path: string, token?: string | null) {
  const base = getWsBaseUrl()
  const url = new URL(path, `${base}/`)

  if (token) {
    url.searchParams.set('token', token)
  }

  return url.toString()
}
