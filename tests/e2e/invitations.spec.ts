import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

const USER = {
  id: 'user-1',
  email: 'me@test.local',
  full_name: 'Test User',
  role: 'founder',
  onboarding_completed: true,
  email_verified: true,
}

// Lightweight fixture rows shared across tests so each test only
// re-routes what it actually cares about.
const PENDING_INV_IN = {
  id: 'inv-in-1',
  startup_id: 'startup-1',
  startup_name: 'Acme Robotics',
  inviter_name: 'Jane Founder',
  inviter_email: 'jane@acme.example',
  role: 'employee',
  status: 'pending',
  message: 'Would love to have you on the team.',
  is_expired: false,
  created_at: '2026-05-18T12:00:00Z',
}

const PENDING_REQ_OUT = {
  id: 'req-out-1',
  startup_id: 'startup-7',
  startup_name: 'Beta Labs',
  role: 'employee',
  status: 'pending',
  message: 'Excited about your robotics work.',
  created_at: '2026-05-18T12:00:00Z',
}

const PENDING_INV_OUT = {
  id: 'inv-out-1',
  startup_id: 'startup-9',
  startup_name: 'Mine Inc',
  inviter_name: 'Test User',
  invitee_name: 'Alice Newcomer',
  invitee_email: 'alice@new.example',
  role: 'co_founder',
  status: 'pending',
  message: 'You would be a great co-founder.',
  is_expired: false,
  created_at: '2026-05-18T12:00:00Z',
}

const PENDING_REQ_IN = {
  id: 'req-in-1',
  startup_id: 'startup-9',
  startup_name: 'Mine Inc',
  requester_name: 'Bob Asker',
  requester_email: 'bob@asker.example',
  role: 'employee',
  status: 'pending',
  message: 'I want to help build this.',
  created_at: '2026-05-18T12:00:00Z',
}

test.describe('Invitations page — Sent / Received / Verdict tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ff_access_token', 'fake-access')
      localStorage.setItem('ff_refresh_token', 'fake-refresh')
    })
    await page.route(`${API}/users/me/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) })
    })
    // Catch-all for unmocked GETs. Registered FIRST so per-test routes
    // (registered later) win via LIFO matching.
    await page.route(`${API}/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      const url = req.url()
      if (
        url.includes('/users/me') ||
        url.includes('/founders/invitations') ||
        url.includes('/founders/my-join-requests') ||
        url.includes('/founders/sent-invitations') ||
        url.includes('/founders/incoming-join-requests')
      ) return route.fallback()
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
  })

  test('Received tab mixes incoming invitations + join requests to my startups', async ({ page }) => {
    await page.route(`${API}/founders/invitations/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      const isAll = req.url().includes('status=all')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isAll ? [PENDING_INV_IN] : [PENDING_INV_IN]),
      })
    })
    await page.route(`${API}/founders/my-join-requests/**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/founders/sent-invitations/**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/founders/incoming-join-requests/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      const isAll = req.url().includes('status=all')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isAll ? [PENDING_REQ_IN] : [PENDING_REQ_IN]),
      })
    })

    await page.goto('/app/invitations')
    await page
      .locator('svg path.fill-background')
      .waitFor({ state: 'detached', timeout: 5_000 })
      .catch(() => {})
    await expect(page.getByTestId('invitations-page')).toBeVisible({ timeout: 10_000 })

    // Received is the default landing tab.
    await expect(page.getByTestId('tab-received')).toHaveAttribute('aria-selected', 'true')

    // Both incoming row types render in the Received tab.
    await expect(page.getByTestId(`row-invitation-in-${PENDING_INV_IN.id}`)).toBeVisible()
    await expect(page.getByTestId(`row-request-in-${PENDING_REQ_IN.id}`)).toBeVisible()
    await page.screenshot({ path: 'tests/e2e/screenshots/invitations-received.png', fullPage: false })
    // Invitation row exposes Accept + Decline; join-request row exposes
    // inline Approve + Reject (replaced the deep-link to the retired
    // StartupDetailPage so founders can act from here directly).
    await expect(page.getByTestId(`invitation-accept-${PENDING_INV_IN.id}`)).toBeVisible()
    await expect(page.getByTestId(`review-request-approve-${PENDING_REQ_IN.id}`)).toBeVisible()
    await expect(page.getByTestId(`review-request-reject-${PENDING_REQ_IN.id}`)).toBeVisible()
  })

  test('Approve on a join-request POSTs the review endpoint and removes the row', async ({ page }) => {
    await page.route(`${API}/founders/invitations/**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/founders/my-join-requests/**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/founders/sent-invitations/**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/founders/incoming-join-requests/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([PENDING_REQ_IN]),
      })
    })

    let reviewBody: Record<string, unknown> | null = null
    await page.route(
      `${API}/founders/startups/${PENDING_REQ_IN.startup_id}/join-requests/${PENDING_REQ_IN.id}/review/`,
      async (route, req) => {
        if (req.method() !== 'POST') return route.fallback()
        reviewBody = JSON.parse(req.postData() || '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Approved' }),
        })
      },
    )

    await page.goto('/app/invitations')
    await page
      .locator('svg path.fill-background')
      .waitFor({ state: 'detached', timeout: 5_000 })
      .catch(() => {})
    await page.getByTestId(`review-request-approve-${PENDING_REQ_IN.id}`).click()

    // POST body uses the role the requester asked for + empty title.
    await expect.poll(() => reviewBody !== null, { timeout: 5_000 }).toBe(true)
    expect(reviewBody).toEqual({
      action: 'approve',
      role: PENDING_REQ_IN.role,
      title: '',
    })
    // Row is removed locally on success.
    await expect(page.getByTestId(`row-request-in-${PENDING_REQ_IN.id}`)).toHaveCount(0)
  })

  test('Sent tab mixes invitations I sent + join requests I sent', async ({ page }) => {
    await page.route(`${API}/founders/invitations/**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/founders/my-join-requests/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([PENDING_REQ_OUT]),
      })
    })
    await page.route(`${API}/founders/sent-invitations/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([PENDING_INV_OUT]),
      })
    })
    await page.route(`${API}/founders/incoming-join-requests/**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.goto('/app/invitations')
    await page
      .locator('svg path.fill-background')
      .waitFor({ state: 'detached', timeout: 5_000 })
      .catch(() => {})
    await page.getByTestId('tab-sent').click()

    // Both outgoing kinds visible — invitation-out (Cancel action) and
    // request-out (Withdraw action). Each row has its own discriminated
    // testid so a wholesale tab regression can't false-pass.
    await expect(page.getByTestId(`row-invitation-out-${PENDING_INV_OUT.id}`)).toBeVisible()
    await expect(page.getByTestId(`row-request-out-${PENDING_REQ_OUT.id}`)).toBeVisible()
    await page.screenshot({ path: 'tests/e2e/screenshots/invitations-sent.png', fullPage: false })
    await expect(page.getByTestId(`sent-invitation-cancel-${PENDING_INV_OUT.id}`)).toBeVisible()
    await expect(page.getByTestId(`join-request-withdraw-${PENDING_REQ_OUT.id}`)).toBeVisible()
  })

  test('Verdict tab shows only non-pending rows from all four sources', async ({ page }) => {
    // For ?status=pending requests return empty — there's nothing to act
    // on. For ?status=all return a mix of decided and pending records;
    // the component should keep only the decided ones in the Verdict tab.
    await page.route(`${API}/founders/invitations/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      const isAll = req.url().includes('status=all')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isAll
          ? [{ ...PENDING_INV_IN, id: 'inv-in-acc', status: 'accepted' }, { ...PENDING_INV_IN, id: 'inv-in-pending', status: 'pending' }]
          : []),
      })
    })
    await page.route(`${API}/founders/my-join-requests/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      const isAll = req.url().includes('status=all')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isAll
          ? [{ ...PENDING_REQ_OUT, id: 'req-out-rej', status: 'rejected' }]
          : []),
      })
    })
    await page.route(`${API}/founders/sent-invitations/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      const isAll = req.url().includes('status=all')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isAll
          ? [{ ...PENDING_INV_OUT, id: 'inv-out-can', status: 'cancelled' }]
          : []),
      })
    })
    await page.route(`${API}/founders/incoming-join-requests/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      const isAll = req.url().includes('status=all')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isAll
          ? [{ ...PENDING_REQ_IN, id: 'req-in-app', status: 'approved' }]
          : []),
      })
    })

    await page.goto('/app/invitations')
    await page
      .locator('svg path.fill-background')
      .waitFor({ state: 'detached', timeout: 5_000 })
      .catch(() => {})
    await page.getByTestId('tab-verdict').click()

    // All four decided rows from the ?status=all responses should be
    // present; the lone pending row (inv-in-pending) must be filtered
    // out client-side.
    await expect(page.getByTestId('row-invitation-in-inv-in-acc')).toBeVisible()
    await expect(page.getByTestId('row-request-out-req-out-rej')).toBeVisible()
    await expect(page.getByTestId('row-invitation-out-inv-out-can')).toBeVisible()
    await expect(page.getByTestId('row-request-in-req-in-app')).toBeVisible()
    await page.screenshot({ path: 'tests/e2e/screenshots/invitations-verdict.png', fullPage: false })
    await expect(page.getByTestId('row-invitation-in-inv-in-pending')).toHaveCount(0)
  })

  test('empty states render when every source is empty', async ({ page }) => {
    for (const path of [
      'invitations',
      'my-join-requests',
      'sent-invitations',
      'incoming-join-requests',
    ]) {
      await page.route(`${API}/founders/${path}/**`, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      })
    }

    await page.goto('/app/invitations')
    await page
      .locator('svg path.fill-background')
      .waitFor({ state: 'detached', timeout: 5_000 })
      .catch(() => {})
    await expect(page.getByTestId('invitations-page')).toBeVisible({ timeout: 10_000 })

    await expect(page.getByTestId('received-empty')).toBeVisible()
    await page.getByTestId('tab-sent').click()
    await expect(page.getByTestId('sent-empty')).toBeVisible()
    await page.getByTestId('tab-verdict').click()
    await expect(page.getByTestId('verdict-empty')).toBeVisible()
  })
})
