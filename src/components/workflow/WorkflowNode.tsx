import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CheckCircle, Clock, Lock, Flag, Trophy, XCircle, Circle } from 'lucide-react'
import type { WorkflowNodeStatus, WorkflowNodeType, TerminalOutcome } from '../../types/deals'

export type WorkflowNodeData = {
  name: string
  description?: string
  node_type: WorkflowNodeType
  terminal_outcome: TerminalOutcome
  status?: WorkflowNodeStatus
  isCurrent?: boolean
  selected?: boolean
}

const STATUS_COLORS: Record<WorkflowNodeStatus, { bg: string; border: string; fg: string }> = {
  pending: { bg: 'hsl(var(--muted))', border: 'hsl(var(--border))', fg: 'hsl(var(--muted-foreground))' },
  active: { bg: 'hsl(var(--primary) / 0.12)', border: 'hsl(var(--primary))', fg: 'hsl(var(--primary))' },
  approved: { bg: 'rgba(34, 197, 94, 0.12)', border: '#22c55e', fg: '#22c55e' },
}

function StatusIcon({ status, nodeType, isCurrent }: { status?: WorkflowNodeStatus; nodeType: WorkflowNodeType; isCurrent?: boolean }) {
  if (status === 'approved') return <CheckCircle size={14} style={{ color: '#22c55e' }} />
  if (status === 'active' || isCurrent) return <Clock size={14} style={{ color: 'hsl(var(--primary))' }} />
  if (nodeType === 'system_start' || nodeType === 'system_end') return <Lock size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
  return <Circle size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
}

function TerminalBadge({ outcome }: { outcome: TerminalOutcome }) {
  if (!outcome) return null
  const map: Record<Exclude<TerminalOutcome, ''>, { label: string; color: string; icon: React.ReactElement }> = {
    won: { label: 'Won', color: '#22c55e', icon: <Trophy size={10} /> },
    lost: { label: 'Lost', color: '#ef4444', icon: <XCircle size={10} /> },
    abandoned: { label: 'Abandoned', color: '#a3a3a3', icon: <Flag size={10} /> },
    other: { label: 'Closed', color: 'hsl(var(--muted-foreground))', icon: <Flag size={10} /> },
  }
  const cfg = map[outcome]
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '1px 6px', borderRadius: 999,
        background: `${cfg.color}20`, color: cfg.color,
        fontSize: '0.625rem', fontWeight: 600,
      }}
    >
      {cfg.icon} {cfg.label}
    </span>
  )
}

function WorkflowNodeImpl({ data, selected }: NodeProps) {
  const d = data as unknown as WorkflowNodeData
  const status = d.status ?? 'pending'
  const colors = STATUS_COLORS[status]
  const isStart = d.node_type === 'system_start'
  const isTerminal = d.node_type === 'system_end' || !!d.terminal_outcome

  return (
    <div
      data-testid={`wf-node-${status}`}
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        background: colors.bg,
        border: `2px solid ${selected ? 'hsl(var(--primary))' : colors.border}`,
        minWidth: 160,
        maxWidth: 240,
        boxShadow: d.isCurrent ? '0 0 0 3px hsl(var(--primary) / 0.18)' : 'none',
        fontSize: '0.8125rem',
        color: 'hsl(var(--foreground))',
      }}
    >
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: 'hsl(var(--primary))', width: 8, height: 8 }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: d.description ? 4 : 0 }}>
        <StatusIcon status={status} nodeType={d.node_type} isCurrent={d.isCurrent} />
        <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.name}
        </span>
      </div>
      {d.description && (
        <div style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', marginLeft: 20, lineHeight: 1.3 }}>
          {d.description}
        </div>
      )}
      {isTerminal && (
        <div style={{ marginTop: 6, marginLeft: 20 }}>
          <TerminalBadge outcome={d.terminal_outcome} />
        </div>
      )}
      {!isTerminal && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: 'hsl(var(--primary))', width: 8, height: 8 }}
        />
      )}
    </div>
  )
}

export const WorkflowNode = memo(WorkflowNodeImpl)
