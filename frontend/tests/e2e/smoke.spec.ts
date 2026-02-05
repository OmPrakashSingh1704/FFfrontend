import { test, expect } from '@playwright/test'

test('landing page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('FoundersLib')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
})

test('login flow (requires env credentials)', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  test.skip(!email || !password, 'Provide E2E_USER_EMAIL and E2E_USER_PASSWORD to run login test.')

  await page.goto('/login')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByText('Dashboard')).toBeVisible()
})
