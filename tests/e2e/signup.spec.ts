import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'

test.describe('Signup page — anti-abuse', () => {
  test('honeypot field is present in DOM, off-screen, and gets aria-hidden + tabindex=-1', async ({
    page,
  }) => {
    await page.goto('/signup')

    const honeypotInput = page.locator('input[name="website"]')
    await expect(honeypotInput).toHaveCount(1)
    // Critical anti-abuse properties: real users never reach this field
    // because it's keyboard-skipped and off-screen, but a form-filling bot
    // will dutifully fill it and trip the backend rule.
    await expect(honeypotInput).toHaveAttribute('tabindex', '-1')
    await expect(honeypotInput).toHaveAttribute('autocomplete', 'off')

    // The wrapping container — not the input itself — carries the
    // off-screen positioning so the label is still readable by screen
    // readers if they happen to traverse hidden DOM. Verify the visual
    // hiding is intact (position: absolute; left: -10000px).
    const wrapper = honeypotInput.locator('xpath=ancestor::div[1]')
    await expect(wrapper).toHaveAttribute('aria-hidden', 'true')
    const box = await wrapper.boundingBox()
    // boundingBox returns null for visually-hidden elements OR a box that's
    // far to the left of the viewport. Either is acceptable evidence the
    // element isn't visible to humans.
    expect(box === null || (box && box.x < -1000)).toBeTruthy()
  })

  test('signup submit sends website="" and the expected anti-abuse fields', async ({ page }) => {
    // Intercept the register POST so we can inspect the body without
    // needing a backend. We block the response so the form never tries
    // to navigate away.
    let registerBody: Record<string, unknown> | null = null
    await page.route(`${API}/users/auth/register/`, async (route, req) => {
      if (req.method() !== 'POST') return route.fallback()
      registerBody = JSON.parse(req.postData() || '{}')
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'OTP sent', pending_user_id: 'pending-1' }),
      })
    })

    await page.goto('/signup')
    await page.getByTestId('signup-name-input').fill('Test User')
    await page.getByTestId('signup-email-input').fill('test@example.com')
    await page.getByTestId('signup-password-input').fill('CorrectHorseBatteryStaple9!')
    await page.getByTestId('signup-confirm-input').fill('CorrectHorseBatteryStaple9!')
    await page.getByTestId('signup-accept-legal').check()
    await page.getByTestId('signup-form').evaluate((form: HTMLFormElement) => form.requestSubmit())

    await expect.poll(() => registerBody !== null, { timeout: 10_000 }).toBe(true)
    // Honeypot is empty (real user). Real bots would have populated it.
    expect(registerBody!.website).toBe('')
    expect(registerBody!.full_name).toBe('Test User')
    expect(registerBody!.email).toBe('test@example.com')
    // The role+legal+terms acceptance fields the form sends — these
    // names mirror the backend RegisterSerializer.
    expect(registerBody!).toHaveProperty('password')
    expect(registerBody!).toHaveProperty('password_confirm')
  })

  test('disposable-email backend rejection surfaces in the form', async ({ page }) => {
    await page.route(`${API}/users/auth/register/`, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          email: ['Please use a permanent email address — temporary/disposable inboxes are blocked.'],
        }),
      })
    })

    await page.goto('/signup')
    await page.getByTestId('signup-name-input').fill('Throwaway User')
    await page.getByTestId('signup-email-input').fill('me@mailinator.com')
    await page.getByTestId('signup-password-input').fill('CorrectHorseBatteryStaple9!')
    await page.getByTestId('signup-confirm-input').fill('CorrectHorseBatteryStaple9!')
    await page.getByTestId('signup-accept-legal').check()
    await page.getByTestId('signup-form').evaluate((form: HTMLFormElement) => form.requestSubmit())

    // The form surfaces a generic error on backend failure (the catch
    // arm in handleSubmit). The exact backend message isn't shown today
    // — that's a known UX gap worth a follow-up — but the user still
    // sees that signup failed and gets a chance to retry.
    await expect(page.getByText(/signup failed/i)).toBeVisible({ timeout: 5_000 })
  })

  test('Turnstile widget is not rendered when VITE_TURNSTILE_SITE_KEY is empty', async ({
    page,
  }) => {
    // Dev/CI runs with an empty Turnstile site key so the e2e doesn't
    // depend on Cloudflare. Confirming the captcha wrapper is absent
    // proves the conditional render works — otherwise we'd ship a broken
    // captcha widget for every reviewer who clones the repo.
    await page.goto('/signup')
    await expect(page.getByTestId('signup-form')).toBeVisible()
    await expect(page.getByTestId('signup-captcha-wrapper')).toHaveCount(0)
  })
})
