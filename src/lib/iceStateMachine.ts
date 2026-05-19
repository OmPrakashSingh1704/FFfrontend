/**
 * Pure state machine for WebRTC ICE reconnect logic.
 *
 * Why this exists as a pure module instead of inline in CallContext:
 *
 *   - Reconnect logic involves 3 retry attempts + a 30s timeout. Inlining it
 *     as nested if/else inside CallContext means every future bug fix has
 *     to read 50+ lines to find the relevant branch.
 *   - As a pure reducer, this is fully unit-testable with no React, no
 *     RTCPeerConnection, no timers. Drives all the transitions in
 *     `iceStateMachine.test.ts`.
 *   - The React side stays small: useReducer here + a useEffect that fires
 *     pc.restartIce() / endCall() in response to state changes.
 *
 * State transitions:
 *
 *     connected ──('disconnected')──▶ reconnecting{1}
 *     connected ──('failed')───────▶ reconnecting{1}
 *     reconnecting{n} ──('connected')──▶ connected           (recovered)
 *     reconnecting{n} ──('failed')──▶ reconnecting{n+1}       (n < 3)
 *     reconnecting{3} ──('failed')──▶ failed
 *     reconnecting{n} ──(tick, 30s elapsed)──▶ failed         (giveup)
 *     any ──('closed')──▶ failed                              (terminal)
 */

export type IceMachineState =
  | { status: 'connected' }
  | { status: 'reconnecting'; attempt: number; startedAt: number }
  | { status: 'failed' }

export type IceEvent =
  | { type: 'state'; value: RTCIceConnectionState; now: number }
  | { type: 'tick'; now: number }

export const MAX_RECONNECT_ATTEMPTS = 3
export const RECONNECT_TIMEOUT_MS = 30_000

export const INITIAL_STATE: IceMachineState = { status: 'connected' }

export function iceStateReducer(prev: IceMachineState, event: IceEvent): IceMachineState {
  // 'closed' is terminal from any state. The PC is dead; no recovery.
  if (event.type === 'state' && event.value === 'closed') {
    return { status: 'failed' }
  }

  switch (prev.status) {
    case 'connected': {
      if (event.type === 'state') {
        if (event.value === 'disconnected' || event.value === 'failed') {
          return { status: 'reconnecting', attempt: 1, startedAt: event.now }
        }
      }
      return prev
    }

    case 'reconnecting': {
      if (event.type === 'state') {
        if (event.value === 'connected' || event.value === 'completed') {
          // ICE recovered. Back to connected.
          return { status: 'connected' }
        }
        if (event.value === 'failed' || event.value === 'disconnected') {
          // Bump attempt counter. If we've used all attempts, give up.
          // Otherwise stay in reconnecting; the effect layer will call
          // pc.restartIce() on the new state.
          if (prev.attempt >= MAX_RECONNECT_ATTEMPTS) {
            return { status: 'failed' }
          }
          return {
            status: 'reconnecting',
            attempt: prev.attempt + 1,
            startedAt: prev.startedAt,
          }
        }
        // 'checking' / 'new' / etc — stay in reconnecting, no-op.
        return prev
      }
      // Timer tick: if we've been reconnecting for 30s, give up regardless
      // of attempt count. Some networks oscillate disconnected ↔ checking
      // forever without ever bumping the attempt counter.
      if (event.now - prev.startedAt >= RECONNECT_TIMEOUT_MS) {
        return { status: 'failed' }
      }
      return prev
    }

    case 'failed':
      // Terminal — no transitions out. Caller must reset by creating a new
      // peer connection.
      return prev
  }
}
