import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { DealsPage } from '../DealsPage'
import { AuthProvider } from '../../context/AuthContext'
import { ToastProvider } from '../../context/ToastContext'
import { setTokens } from '../../lib/tokenStorage'

const API = 'http://localhost:8000/api/v1'

function renderDealsPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <DealsPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('DealsPage', () => {
  it('renders empty state when no deal rooms exist', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '1', email: 'test@example.com', full_name: 'Test', role: 'founder', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/`, () => HttpResponse.json([])),
    )

    renderDealsPage()

    await waitFor(() => expect(screen.getByText(/no deal rooms yet/i)).toBeInTheDocument())
  })

  it('renders deal room cards with status badges', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '1', email: 'test@example.com', full_name: 'Test', role: 'founder', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/`, () =>
        HttpResponse.json([
          {
            id: 'room-1',
            startup_name: 'Acme Corp',
            investor_name: 'Jane Investor',
            status: 'active',
            nda_signed_by_founder: true,
            nda_signed_by_investor: false,
            nda_fully_signed: false,
            document_count: 3,
            created_at: '2026-01-01T00:00:00Z',
          },
        ]),
      ),
    )

    renderDealsPage()

    await waitFor(() => expect(screen.getByTestId('deal-room-card')).toBeInTheDocument())
    expect(screen.getByText(/acme corp/i)).toBeInTheDocument()
    expect(screen.getByText(/jane investor/i)).toBeInTheDocument()
    expect(screen.getByText(/3 document/i)).toBeInTheDocument()
    expect(screen.getByTestId('view-details-link')).toBeInTheDocument()
  })

  it('renders paginated response (results wrapper)', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '1', email: 'test@example.com', full_name: 'Test', role: 'founder', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/`, () =>
        HttpResponse.json({
          results: [
            {
              id: 'room-2',
              startup_name: 'Beta Startup',
              investor_name: 'Bob Capital',
              status: 'pending_nda',
              nda_signed_by_founder: false,
              nda_signed_by_investor: false,
              nda_fully_signed: false,
              document_count: 0,
              created_at: '2026-02-01T00:00:00Z',
            },
          ],
        }),
      ),
    )

    renderDealsPage()

    await waitFor(() => expect(screen.getByText(/beta startup/i)).toBeInTheDocument())
    expect(screen.getByText(/0 documents/i)).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '1', email: 'test@example.com', full_name: 'Test', role: 'founder', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/`, async () => {
        await new Promise(r => setTimeout(r, 100))
        return HttpResponse.json([])
      }),
    )

    renderDealsPage()
    expect(screen.getByText(/loading deal rooms/i)).toBeInTheDocument()
  })
})
