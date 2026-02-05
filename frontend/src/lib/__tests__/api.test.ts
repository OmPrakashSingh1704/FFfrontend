import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { apiRequest } from '../api'
import { setTokens } from '../tokenStorage'
import { server } from '../../test/server'

describe('apiRequest', () => {
  it('attaches access token and parses response', async () => {
    let authHeader: string | null = null

    server.use(
      http.get('http://localhost:8000/api/v1/test/', ({ request }) => {
        authHeader = request.headers.get('authorization')
        return HttpResponse.json({ ok: true })
      }),
    )

    setTokens({ accessToken: 'test-token', refreshToken: null })
    const result = await apiRequest<{ ok: boolean }>('/test/')

    expect(authHeader).toBe('Bearer test-token')
    expect(result.ok).toBe(true)
  })
})
