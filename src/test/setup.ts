import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './server'

vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000/api/v1')
vi.stubEnv('VITE_API_USE_COOKIES', 'false')

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  localStorage.clear()
})
afterAll(() => server.close())
