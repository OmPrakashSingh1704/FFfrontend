import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Clock, Loader2, AlertTriangle } from 'lucide-react'
import type {
  DealRoomWorkflowEdge,
  DealRoomWorkflowNode,
} from '../../types/deals'

export type ApprovalRole = 'investor' | 'founder' | null

export type ApprovalSubmit = {
  chosen_next_node_id: string | null
  approval_note: string
}

export type WorkflowApprovalPanelProps = {
  currentNode: DealRoomWorkflowNode | null
  outgoingEdges: DealRoomWorkflowEdge[]
  nodesById: Record<string, DealRoomWorkflowNode>
  role: ApprovalRole
  isComplete: boolean
  isClosed: boolean
  submitting?: boolean
  errorMessage?: string | null
  onApprove: (payload: ApprovalSubmit) => void
}

export function WorkflowApprovalPanel({
  currentNode,
  outgoingEdges,
  nodesById,
  role,
  isComplete,
  isClosed,
  submitting,
  errorMessage,
  onApprove,
}: WorkflowApprovalPanelProps) {
  const [pickId, setPickId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const sortedEdges = useMemo(
    () => [...outgoingEdges].sort((a, b) => a.order_hint - b.order_hint),
    [outgoingEdges],
  )

  // Reset pick when active node changes
  useEffect(() => {
    setPickId(null)
    setNote('')
  }, [currentNode?.id])

  if (isComplete) {
    return (
      <div className="card" data-testid="wf-approval-complete">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e', fontWeight: 600 }}>
          <CheckCircle size={16} /> Workflow complete
        </div>
      </div>
    )
  }

  if (!currentNode) {
    return (
      <div className="card" data-testid="wf-approval-none">
        <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
          No active step.
        </p>
      </div>
    )
  }

  const myApproved =
    (role === 'investor' && currentNode.investor_approved) ||
    (role === 'founder' && currentNode.founder_approved)
  const otherApproved =
    role === 'investor' ? currentNode.founder_approved : currentNode.investor_approved
  const myPick =
    role === 'investor' ? currentNode.investor_chosen_next_node_id : currentNode.founder_chosen_next_node_id
  const otherPick =
    role === 'investor' ? currentNode.founder_chosen_next_node_id : currentNode.investor_chosen_next_node_id
  const otherPickName = otherPick ? nodesById[otherPick]?.name : null
  const disagreement =
    !!myPick && !!otherPick && myPick !== otherPick

  const requiresPick = sortedEdges.length > 1
  const canSubmit =
    !isClosed && role !== null && !submitting && (!requiresPick || pickId !== null)

  const handleSubmit = () => {
    onApprove({
      chosen_next_node_id: requiresPick ? pickId : sortedEdges[0]?.to_node_id ?? null,
      approval_note: note.trim(),
    })
  }

  return (
    <div className="card" data-testid="wf-approval-panel">
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'hsl(var(--muted-foreground))' }}>
          Current step
        </span>
        <h3 style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 600 }}>{currentNode.name}</h3>
        {currentNode.description && (
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
            {currentNode.description}
          </p>
        )}
      </div>

      {disagreement && (
        <div
          data-testid="wf-disagreement"
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '0.5rem 0.75rem', borderRadius: 6,
            background: 'rgba(251, 146, 60, 0.10)',
            border: '1px solid rgba(251, 146, 60, 0.35)',
            color: '#fb923c',
            marginBottom: '0.75rem',
            fontSize: '0.75rem',
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Picks don't match. You picked <strong>{nodesById[myPick!]?.name ?? '?'}</strong>;
            other party picked <strong>{otherPickName ?? '?'}</strong>. Update your pick to advance.
          </span>
        </div>
      )}

      {sortedEdges.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
          This is a terminal node. It auto-approves.
        </p>
      ) : (
        <>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: 6 }}>
              {requiresPick ? 'Pick the next step:' : 'Next step:'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sortedEdges.map((edge) => {
                const target = nodesById[edge.to_node_id]
                const isMyPick = (pickId ?? myPick) === edge.to_node_id
                const isOtherPick = otherPick === edge.to_node_id
                return (
                  <label
                    key={edge.id}
                    data-testid={`wf-edge-pick-${edge.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '0.5rem 0.625rem', borderRadius: 6,
                      border: `1px solid ${isMyPick ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                      background: isMyPick ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                      cursor: requiresPick ? 'pointer' : 'default',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {requiresPick ? (
                      <input
                        type="radio"
                        name="wf-pick"
                        value={edge.to_node_id}
                        checked={isMyPick}
                        onChange={() => setPickId(edge.to_node_id)}
                        disabled={submitting || isClosed}
                        data-testid={`wf-pick-radio-${edge.id}`}
                      />
                    ) : (
                      <span style={{ width: 14, display: 'inline-block' }} />
                    )}
                    <span style={{ flex: 1 }}>
                      {edge.label || target?.name || 'Next'}
                      {edge.label && target && (
                        <span style={{ color: 'hsl(var(--muted-foreground))', marginLeft: 6, fontSize: '0.75rem' }}>
                          → {target.name}
                        </span>
                      )}
                    </span>
                    {isOtherPick && (
                      <span
                        style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}
                        title="Other party picked this"
                      >
                        other party's pick
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          <textarea
            data-testid="wf-note-input"
            placeholder="Optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            style={{
              width: '100%', resize: 'vertical', fontSize: '0.8125rem',
              padding: '0.5rem', borderRadius: 6, border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--muted))', color: 'inherit',
              boxSizing: 'border-box', marginBottom: '0.5rem',
            }}
          />
        </>
      )}

      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {currentNode.investor_approved ? <CheckCircle size={11} style={{ color: '#22c55e' }} /> : <Clock size={11} />} Investor
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {currentNode.founder_approved ? <CheckCircle size={11} style={{ color: '#22c55e' }} /> : <Clock size={11} />} Founder
        </span>
      </div>

      {errorMessage && (
        <div
          data-testid="wf-approve-error"
          style={{
            padding: '0.4rem 0.6rem', borderRadius: 6, marginBottom: '0.5rem',
            background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', fontSize: '0.75rem',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="button"
        className="btn-sm primary"
        data-testid="wf-approve-btn"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {submitting ? (
          <><Loader2 size={12} className="animate-spin" /> Approving...</>
        ) : myApproved ? (
          otherApproved ? 'Re-pick & Approve' : 'Update pick'
        ) : (
          'Approve & Pick'
        )}
      </button>

      {myApproved && !otherApproved && !disagreement && (
        <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', margin: '0.5rem 0 0' }}>
          You approved. Waiting for the other party.
        </p>
      )}
    </div>
  )
}
