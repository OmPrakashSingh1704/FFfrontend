import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'

import { server } from '../../test/server'
import { WorkflowSettingsPage } from '../WorkflowSettingsPage'
import { AuthProvider } from '../../context/AuthContext'
import { ToastProvider } from '../../context/ToastContext'
import { setTokens } from '../../lib/tokenStorage'

// Replace the canvas with a lightweight stub so we can assert wiring without React Flow.
vi.mock('../../components/workflow/WorkflowCanvas', () => ({
  WorkflowCanvas: (props: { nodes: Array<{ id: string; name: string }>; edges: Array<{ id: string }> }) => (
    <div data-testid="workflow-canvas-stub">
      <span data-testid="canvas-node-count">{props.nodes.length}</span>
      <span data-testid="canvas-edge-count">{props.edges.length}</span>
      {props.nodes.map((n) => (
        <span key={n.id} data-testid={`canvas-node-${n.id}`}>{n.name}</span>
      ))}
    </div>
  ),
}))

const API = 'http://localhost:8000/api/v1'

const mockTemplate = {
  id: 1,
  name: 'Default Workflow',
  nodes: [
    {
      id: 'n1', name: 'Start', description: '',
      node_type: 'system_start', position_x: 0, position_y: 0, terminal_outcome: '',
    },
    {
      id: 'n2', name: 'Due Diligence', description: 'Review materials',
      node_type: 'custom', position_x: 200, position_y: 0, terminal_outcome: '',
    },
    {
      id: 'n3', name: 'Closed Won', description: '',
      node_type: 'custom', position_x: 400, position_y: 0, terminal_outcome: 'won',
    },
  ],
  edges: [
    { id: 'e1', from_node_id: 'n1', to_node_id: 'n2', label: '', order_hint: 0 },
    { id: 'e2', from_node_id: 'n2', to_node_id: 'n3', label: 'Approve', order_hint: 0 },
  ],
  updated_at: '2026-01-01T00:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/deals/workflow-settings']}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/app/deals/workflow-settings" element={<WorkflowSettingsPage />} />
            <Route path="/app/deals" element={<div data-testid="deals-page">Deals</div>} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('WorkflowSettingsPage', () => {
  it('redirects non-investors to deals page', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '1', email: 'f@example.com', full_name: 'Founder', role: 'founder', onboarding_completed: true }),
      ),
    )

    renderPage()

    await waitFor(() => expect(screen.getByTestId('deals-page')).toBeInTheDocument())
  })

  it('mounts the canvas with template nodes and edges for investors', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/workflow/`, () => HttpResponse.json(mockTemplate)),
    )

    renderPage()

    await waitFor(() => expect(screen.getByTestId('workflow-canvas-stub')).toBeInTheDocument())
    expect(screen.getByTestId('canvas-node-count')).toHaveTextContent('3')
    expect(screen.getByTestId('canvas-edge-count')).toHaveTextContent('2')
    expect(screen.getByText('Default Workflow')).toBeInTheDocument()
  })

  it('opens add node modal when Add Node clicked', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/workflow/`, () => HttpResponse.json(mockTemplate)),
    )

    renderPage()

    await waitFor(() => expect(screen.getByTestId('add-node-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('add-node-btn'))

    expect(screen.getByTestId('node-form-modal')).toBeInTheDocument()
    expect(screen.getByTestId('node-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('node-terminal-input')).toBeInTheDocument()
    expect(screen.getByTestId('submit-node-btn')).toBeInTheDocument()
  })

  it('submits validate request and renders the OK banner when graph is valid', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    let validateCalled = false
    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/workflow/`, () => HttpResponse.json(mockTemplate)),
      http.post(`${API}/deals/workflow/validate/`, () => {
        validateCalled = true
        return HttpResponse.json({ valid: true, errors: [] })
      }),
    )

    renderPage()

    await waitFor(() => expect(screen.getByTestId('validate-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('validate-btn'))

    await waitFor(() => expect(validateCalled).toBe(true))
    await waitFor(() => expect(screen.getByTestId('wf-validation-ok')).toBeInTheDocument())
  })

  it('shows the errors banner when validate returns errors', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/workflow/`, () => HttpResponse.json(mockTemplate)),
      http.post(`${API}/deals/workflow/validate/`, () =>
        HttpResponse.json({ valid: false, errors: ['Cycle detected: n2 -> n3 -> n2'] }),
      ),
    )

    renderPage()

    await waitFor(() => expect(screen.getByTestId('validate-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('validate-btn'))

    await waitFor(() => expect(screen.getByTestId('wf-validation-errors')).toBeInTheDocument())
    expect(screen.getByText(/Cycle detected/)).toBeInTheDocument()
  })
})
