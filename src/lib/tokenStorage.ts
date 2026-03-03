const ACCESS_KEY = 'ff_access_token'
const REFRESH_KEY = 'ff_refresh_token'

export type AuthTokens = {
  accessToken: string | null
  refreshToken: string | null
}

export function getTokens(): AuthTokens {
  return {
    accessToken: localStorage.getItem(ACCESS_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
  }
}

export function setTokens(tokens: AuthTokens) {
  if (tokens.accessToken) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken)
  } else {
    localStorage.removeItem(ACCESS_KEY)
  }

  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
  } else {
    localStorage.removeItem(REFRESH_KEY)
  }
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}
