import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { WorkflowApprovalPanel } from '../WorkflowApprovalPanel'
import type {
  DealRoomWorkflowEdge,
  DealRoomWorkflowNode,
} from '../../../types/deals'

function makeNode(overrides: Partial<DealRoomWorkflowNode> = {}): DealRoomWorkflowNode {
  return {
    id: 'n1',
    name: 'Due Diligence',
    description: '',
    node_type: 'custom',
    status: 'active',
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
    ...overrides,
  }
}

function makeEdge(overrides: Partial<DealRoomWorkflowEdge> = {}): DealRoomWorkflowEdge {
  return {
    id: 'e1',
    from_node_id: 'n1',
    to_node_id: 'n2',
    label: '',
    order_hint: 0,
    ...overrides,
  }
}

describe('WorkflowApprovalPanel', () => {
  it('shows complete state when isComplete', () => {
    render(
      <WorkflowApprovalPanel
        currentNode={null}
        outgoingEdges={[]}
        nodesById={{}}
        role="investor"
        isComplete={true}
        isClosed={false}
        onApprove={vi.fn()}
      />,
    )
    expect(screen.getByTestId('wf-approval-complete')).toBeInTheDocument()
  })

  it('shows "no active step" when currentNode is null and not complete', () => {
    render(
      <WorkflowApprovalPanel
        currentNode={null}
        outgoingEdges={[]}
        nodesById={{}}
        role="investor"
        isComplete={false}
        isClosed={false}
        onApprove={vi.fn()}
      />,
    )
    expect(screen.getByTestId('wf-approval-none')).toBeInTheDocument()
  })

  it('renders outgoing edges sorted by order_hint with radios when >1 edge', () => {
    const current = makeNode()
    const target1 = makeNode({ id: 'n2', name: 'Branch A' })
    const target2 = makeNode({ id: 'n3', name: 'Branch B' })
    const e1 = makeEdge({ id: 'eA', to_node_id: 'n2', label: 'A path', order_hint: 2 })
    const e2 = makeEdge({ id: 'eB', to_node_id: 'n3', label: 'B path', order_hint: 1 })

    render(
      <WorkflowApprovalPanel
        currentNode={current}
        outgoingEdges={[e1, e2]}
        nodesById={{ n1: current, n2: target1, n3: target2 }}
        role="investor"
        isComplete={false}
        isClosed={false}
        onApprove={vi.fn()}
      />,
    )

    // Both radios are rendered
    expect(screen.getByTestId('wf-pick-radio-eA')).toBeInTheDocument()
    expect(screen.getByTestId('wf-pick-radio-eB')).toBeInTheDocument()

    // Sorted by order_hint: B (1) appears before A (2)
    const labels = screen.getAllByTestId(/wf-edge-pick-/)
    expect(labels[0]).toHaveAttribute('data-testid', 'wf-edge-pick-eB')
    expect(labels[1]).toHaveAttribute('data-testid', 'wf-edge-pick-eA')

    // Approve button is disabled until a pick is made
    expect(screen.getByTestId('wf-approve-btn')).toBeDisabled()
  })

  it('auto-advances with single outgoing edge (no radio shown)', () => {
    const current = makeNode()
    const target = makeNode({ id: 'n2', name: 'Next' })
    const edge = makeEdge({ to_node_id: 'n2' })
    const onApprove = vi.fn()

    render(
      <WorkflowApprovalPanel
        currentNode={current}
        outgoingEdges={[edge]}
        nodesById={{ n1: current, n2: target }}
        role="investor"
        isComplete={false}
        isClosed={false}
        onApprove={onApprove}
      />,
    )

    // No radios when only 1 outgoing edge
    expect(screen.queryByTestId('wf-pick-radio-e1')).not.toBeInTheDocument()
    // Approve button is enabled because requiresPick is false
    const btn = screen.getByTestId('wf-approve-btn')
    expect(btn).not.toBeDisabled()

    fireEvent.click(btn)
    expect(onApprove).toHaveBeenCalledWith({
      chosen_next_node_id: 'n2',
      approval_note: '',
    })
  })

  it('submits chosen_next_node_id and approval_note for branched node', () => {
    const current = makeNode()
    const target1 = makeNode({ id: 'n2', name: 'Branch A' })
    const target2 = makeNode({ id: 'n3', name: 'Branch B' })
    const e1 = makeEdge({ id: 'eA', to_node_id: 'n2', order_hint: 1 })
    const e2 = makeEdge({ id: 'eB', to_node_id: 'n3', order_hint: 2 })
    const onApprove = vi.fn()

    render(
      <WorkflowApprovalPanel
        currentNode={current}
        outgoingEdges={[e1, e2]}
        nodesById={{ n1: current, n2: target1, n3: target2 }}
        role="investor"
        isComplete={false}
        isClosed={false}
        onApprove={onApprove}
      />,
    )

    fireEvent.click(screen.getByTestId('wf-pick-radio-eB'))
    fireEvent.change(screen.getByTestId('wf-note-input'), { target: { value: 'Looks good' } })
    fireEvent.click(screen.getByTestId('wf-approve-btn'))

    expect(onApprove).toHaveBeenCalledWith({
      chosen_next_node_id: 'n3',
      approval_note: 'Looks good',
    })
  })

  it('renders disagreement warning when picks differ', () => {
    const current = makeNode({
      investor_chosen_next_node_id: 'n2',
      founder_chosen_next_node_id: 'n3',
      investor_approved: true,
    })
    const target1 = makeNode({ id: 'n2', name: 'Branch A' })
    const target2 = makeNode({ id: 'n3', name: 'Branch B' })
    const e1 = makeEdge({ id: 'eA', to_node_id: 'n2' })
    const e2 = makeEdge({ id: 'eB', to_node_id: 'n3' })

    render(
      <WorkflowApprovalPanel
        currentNode={current}
        outgoingEdges={[e1, e2]}
        nodesById={{ n1: current, n2: target1, n3: target2 }}
        role="investor"
        isComplete={false}
        isClosed={false}
        onApprove={vi.fn()}
      />,
    )

    const warning = screen.getByTestId('wf-disagreement')
    expect(warning).toBeInTheDocument()
    expect(warning.textContent).toContain('Branch A')
    expect(warning.textContent).toContain('Branch B')
  })

  it('terminal node (no outgoing edges) shows terminal copy and auto-approves', () => {
    const current = makeNode({ name: 'Closed Won', terminal_outcome: 'won' })
    const onApprove = vi.fn()

    render(
      <WorkflowApprovalPanel
        currentNode={current}
        outgoingEdges={[]}
        nodesById={{ n1: current }}
        role="investor"
        isComplete={false}
        isClosed={false}
        onApprove={onApprove}
      />,
    )

    expect(screen.getByText(/terminal node/i)).toBeInTheDocument()
    const btn = screen.getByTestId('wf-approve-btn')
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onApprove).toHaveBeenCalledWith({
      chosen_next_node_id: null,
      approval_note: '',
    })
  })

  it('disables submit when isClosed regardless of pick', () => {
    const current = makeNode()
    const target = makeNode({ id: 'n2', name: 'Next' })
    const edge = makeEdge({ to_node_id: 'n2' })

    render(
      <WorkflowApprovalPanel
        currentNode={current}
        outgoingEdges={[edge]}
        nodesById={{ n1: current, n2: target }}
        role="investor"
        isComplete={false}
        isClosed={true}
        onApprove={vi.fn()}
      />,
    )

    expect(screen.getByTestId('wf-approve-btn')).toBeDisabled()
  })

  it('shows error message when provided', () => {
    const current = makeNode()
    const target = makeNode({ id: 'n2' })
    const edge = makeEdge({ to_node_id: 'n2' })

    render(
      <WorkflowApprovalPanel
        currentNode={current}
        outgoingEdges={[edge]}
        nodesById={{ n1: current, n2: target }}
        role="investor"
        isComplete={false}
        isClosed={false}
        errorMessage="Approval failed: chosen_next_node_id mismatch"
        onApprove={vi.fn()}
      />,
    )

    expect(screen.getByTestId('wf-approve-error')).toHaveTextContent('chosen_next_node_id mismatch')
  })
})
