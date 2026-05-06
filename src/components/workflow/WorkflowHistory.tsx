import { CheckCircle2 } from 'lucide-react'
import type { DealRoomWorkflowNode } from '../../types/deals'

export type WorkflowHistoryProps = {
  nodes: DealRoomWorkflowNode[]
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function approvedAt(node: DealRoomWorkflowNode): string | null {
  // Use the later of the two approval timestamps; fall back to completed_at.
  const fa = node.founder_approved_at
  const ia = node.investor_approved_at
  if (fa && ia) return new Date(fa) > new Date(ia) ? fa : ia
  return fa || ia || node.completed_at
}

export function WorkflowHistory({ nodes }: WorkflowHistoryProps) {
  const approved = nodes
    .filter((n) => n.status === 'approved' && (n.completed_at || n.founder_approved_at || n.investor_approved_at))
    .sort((a, b) => {
      const ta = approvedAt(a) || ''
      const tb = approvedAt(b) || ''
      return new Date(ta).getTime() - new Date(tb).getTime()
    })

  if (approved.length === 0) return null

  return (
    <section
      className="card"
      style={{ marginTop: '0.75rem', marginBottom: '1rem' }}
      data-testid="workflow-history"
    >
      <h3
        style={{
          fontWeight: 600,
          fontSize: '0.875rem',
          margin: 0,
          marginBottom: '0.75rem',
          color: 'hsl(var(--foreground))',
        }}
      >
        History
      </h3>
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {approved.map((node) => (
          <li
            key={node.id}
            data-testid="workflow-history-item"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              fontSize: '0.8125rem',
            }}
          >
            <CheckCircle2
              size={14}
              strokeWidth={1.5}
              style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 500 }}>{node.name}</span>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'hsl(var(--muted-foreground))',
                }}
              >
                Approved by both · {formatTimestamp(approvedAt(node))}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
