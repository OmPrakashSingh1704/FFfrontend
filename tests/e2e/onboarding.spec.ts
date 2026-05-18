import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

// Covers the signup → email verification handshake. The full onboarding
// loop (profile setup, role-specific steps) lives on /onboarding and is
// covered separately; this spec proves the boundary between auth and the
// app is wired correctly end-to-end.

test.describe('Signup → email verification flow', () => {
  test('completes signup, navigates to verify-email, submits OTP, and lands in /app', async ({ page }) => {
    // The full happy path uses three backend calls:
    //   1) POST /users/auth/register/   → returns pending_user_id; client
    //                                     stashes email/password in
    //                                     sessionStorage and pushes to
    //                                     /verify-email
    //   2) POST /users/auth/verify-email/ → confirms OTP, returns tokens
    //   3) GET  /users/me/              → AuthProvider bootstrap; flips
    //                                     ProtectedRoute to authenticated
    let registerCalled = false
    let verifyBody: Record<string, unknown> | null = null

    await page.route(`${API}/users/auth/register/`, async (route, req) => {
      if (req.method() !== 'POST') return route.fallback()
      registerCalled = true
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'OTP sent to your email.', pending_user_id: 'pending-1' }),
      })
    })
    await page.route(`${API}/users/auth/verify-email/`, async (route, req) => {
      if (req.method() !== 'POST') return route.fallback()
      verifyBody = JSON.parse(req.postData() || '{}')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access: 'access-token',
          refresh: 'refresh-token',
          user: {
            id: 'user-1',
            email: 'newuser@example.com',
            full_name: 'New User',
            role: 'founder',
            onboarding_completed: true,
            email_verified: true,
          },
        }),
      })
    })
    // Some flows call /users/auth/login/ post-verify to refresh tokens.
    // Keep it satisfied just in case.
    await page.route(`${API}/users/auth/login/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access: 'access-token', refresh: 'refresh-token' }),
      })
    })
    await page.route(`${API}/users/me/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'newuser@example.com',
          full_name: 'New User',
          role: 'founder',
          onboarding_completed: true,
          email_verified: true,
        }),
      })
    })
    // Catch-all for whatever the dashboard fetches on mount so the page
    // doesn't hang waiting on unmocked endpoints.
    await page.route(`${API}/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    // --- Step 1: fill and submit the signup form ---
    await page.goto('/signup')
    await page.getByTestId('signup-name-input').fill('New User')
    await page.getByTestId('signup-email-input').fill('newuser@example.com')
    await page.getByTestId('signup-password-input').fill('CorrectHorseBatteryStaple9!')
    await page.getByTestId('signup-confirm-input').fill('CorrectHorseBatteryStaple9!')
    await page.getByTestId('signup-accept-legal').check()
    await page.getByTestId('signup-form').evaluate((form: HTMLFormElement) => form.requestSubmit())

    // Should navigate to /verify-email with state.email set.
    await page.waitForURL('**/verify-email', { timeout: 10_000 })
    expect(registerCalled).toBe(true)
    await expect(page.getByTestId('verify-email-form')).toBeVisible()

    // --- Step 2: type the OTP and submit ---
    // OTP is a row of 6 single-digit inputs that auto-advance. Filling
    // them individually mirrors how a real user would type it.
    const digits = ['1', '2', '3', '4', '5', '6']
    const otpInputs = page.getByTestId('otp-input').locator('input')
    for (let i = 0; i < digits.length; i++) {
      await otpInputs.nth(i).fill(digits[i])
    }
    await page.getByTestId('verify-submit-btn').click()

    // Verify the body matches what the backend expects.
    await expect.poll(() => verifyBody !== null, { timeout: 5_000 }).toBe(true)
    expect(verifyBody!.code).toBe('123456')
    expect(verifyBody!.email).toBe('newuser@example.com')

    // --- Step 3: ProtectedRoute should let us into /app/* ---
    // Different builds may land on /app, /app/onboarding, or whatever
    // post-signup destination is configured. We don't pin the exact
    // route — just assert we're no longer on /verify-email and the
    // ProtectedRoute didn't bounce us to /.
    await expect.poll(() => page.url(), { timeout: 10_000 }).not.toContain('/verify-email')
    await expect.poll(() => page.url(), { timeout: 5_000 }).not.toMatch(/\/$/)
  })
})
