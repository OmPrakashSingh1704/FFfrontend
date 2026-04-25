import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'

import { server } from '../../test/server'
import { DealRoomDetailPage } from '../DealRoomDetailPage'
import { AuthProvider } from '../../context/AuthContext'
import { ToastProvider } from '../../context/ToastContext'
import { setTokens } from '../../lib/tokenStorage'

vi.mock('../../components/workflow/WorkflowCanvas', () => ({
  WorkflowCanvas: (props: { nodes: Array<{ id: string; name: string }>; currentNodeId?: string | null }) => (
    <div data-testid="workflow-canvas-stub" data-current={props.currentNodeId ?? ''}>
      {props.nodes.map((n) => (
        <span key={n.id} data-testid={`canvas-node-${n.id}`}>{n.name}</span>
      ))}
    </div>
  ),
}))

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

function makeWfNode(over: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    name: 'Step',
    description: '',
    node_type: 'custom',
    status: 'pending',
    position_x: 0,
    position_y: 0,
    terminal_outcome: '',
    investor_approved: false,
    founder_approved: false,
    investor_approved_at: null,
    founder_approved_at: null,
    investor_approval_note: '',
    founder_approval_note: '',
    investor_chosen_next_node_id: null,
    founder_chosen_next_node_id: null,
    completed_at: null,
    ...over,
  }
}

const start = makeWfNode({ id: 'n0', name: 'Start', node_type: 'system_start', status: 'approved' })
const dueDiligence = makeWfNode({ id: 'n1', name: 'Due Diligence', status: 'active' })
const won = makeWfNode({ id: 'n2', name: 'Closed Won', terminal_outcome: 'won' })
const lost = makeWfNode({ id: 'n3', name: 'Closed Lost', terminal_outcome: 'lost' })

const mockWorkflow = {
  id: 1,
  nodes: [start, dueDiligence, won, lost],
  edges: [
    { id: 'e1', from_node_id: 'n0', to_node_id: 'n1', label: '', order_hint: 0 },
    { id: 'e2', from_node_id: 'n1', to_node_id: 'n2', label: 'Approve', order_hint: 0 },
    { id: 'e3', from_node_id: 'n1', to_node_id: 'n3', label: 'Reject', order_hint: 1 },
  ],
  current_node: dueDiligence,
  is_complete: false,
  created_at: '2026-01-01T00:00:00Z',
}

function renderDetail() {
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
  it('renders room header, canvas, and approval panel after load', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/room-1/`, () => HttpResponse.json(mockRoom)),
      http.get(`${API}/deals/rooms/room-1/workflow/`, () => HttpResponse.json(mockWorkflow)),
    )

    renderDetail()

    await waitFor(() => expect(screen.getByText(/Acme Corp/)).toBeInTheDocument())
    expect(screen.getByText(/Jane Investor/)).toBeInTheDocument()
    expect(screen.getByTestId('workflow-canvas-stub')).toHaveAttribute('data-current', 'n1')
    expect(screen.getByTestId('wf-approval-panel')).toBeInTheDocument()
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

  it('hides sign-NDA button when NDA is fully signed', async () => {
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

  it('renders branch radios and posts chosen_next_node_id when investor approves', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    let approveBody: { chosen_next_node_id?: string | null; approval_note?: string } | null = null
    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/room-1/`, () => HttpResponse.json(mockRoom)),
      http.get(`${API}/deals/rooms/room-1/workflow/`, () => HttpResponse.json(mockWorkflow)),
      http.post(`${API}/deals/rooms/room-1/workflow/approve/`, async ({ request }) => {
        approveBody = (await request.json()) as typeof approveBody
        return HttpResponse.json({ ok: true })
      }),
    )

    renderDetail()

    // Both edge picks appear
    await waitFor(() => expect(screen.getByTestId('wf-pick-radio-e2')).toBeInTheDocument())
    expect(screen.getByTestId('wf-pick-radio-e3')).toBeInTheDocument()

    // Approve btn disabled until pick
    expect(screen.getByTestId('wf-approve-btn')).toBeDisabled()

    fireEvent.click(screen.getByTestId('wf-pick-radio-e2'))
    fireEvent.change(screen.getByTestId('wf-note-input'), { target: { value: 'LGTM' } })
    fireEvent.click(screen.getByTestId('wf-approve-btn'))

    await waitFor(() => expect(approveBody).not.toBeNull())
    expect(approveBody).toEqual({ chosen_next_node_id: 'n2', approval_note: 'LGTM' })
  })

  it('disables approve button when room is closed', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    const closedRoom = { ...mockRoom, status: 'closed' }
    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/room-1/`, () => HttpResponse.json(closedRoom)),
      http.get(`${API}/deals/rooms/room-1/workflow/`, () => HttpResponse.json(mockWorkflow)),
    )

    renderDetail()

    await waitFor(() => expect(screen.getByTestId('wf-approve-btn')).toBeInTheDocument())
    expect(screen.getByTestId('wf-approve-btn')).toBeDisabled()
  })

  it('shows complete state when workflow is_complete', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    const completeWf = { ...mockWorkflow, current_node: null, is_complete: true }
    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/rooms/room-1/`, () => HttpResponse.json(mockRoom)),
      http.get(`${API}/deals/rooms/room-1/workflow/`, () => HttpResponse.json(completeWf)),
    )

    renderDetail()

    await waitFor(() => expect(screen.getByTestId('wf-approval-complete')).toBeInTheDocument())
  })
})
