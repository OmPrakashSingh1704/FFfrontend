import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { DealRoomDetailPage } from '../DealRoomDetailPage'
import { AuthProvider } from '../../context/AuthContext'
import { ToastProvider } from '../../context/ToastContext'
import { setTokens } from '../../lib/tokenStorage'

const API = 'http://localhost:8000/api/v1'

const mockRoom = {
  id: 'room-1',
  startup: { id: 's1', name: 'Acme Corp' },
  investor: { id: 'i1', display_name: 'Jane Investor' },
  status: 'active',
  nda_signed_by_founder: false,
  nda_signed_by_investor: false,
  nda_fully_signed: false,
  founder_signed_at: null,
  investor_signed_at: null,
  close_reason: null,
  closed_at: null,
  documents: [],
  created_at: '2026-01-01T00:00:00Z',
}

const mockWorkflow = {
  id: 1,
  nodes: [
    {
      id: 'node-1',
      name: 'NDA Signing',
      description: 'Sign the NDA',
      order: 1,
      node_type: 'system',
      status: 'pending',
      investor_approved: false,
      founder_approved: false,
      investor_approved_at: null,
      founder_approved_at: null,
      completed_at: null,
    },
    {
      id: 'node-2',
      name: 'Due Diligence',
      description: 'Review the materials',
      order: 2,
      node_type: 'custom',
      status: 'pending',
      investor_approved: false,
      founder_approved: false,
      investor_approved_at: null,
      founder_approved_at: null,
      completed_at: null,
    },
  ],
  current_node: null,
  is_complete: false,
  created_at: '2026-01-01T00:00:00Z',
}

function renderDetail(role: string = 'founder') {
  return render(
    <MemoryRouter initialEntries={['/app/deals/room-1']}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/app/deals/:id" element={<DealRoomDetailPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('DealRoomDetailPage', () => {
  it('renders room details after loading', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '1', email: 'test@example.com', full_name: 'Founder', role: 'founder', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/room-1/`, () => HttpResponse.json(mockRoom)),
      http.get(`${API}/deals/rooms/room-1/workflow/`, () => HttpResponse.json(mockWorkflow)),
    )

    renderDetail()

    await waitFor(() => expect(screen.getByText(/Acme Corp/)).toBeInTheDocument())
    expect(screen.getByText(/Jane Investor/)).toBeInTheDocument()
    expect(screen.getByText('NDA Signing')).toBeInTheDocument()
    expect(screen.getByText('Due Diligence')).toBeInTheDocument()
  })

  it('shows NDA section for non-signed NDA', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '1', email: 'test@example.com', full_name: 'Founder', role: 'founder', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/room-1/`, () => HttpResponse.json(mockRoom)),
      http.get(`${API}/deals/rooms/room-1/workflow/`, () => HttpResponse.json(mockWorkflow)),
    )

    renderDetail()

    await waitFor(() => expect(screen.getByTestId('sign-nda-btn')).toBeInTheDocument())
  })

  it('hides sign NDA button when NDA fully signed', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    const signedRoom = { ...mockRoom, nda_signed_by_founder: true, nda_signed_by_investor: true, nda_fully_signed: true }

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '1', email: 'test@example.com', full_name: 'Founder', role: 'founder', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/room-1/`, () => HttpResponse.json(signedRoom)),
      http.get(`${API}/deals/rooms/room-1/workflow/`, () => HttpResponse.json(mockWorkflow)),
    )

    renderDetail()

    await waitFor(() => expect(screen.queryByTestId('sign-nda-btn')).not.toBeInTheDocument())
  })

  it('shows approve button for investor on eligible custom node', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    const workflowWithCurrentCustom = {
      ...mockWorkflow,
      current_node: mockWorkflow.nodes[1],
    }

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/room-1/`, () => HttpResponse.json(mockRoom)),
      http.get(`${API}/deals/rooms/room-1/workflow/`, () => HttpResponse.json(workflowWithCurrentCustom)),
    )

    renderDetail()

    await waitFor(() => expect(screen.getByTestId('approve-btn')).toBeInTheDocument())
  })

  it('hides approve button for closed room', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    const closedRoom = { ...mockRoom, status: 'closed' }
    const workflowWithCurrent = { ...mockWorkflow, current_node: mockWorkflow.nodes[1] }

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/room-1/`, () => HttpResponse.json(closedRoom)),
      http.get(`${API}/deals/rooms/room-1/workflow/`, () => HttpResponse.json(workflowWithCurrent)),
    )

    renderDetail()

    await waitFor(() => expect(screen.queryByTestId('approve-btn')).not.toBeInTheDocument())
  })
})
