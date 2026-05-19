/**
 * Pre-call connection status indicator.
 *
 * Shows the result of the TURN reachability probe with an icon + label.
 * No color-only signaling — every state has explicit text so the design
 * is colorblind-safe (per DESIGN.md a11y baseline).
 */
import { CheckCircle2, Loader2, AlertTriangle, AlertCircle } from 'lucide-react'

export type ConnectionState = 'loading' | 'good' | 'partial' | 'error'

export type ConnectionStatusProps = {
  state: ConnectionState
  message?: string
  onRetry?: () => void
}

const STATE_TO_LABEL: Record<ConnectionState, string> = {
  loading: 'Testing connection...',
  good: 'Connection: Good',
  partial: 'Connection: STUN only — calls may not work across networks',
  error: 'Connection: TURN unreachable',
}

export function ConnectionStatus({ state, message, onRetry }: ConnectionStatusProps) {
  const Icon =
    state === 'loading' ? Loader2 : state === 'good' ? CheckCircle2 : state === 'partial' ? AlertTriangle : AlertCircle
  const label = message ?? STATE_TO_LABEL[state]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem',
      }}
      data-testid={`connection-status-${state}`}
    >
      <Icon
        size={16}
        strokeWidth={1.5}
        style={state === 'loading' ? { animation: 'spin 1s linear infinite' } : undefined}
        aria-hidden
      />
      <span>{label}</span>
      {state === 'error' && onRetry ? (
        <button
          type="button"
          className="btn ghost btn-sm"
          onClick={onRetry}
          style={{ marginLeft: 'auto' }}
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}
