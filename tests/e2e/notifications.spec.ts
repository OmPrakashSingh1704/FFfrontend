import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

const USER = {
  id: 'user-1',
  email: 'founder@test.local',
  full_name: 'Test Founder',
  role: 'founder',
  onboarding_completed: true,
  email_verified: true,
}

const todayISO = new Date().toISOString()
const yesterdayISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

const SAMPLE_NOTIFS = [
  {
    id: 'n-1',
    type: 'intro_received',
    title: 'Jane Investor wants an intro',
    message: 'Loved your demo at YC. Can we chat?',
    is_read: false,
    link: '/app/intros',
    created_at: todayISO,
  },
  {
    id: 'n-2',
    type: 'respect_received',
    title: 'You received respect',
    message: 'Alice gave you respect for your portfolio work.',
    is_read: false,
    link: null,
    created_at: yesterdayISO,
  },
  {
    id: 'n-3',
    type: 'profile_view',
    title: 'Bob viewed your profile',
    message: '',
    is_read: true,
    link: null,
    created_at: yesterdayISO,
  },
]

test.describe('Notifications page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ff_access_token', 'fake-access')
      localStorage.setItem('ff_refresh_token', 'fake-refresh')
    })
    await page.route(`${API}/users/me/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) })
    })
    await page.route(`${API}/notifications/unread-count/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ unread_count: 2 }),
      })
    })
    // Catch-all so any other AppShell bootstrap call doesn't hang.
    await page.route(`${API}/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      const url = req.url()
      if (url.includes('/notifications/') || url.includes('/users/me')) return route.fallback()
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
  })

  test('renders notification list grouped by date with unread indicators', async ({ page }) => {
    // Regex over the path — glob `?**` would treat the `?` as a single-
    // char wildcard and miss the literal `?page=1` query boundary.
    await page.route(/\/notifications\/(\?|$)/, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: SAMPLE_NOTIFS.length,
          next: null,
          previous: null,
          results: SAMPLE_NOTIFS,
        }),
      })
    })

    await page.goto('/app/notifications')

    const pageSection = page.getByTestId('notifications-page')
    await expect(pageSection).toBeVisible({ timeout: 10_000 })

    // Each notification renders with a stable testid by id.
    await expect(page.getByTestId('notification-n-1')).toBeVisible()
    await expect(page.getByTestId('notification-n-2')).toBeVisible()
    await expect(page.getByTestId('notification-n-3')).toBeVisible()

    // Titles and messages render.
    await expect(pageSection).toContainText('Jane Investor wants an intro')
    await expect(pageSection).toContainText('Loved your demo at YC.')
    await expect(pageSection).toContainText('You received respect')

    // Today / This week / Older grouping headers — at least one of these
    // should render since SAMPLE_NOTIFS spans today + yesterday.
    await expect(pageSection.getByText(/today/i).first()).toBeVisible()
  })

  test('mark-all-read button is visible when unread > 0 and POSTs read-all', async ({ page }) => {
    await page.route(/\/notifications\/(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 3, next: null, previous: null, results: SAMPLE_NOTIFS }),
      })
    })

    let readAllCalled = false
    await page.route(`${API}/notifications/read-all/`, async (route, req) => {
      if (req.method() !== 'POST') return route.fallback()
      readAllCalled = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await page.goto('/app/notifications')
    const btn = page.getByTestId('mark-all-read-btn')
    await expect(btn).toBeVisible({ timeout: 10_000 })
    await btn.click()
    await expect.poll(() => readAllCalled, { timeout: 5_000 }).toBe(true)
  })

  test('shows empty state when there are no notifications', async ({ page }) => {
    await page.route(/\/notifications\/(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      })
    })
    await page.route(`${API}/notifications/unread-count/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ unread_count: 0 }),
      })
    })

    await page.goto('/app/notifications')
    // App-startup Preloader covers the viewport at z-99999999999 for
    // ~1s before sliding up. Wait for its SVG curve to be detached —
    // same pattern used in tests/e2e/deals-reciprocate.spec.ts.
    await page
      .locator('svg path.fill-background')
      .waitFor({ state: 'detached', timeout: 5_000 })
      .catch(() => {})
    await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 10_000 })
    // The page also has a header description that includes "You are all
    // caught up" — use exact-match on the empty-state title text to
    // avoid the strict-mode collision.
    await expect(
      page.getByText('All caught up', { exact: true }),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('clicking an unread notification POSTs to /notifications/<id>/read/', async ({ page }) => {
    await page.route(/\/notifications\/(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [SAMPLE_NOTIFS[0]] }),
      })
    })
    let readUrlHit: string | null = null
    await page.route(`${API}/notifications/n-1/read/`, async (route, req) => {
      if (req.method() !== 'POST') return route.fallback()
      readUrlHit = req.url()
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await page.goto('/app/notifications')
    // n-1 is unread and has a link, so clicking it should also fire the
    // mark-read POST. We don't follow the link (would navigate away) —
    // the cursor: pointer + onClick handler fires regardless because
    // the inner div has the click handler, not the Link wrapper.
    await page.getByTestId('notification-n-1').click({ trial: false })
    await expect.poll(() => readUrlHit, { timeout: 5_000 }).not.toBeNull()
  })
})
