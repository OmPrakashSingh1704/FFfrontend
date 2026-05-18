import { test, expect } from '@playwright/test'

// Verify the skeleton screens shipped earlier this session actually render
// while the underlying API is in flight. We mock the endpoints to never
// resolve, then assert the skeleton stays visible — proving that:
//   (a) the page mounts the skeleton during loading (not a blank screen)
//   (b) the skeleton is correctly gated on the same `loading` state that
//       the eventual content waits on
// We don't assert against the post-load render — that's covered by each
// page's own tests. This is a focused regression net for the skeleton
// feature itself.

const API = 'http://localhost:8000/api/v1'

const USER = {
  id: 'user-1',
  email: 'founder@test.local',
  full_name: 'Test Founder',
  role: 'founder',
  onboarding_completed: true,
  email_verified: true,
}

test.describe('Skeleton screens render while data is loading', () => {
  test.beforeEach(async ({ page }) => {
    // Pre-auth so /app/* routes are reachable. Same pattern the deals
    // e2e uses — see tests/e2e/deals-reciprocate.spec.ts for the rationale.
    await page.addInitScript(() => {
      localStorage.setItem('ff_access_token', 'fake-access')
      localStorage.setItem('ff_refresh_token', 'fake-refresh')
    })
    // Catch-all empty payloads for any unmocked GET so the page doesn't
    // throw on unrelated bootstrap calls. Registered FIRST so per-test
    // specific routes registered later take LIFO priority.
    await page.route(`${API}/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      const url = req.url()
      if (url.includes('/users/me')) return route.fallback()
      // Specific endpoints we want to stall stay un-mocked here so the
      // per-test route handler picks them up.
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/users/me/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) })
    })
  })

  test('feed shows skeleton while /feed/ is in flight', async ({ page }) => {
    // Intentionally never resolves — keeps `loading` true so the
    // skeleton stays mounted for the assertion.
    await page.route(`${API}/feed/**`, () => {
      // never call route.fulfill() — Playwright leaves the request
      // hanging until the page navigates away. The component sees an
      // in-flight fetch and renders its skeleton.
    })

    await page.goto('/app/feed')
    // FeedListSkeleton sets data-testid="feed-skeleton" on the
    // outer SkeletonList wrapper.
    await expect(page.getByTestId('feed-skeleton')).toBeVisible({ timeout: 10_000 })
  })

  test('founders list shows skeleton grid while /founders/ is in flight', async ({ page }) => {
    await page.route(`${API}/founders/**`, () => {
      /* never resolves */
    })
    await page.goto('/app/founders')
    await expect(page.getByTestId('profile-grid-skeleton')).toBeVisible({ timeout: 10_000 })
  })

  test('dashboard shows stat-card skeletons while /trust/ + /intros/ are in flight', async ({
    page,
  }) => {
    await page.route(`${API}/trust/**`, () => {
      /* never resolves */
    })
    await page.route(`${API}/intros/**`, () => {
      /* never resolves */
    })
    await page.route(`${API}/respects/**`, () => {
      /* never resolves */
    })
    await page.goto('/app')
    // Dashboard uses StatCardSkeleton wrapped in a div with the
    // dashboard-stats-loading testid (added when the markdown chat
    // bubble bug was fixed earlier this session — see Dashboard.tsx).
    await expect(page.getByTestId('dashboard-stats-loading')).toBeVisible({ timeout: 10_000 })
  })

  test('aria-busy=true is set on at least one loading region (a11y)', async ({ page }) => {
    // Generic check that skeletons declare themselves to assistive tech.
    // Any of the *List skeleton components wrap their content in
    // role="status" aria-busy="true" — see components/ui/skeleton.tsx.
    await page.route(`${API}/founders/**`, () => {
      /* never resolves */
    })
    await page.goto('/app/founders')
    const busyRegion = page.locator('[aria-busy="true"]').first()
    await expect(busyRegion).toBeVisible({ timeout: 10_000 })
  })
})
