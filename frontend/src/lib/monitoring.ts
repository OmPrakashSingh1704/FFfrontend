import * as Sentry from '@sentry/react'

const captureConsoleErrors = (enabled: boolean) => {
  if (!enabled) return

  const originalError = console.error
  console.error = (...args: unknown[]) => {
    originalError(...args)
    const message = args
      .map((arg) => {
        if (typeof arg === 'string') return arg
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      })
      .join(' ')
    Sentry.captureMessage(message || 'console.error', 'error')
  }
}

export const initMonitoring = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

  if (!dsn) {
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
  })

  captureConsoleErrors(import.meta.env.VITE_CAPTURE_CONSOLE_ERRORS === 'true')
}
