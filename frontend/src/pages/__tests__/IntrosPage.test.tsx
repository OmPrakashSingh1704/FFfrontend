import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { IntrosPage } from '../IntrosPage'
import { ToastProvider } from '../../context/ToastContext'
import { setTokens } from '../../lib/tokenStorage'

const API = 'http://localhost:8000/api/v1'

function renderIntrosPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <IntrosPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

const sentIntros = [
  {
    id: 'i1',
    founder_user: { id: 'u1', full_name: 'Jane Founder' },
    investor_profile: { id: 'inv1', display_name: 'Bob Investor' },
    startup: 's1',
    startup_name: 'AcmeCo',
    startup_tagline: 'Building the future',
    startup_industry: 'Fintech',
    pitch_summary: 'We are building a next-gen payments platform.',
    relevance_justification: 'Fintech focus match',
    deck_url: null,
    additional_notes: '',
    status: 'pending',
    responded_at: null,
    investor_response_message: '',
    credits_spent: 5,
    created_at: '2025-01-15T00:00:00Z',
    expires_at: '2025-02-14T00:00:00Z',
  },
]

const receivedIntros = [
  {
    id: 'i2',
    founder_user: { id: 'u2', full_name: 'Alice Founder' },
    investor_profile: { id: 'inv2', display_name: 'Me Investor' },
    startup: 's2',
    startup_name: 'BetaCorp',
    startup_tagline: 'AI for everyone',
    startup_industry: 'AI/ML',
    pitch_summary: 'Using ML to automate customer support.',
    relevance_justification: 'AI vertical match',
    deck_url: 'https://example.com/deck.pdf',
    additional_notes: 'Very promising team',
    status: 'pending',
    responded_at: null,
    investor_response_message: '',
    credits_spent: 3,
    created_at: '2025-01-20T00:00:00Z',
    expires_at: '2025-02-19T00:00:00Z',
  },
]

describe('IntrosPage', () => {
  it('renders sent intros by default', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/intros/sent/`, () => HttpResponse.json(sentIntros)),
    )

    renderIntrosPage()

    await waitFor(() => {
      expect(screen.getByText(/AcmeCo/)).toBeInTheDocument()
    })

    expect(screen.getByText(/Bob Investor/)).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
    expect(screen.getByText('5 credits')).toBeInTheDocument()
    expect(screen.getByTestId('request-intro-btn')).toBeInTheDocument()
  })

  it('switches to received tab and shows respond buttons', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/intros/sent/`, () => HttpResponse.json(sentIntros)),
      http.get(`${API}/intros/received/`, () => HttpResponse.json(receivedIntros)),
    )

    renderIntrosPage()
    const user = userEvent.setup()

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/AcmeCo/)).toBeInTheDocument()
    })

    // Switch to received tab
    await user.click(screen.getByTestId('tab-received'))

    await waitFor(() => {
      expect(screen.getByText(/Alice Founder/)).toBeInTheDocument()
    })

    expect(screen.getByText(/BetaCorp/)).toBeInTheDocument()
    expect(screen.getByTestId('deck-link')).toBeInTheDocument()
    expect(screen.getByTestId('accept-btn')).toBeInTheDocument()
    expect(screen.getByTestId('decline-btn')).toBeInTheDocument()
  })

  it('shows empty state when no intros', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/intros/sent/`, () => HttpResponse.json([])),
    )

    renderIntrosPage()

    await waitFor(() => {
      expect(screen.getByTestId('empty-intros')).toBeInTheDocument()
    })

    expect(screen.getByText('No intros yet')).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/intros/sent/`, () => HttpResponse.error()),
    )

    renderIntrosPage()

    await waitFor(() => {
      expect(screen.getByText('Unable to load intro requests.')).toBeInTheDocument()
    })
  })

  it('opens create form and loads options', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/intros/sent/`, () => HttpResponse.json(sentIntros)),
      http.get(`${API}/founders/my-startups/`, () =>
        HttpResponse.json([
          { id: 's1', name: 'AcmeCo', slug: 'acmeco' },
        ]),
      ),
      http.get(`${API}/investors/`, () =>
        HttpResponse.json([
          { id: 'inv1', display_name: 'Bob Investor', fund_name: 'Big Fund' },
        ]),
      ),
    )

    renderIntrosPage()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByTestId('request-intro-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('request-intro-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('create-intro-form')).toBeInTheDocument()
    })

    // Dropdowns should eventually have options
    await waitFor(() => {
      expect(screen.getAllByText('AcmeCo').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText('Bob Investor (Big Fund)').length).toBeGreaterThanOrEqual(1)
  })
})
