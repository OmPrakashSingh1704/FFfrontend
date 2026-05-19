import { Loader2 } from 'lucide-react'
import { useCall } from '../context/CallContext'

/**
 * Reconnecting overlay for active calls.
 *
 * Renders when iceConnectionState transitions to disconnected/failed and
 * we're attempting recovery. The user sees:
 *
 *     ┌─────────────────────────────┐
 *     │     [spinner 24px]          │
 *     │     Reconnecting...         │
 *     │     Attempt 2 of 3          │
 *     │     [End call]              │
 *     └─────────────────────────────┘
 *
 * Per DESIGN.md / docs/designs/cross-network-calling.md: no gradient
 * backdrop, no large bubbly radius, no emoji. Solid backdrop, 8px radius,
 * lucide spinner.
 *
 * The End button always works — even mid-reconnect — so users aren't
 * trapped in a frozen call.
 */
export function CallReconnectingOverlay() {
  const { iceState, endCall, maxReconnectAttempts } = useCall()

  if (iceState.status !== 'reconnecting') return null

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      data-testid="call-reconnecting-overlay"
    >
      <div
        style={{
          width: 'min(90vw, 320px)',
          padding: '1.5rem',
          background: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          textAlign: 'center',
        }}
      >
        <Loader2
          size={24}
          strokeWidth={1.75}
          style={{ animation: 'spin 1s linear infinite' }}
          aria-hidden
        />
        <div style={{ fontSize: '1rem', fontWeight: 600 }}>Reconnecting...</div>
        <div
          style={{
            fontSize: '0.8125rem',
            fontWeight: 400,
            opacity: 0.7,
          }}
        >
          Attempt {iceState.attempt} of {maxReconnectAttempts}
        </div>
        <button
          type="button"
          className="btn ghost btn-sm"
          onClick={() => {
            void endCall()
          }}
          autoFocus
          style={{ marginTop: '0.5rem' }}
          data-testid="call-reconnecting-end"
        >
          End call
        </button>
      </div>
    </div>
  )
}
