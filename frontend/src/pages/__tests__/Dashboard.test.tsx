import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { Dashboard } from '../Dashboard'
import { AuthProvider } from '../../context/AuthContext'
import { ToastProvider } from '../../context/ToastContext'
import { setTokens } from '../../lib/tokenStorage'

const API = 'http://localhost:8000/api/v1'

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Dashboard />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  it('renders welcome section and stats for a founder', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({
          id: '1',
          email: 'test@example.com',
          full_name: 'Jane Founder',
          role: 'founder',
          onboarding_completed: true,
        }),
      ),
      http.get(`${API}/trust/status/`, () =>
        HttpResponse.json({
          league: 'Growth',
          credits: 42,
          intro_requests_this_month: 3,
          intro_limit: 10,
          remaining_intros: 7,
          cooldown_until: null,
          is_in_cooldown: false,
          cooldown_seconds_remaining: 0,
          current_threshold: 50,
          next_league: 'Scale',
          next_league_threshold: 100,
          points_to_next_league: 58,
        }),
      ),
      http.get(`${API}/respects/received/`, () =>
        HttpResponse.json([
          { id: 'r1', from_user: { id: 'u1', full_name: 'Bob' }, reason: 'Great pitch', created_at: '2025-01-01', expires_at: '2025-04-01' },
        ]),
      ),
      http.get(`${API}/intros/sent/`, () =>
        HttpResponse.json([
          { id: 'i1', status: 'pending', startup_name: 'MyStartup', created_at: '2025-01-01', expires_at: '2025-02-01' },
          { id: 'i2', status: 'accepted', startup_name: 'MyStartup', created_at: '2025-01-02', expires_at: '2025-02-02' },
        ]),
      ),
    )

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    // Stats should eventually load
    await waitFor(() => {
      expect(screen.getByText('Growth')).toBeInTheDocument()
    })

    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // intros sent count
    expect(screen.getByText('1')).toBeInTheDocument() // respect count

    // Quick actions and browse sections
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument()
    expect(screen.getByTestId('browse-links')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({
          id: '1',
          email: 'test@example.com',
          full_name: 'Jane',
          role: 'founder',
          onboarding_completed: true,
        }),
      ),
      http.get(`${API}/trust/status/`, () => new Promise(() => {})), // never resolves
      http.get(`${API}/respects/received/`, () => new Promise(() => {})),
      http.get(`${API}/intros/sent/`, () => new Promise(() => {})),
    )

    renderDashboard()

    expect(screen.getByText('Loading stats...')).toBeInTheDocument()
  })

  it('shows fallback when API fails', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({
          id: '1',
          email: 'test@example.com',
          full_name: 'Jane',
          role: 'founder',
          onboarding_completed: true,
        }),
      ),
      http.get(`${API}/trust/status/`, () => HttpResponse.error()),
      http.get(`${API}/respects/received/`, () => HttpResponse.error()),
      http.get(`${API}/intros/sent/`, () => HttpResponse.error()),
    )

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Unable to load stats.')).toBeInTheDocument()
    })
  })
})
