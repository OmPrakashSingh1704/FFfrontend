import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

// Covers the JWT silent-refresh path in lib/api.ts (apiRequest):
//   - First request returns 401
//   - Client calls POST /users/auth/refresh/ with the stored refresh token
//   - Client retries the original request with the new access token
//   - Tokens in localStorage are updated
//   - The user stays signed in (no bounce to /)
//
// This is one of those security-critical code paths where a regression
// silently logs every user out on any 401 — and you only notice when
// support tickets pile up. Worth a dedicated test.

test('apiRequest silently refreshes the access token on 401 and retries', async ({ page }) => {
  // Pre-populate tokens so AuthProvider doesn't bounce us to /login.
  await page.addInitScript(() => {
    localStorage.setItem('ff_access_token', 'stale-access')
    localStorage.setItem('ff_refresh_token', 'valid-refresh')
  })

  // Counts so we can prove the retry actually happened (vs. the page
  // just suppressing the 401 quietly).
  let foundersCallCount = 0
  let refreshCalled = false
  const refreshBodies: Record<string, unknown>[] = []

  // /users/me/ also goes through apiRequest. Return success so AuthProvider
  // bootstraps cleanly — the refresh test is about the SECONDARY request
  // that 401s, not the initial bootstrap.
  await page.route(`${API}/users/me/`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-1',
        email: 'founder@test.local',
        full_name: 'Test Founder',
        role: 'founder',
        onboarding_completed: true,
        email_verified: true,
      }),
    })
  })

  // Return 401 for any request that arrives with the STALE access token;
  // otherwise return the empty founders list. Keying off the
  // Authorization header (instead of a call counter) makes the test
  // robust to the page issuing multiple parallel /founders/ requests —
  // we don't care which one triggers the refresh, just that the chain
  // converges on the fresh token.
  await page.route(/\/founders\//, async (route, req) => {
    if (req.method() !== 'GET') return route.fallback()
    foundersCallCount += 1
    const authHeader = req.headers()['authorization']
    if (authHeader === 'Bearer stale-access') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Token expired' }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0, results: [], next: null, previous: null }),
    })
  })

  await page.route(`${API}/users/auth/refresh/`, async (route, req) => {
    refreshCalled = true
    refreshBodies.push(JSON.parse(req.postData() || '{}'))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access: 'fresh-access', refresh: 'fresh-refresh' }),
    })
  })

  // Other endpoints AppShell might fetch on mount — empty results so we
  // don't block on them. Critically: fall through for any URL that has
  // a more-specific handler above (founders, users/me, auth/refresh),
  // otherwise this catch-all would intercept BEFORE the specific
  // handlers (Playwright LIFO matching means the catch-all is checked
  // first, and fulfilling here means the specific handler never runs).
  await page.route(`${API}/**`, async (route, req) => {
    if (req.method() !== 'GET') return route.fallback()
    const url = req.url()
    if (
      url.includes('/founders/') ||
      url.includes('/users/me') ||
      url.includes('/users/auth/refresh')
    ) {
      return route.fallback()
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/app/founders')

  // Wait for the refresh handler to fire — that's the keystone of the
  // chain. Polling on refreshCalled directly is more reliable than
  // polling on foundersCallCount and then assuming refresh has
  // completed; under parallel load, foundersCallCount can hit 2 while
  // the refresh POST is still in flight.
  await expect.poll(() => refreshCalled, { timeout: 10_000 }).toBe(true)
  // foundersCallCount will be >= 2 once the retry has landed (which
  // can't happen until after refresh).
  await expect.poll(() => foundersCallCount, { timeout: 5_000 }).toBeGreaterThanOrEqual(2)

  // The refresh body must contain the stale refresh token from
  // localStorage. The api client posts BOTH `refresh` and
  // `refresh_token` for backend compatibility — assert one of them is
  // present rather than pinning the exact wire format.
  expect(
    refreshBodies[0]['refresh'] === 'valid-refresh' || refreshBodies[0]['refresh_token'] === 'valid-refresh',
  ).toBe(true)

  // Tokens in localStorage should be updated to the fresh pair so
  // subsequent requests use the new access token without another round
  // trip. This is THE critical bug-prevention assertion — if this
  // breaks, every request after the first 401 would re-trigger refresh.
  const stored = await page.evaluate(() => ({
    access: localStorage.getItem('ff_access_token'),
    refresh: localStorage.getItem('ff_refresh_token'),
  }))
  expect(stored.access).toBe('fresh-access')
  expect(stored.refresh).toBe('fresh-refresh')

  // The user is still on /app/founders (no bounce to /).
  expect(page.url()).toContain('/app/founders')
})

test('hard 401 on refresh itself clears tokens (forces re-login)', async ({ page }) => {
  // The "real" auth failure: the refresh token itself is invalid. The
  // api client must clear tokens so ProtectedRoute boots the user back
  // to landing rather than ping-ponging refresh attempts forever.
  await page.addInitScript(() => {
    localStorage.setItem('ff_access_token', 'stale-access')
    localStorage.setItem('ff_refresh_token', 'bad-refresh')
  })

  await page.route(`${API}/users/me/`, async (route) => {
    // First request fails with 401 — triggers refresh attempt.
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Token expired' }),
    })
  })
  await page.route(`${API}/users/auth/refresh/`, async (route) => {
    // Refresh also fails — terminal auth failure.
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Invalid refresh token' }),
    })
  })

  await page.goto('/app/founders')

  // Tokens should be cleared. ProtectedRoute should bounce to /.
  await expect.poll(
    async () => page.evaluate(() => localStorage.getItem('ff_access_token')),
    { timeout: 10_000 },
  ).toBeNull()
  await expect.poll(() => page.url(), { timeout: 5_000 }).not.toContain('/app/founders')
})
