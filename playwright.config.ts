import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      // `channel: 'chrome'` uses the system-installed Chrome binary instead
      // of Playwright's bundled Chromium, so contributors don't have to run
      // `npx playwright install` before the e2e suite works. Falls back to
      // bundled Chromium automatically if Chrome isn't found.
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
})
