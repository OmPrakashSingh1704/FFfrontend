import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { WorkflowSettingsPage } from '../WorkflowSettingsPage'
import { AuthProvider } from '../../context/AuthContext'
import { ToastProvider } from '../../context/ToastContext'
import { setTokens } from '../../lib/tokenStorage'

const API = 'http://localhost:8000/api/v1'

const mockTemplate = {
  id: 1,
  name: 'Default Workflow',
  nodes: [
    { id: 'n1', name: 'NDA Signing', description: 'Sign NDA', order: 1, node_type: 'system' },
    { id: 'n2', name: 'Due Diligence', description: 'Review materials', order: 2, node_type: 'custom' },
  ],
  updated_at: '2026-01-01T00:00:00Z',
}

function renderPage(role: string = 'investor') {
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

    renderPage('founder')

    await waitFor(() => expect(screen.getByTestId('deals-page')).toBeInTheDocument())
  })

  it('renders workflow template for investors', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/workflow/`, () => HttpResponse.json(mockTemplate)),
    )

    renderPage('investor')

    await waitFor(() => expect(screen.getByText('Default Workflow')).toBeInTheDocument())
    expect(screen.getByText('NDA Signing')).toBeInTheDocument()
    expect(screen.getByText('Due Diligence')).toBeInTheDocument()
  })

  it('shows edit/delete controls only on custom nodes', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/workflow/`, () => HttpResponse.json(mockTemplate)),
    )

    renderPage('investor')

    await waitFor(() => expect(screen.getByText('NDA Signing')).toBeInTheDocument())

    const editBtns = screen.getAllByTestId('edit-node-btn')
    const deleteBtns = screen.getAllByTestId('delete-node-btn')

    // Only 1 custom node → 1 edit + 1 delete btn
    expect(editBtns).toHaveLength(1)
    expect(deleteBtns).toHaveLength(1)
  })

  it('opens add node form when Add Step clicked', async () => {
    setTokens({ accessToken: 'test-token', refreshToken: 'test-refresh' })

    server.use(
      http.get(`${API}/users/me/`, () =>
        HttpResponse.json({ id: '2', email: 'inv@example.com', full_name: 'Investor', role: 'investor', onboarding_completed: true }),
      ),
      http.get(`${API}/deals/workflow/`, () => HttpResponse.json(mockTemplate)),
    )

    const { getByTestId } = renderPage('investor')

    await waitFor(() => expect(getByTestId('add-node-btn')).toBeInTheDocument())
    fireEvent.click(getByTestId('add-node-btn'))

    await waitFor(() => expect(screen.getByTestId('node-name-input')).toBeInTheDocument())
    expect(screen.getByTestId('submit-node-btn')).toBeInTheDocument()
  })
})
