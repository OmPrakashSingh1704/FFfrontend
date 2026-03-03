import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { RespectPage } from '../RespectPage'
import { ToastProvider } from '../../context/ToastContext'
import { setTokens } from '../../lib/tokenStorage'

const API = 'http://localhost:8000/api/v1'

function renderRespectPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <RespectPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

const receivedRespects = [
  {
    id: 'r1',
    from_user: { id: 'u1', full_name: 'Alice Investor' },
    reason: 'Great product demo',
    created_at: '2025-01-10T00:00:00Z',
    expires_at: '2025-04-10T00:00:00Z',
  },
  {
    id: 'r2',
    from_user: { id: 'u2', full_name: 'Bob Founder' },
    reason: '',
    created_at: '2025-01-15T00:00:00Z',
    expires_at: '2025-04-15T00:00:00Z',
  },
]

const givenRespects = [
  {
    id: 'r3',
    to_user: { id: 'u3', full_name: 'Charlie VC' },
    reason: 'Insightful advice',
    created_at: '2025-01-12T00:00:00Z',
    expires_at: '2025-04-12T00:00:00Z',
  },
]

describe('RespectPage', () => {
  it('renders received and given respect counts', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/respects/received/`, () => HttpResponse.json(receivedRespects)),
      http.get(`${API}/respects/given/`, () => HttpResponse.json(givenRespects)),
    )

    renderRespectPage()

    await waitFor(() => {
      expect(screen.getByTestId('respect-received-card')).toBeInTheDocument()
    })

    // Received count
    expect(screen.getByTestId('respect-received-card')).toHaveTextContent('2')
    expect(screen.getByText('Alice Investor')).toBeInTheDocument()
    expect(screen.getByText(/Great product demo/)).toBeInTheDocument()

    // Given count
    expect(screen.getByTestId('respect-given-card')).toHaveTextContent('1')
    expect(screen.getByText('Charlie VC')).toBeInTheDocument()
    expect(screen.getByText(/Insightful advice/)).toBeInTheDocument()
  })

  it('shows empty messages when no respect data', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/respects/received/`, () => HttpResponse.json([])),
      http.get(`${API}/respects/given/`, () => HttpResponse.json([])),
    )

    renderRespectPage()

    await waitFor(() => {
      expect(screen.getByText('No respect received yet.')).toBeInTheDocument()
    })

    expect(screen.getByText("You haven't given any respect yet.")).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/respects/received/`, () => HttpResponse.error()),
      http.get(`${API}/respects/given/`, () => HttpResponse.error()),
    )

    renderRespectPage()

    await waitFor(() => {
      expect(screen.getByText('Unable to load respect data.')).toBeInTheDocument()
    })
  })

  it('opens give respect form', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/respects/received/`, () => HttpResponse.json([])),
      http.get(`${API}/respects/given/`, () => HttpResponse.json([])),
    )

    renderRespectPage()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByTestId('give-respect-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('give-respect-btn'))

    expect(screen.getByTestId('give-respect-form')).toBeInTheDocument()
    expect(screen.getByTestId('user-search-input')).toBeInTheDocument()
    expect(screen.getByTestId('respect-reason-input')).toBeInTheDocument()
    expect(screen.getByTestId('submit-respect-btn')).toBeDisabled()
  })

  it('searches users and selects one', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/respects/received/`, () => HttpResponse.json([])),
      http.get(`${API}/respects/given/`, () => HttpResponse.json([])),
      http.get(`${API}/search/users/`, () =>
        HttpResponse.json([
          { id: 'u5', full_name: 'Diana Smith', role: 'founder' },
          { id: 'u6', full_name: 'Eve Johnson', role: 'investor' },
        ]),
      ),
    )

    renderRespectPage()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByTestId('give-respect-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('give-respect-btn'))
    await user.type(screen.getByTestId('user-search-input'), 'Diana')

    await waitFor(() => {
      expect(screen.getByTestId('user-search-results')).toBeInTheDocument()
    })

    const options = screen.getAllByTestId('user-search-option')
    expect(options).toHaveLength(2)

    await user.click(options[0])

    expect(screen.getByText(/Selected: Diana Smith/)).toBeInTheDocument()
    expect(screen.getByTestId('submit-respect-btn')).not.toBeDisabled()
  })
})
