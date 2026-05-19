import { describe, expect, it } from 'vitest'
import {
  INITIAL_STATE,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_TIMEOUT_MS,
  iceStateReducer,
  type IceMachineState,
} from '../iceStateMachine'

const NOW = 1_700_000_000_000

describe('iceStateReducer', () => {
  it('starts connected', () => {
    expect(INITIAL_STATE).toEqual({ status: 'connected' })
  })

  it('connected + disconnected → reconnecting attempt 1', () => {
    const next = iceStateReducer(
      { status: 'connected' },
      { type: 'state', value: 'disconnected', now: NOW },
    )
    expect(next).toEqual({ status: 'reconnecting', attempt: 1, startedAt: NOW })
  })

  it('connected + failed → reconnecting attempt 1', () => {
    const next = iceStateReducer(
      { status: 'connected' },
      { type: 'state', value: 'failed', now: NOW },
    )
    expect(next.status).toBe('reconnecting')
  })

  it('reconnecting + connected → connected (recovered)', () => {
    const prev: IceMachineState = { status: 'reconnecting', attempt: 1, startedAt: NOW }
    const next = iceStateReducer(prev, { type: 'state', value: 'connected', now: NOW + 1_000 })
    expect(next).toEqual({ status: 'connected' })
  })

  it('reconnecting + completed → connected (ICE checking succeeded)', () => {
    const prev: IceMachineState = { status: 'reconnecting', attempt: 2, startedAt: NOW }
    const next = iceStateReducer(prev, { type: 'state', value: 'completed', now: NOW + 2_000 })
    expect(next).toEqual({ status: 'connected' })
  })

  it('reconnecting attempt 1 + failed → reconnecting attempt 2', () => {
    const prev: IceMachineState = { status: 'reconnecting', attempt: 1, startedAt: NOW }
    const next = iceStateReducer(prev, { type: 'state', value: 'failed', now: NOW + 3_000 })
    expect(next).toMatchObject({ status: 'reconnecting', attempt: 2, startedAt: NOW })
  })

  it('reconnecting at max attempts + failed → failed', () => {
    const prev: IceMachineState = {
      status: 'reconnecting',
      attempt: MAX_RECONNECT_ATTEMPTS,
      startedAt: NOW,
    }
    const next = iceStateReducer(prev, { type: 'state', value: 'failed', now: NOW + 5_000 })
    expect(next).toEqual({ status: 'failed' })
  })

  it('reconnecting + 30s timeout tick → failed', () => {
    const prev: IceMachineState = { status: 'reconnecting', attempt: 1, startedAt: NOW }
    const next = iceStateReducer(prev, { type: 'tick', now: NOW + RECONNECT_TIMEOUT_MS })
    expect(next).toEqual({ status: 'failed' })
  })

  it('reconnecting + tick before timeout → no transition', () => {
    const prev: IceMachineState = { status: 'reconnecting', attempt: 1, startedAt: NOW }
    const next = iceStateReducer(prev, { type: 'tick', now: NOW + 5_000 })
    expect(next).toBe(prev) // referential equality — no change
  })

  it('closed from any state is terminal failure', () => {
    expect(
      iceStateReducer(
        { status: 'connected' },
        { type: 'state', value: 'closed', now: NOW },
      ),
    ).toEqual({ status: 'failed' })

    expect(
      iceStateReducer(
        { status: 'reconnecting', attempt: 1, startedAt: NOW },
        { type: 'state', value: 'closed', now: NOW },
      ),
    ).toEqual({ status: 'failed' })
  })

  it('failed is absorbing — no transitions out', () => {
    const prev: IceMachineState = { status: 'failed' }
    expect(
      iceStateReducer(prev, { type: 'state', value: 'connected', now: NOW }),
    ).toBe(prev)
    expect(iceStateReducer(prev, { type: 'tick', now: NOW + 999_999 })).toBe(prev)
  })

  it('connected + checking → no-op (still connected)', () => {
    // Browser may briefly report 'checking' during normal operation.
    // We only react to disconnected/failed.
    const prev: IceMachineState = { status: 'connected' }
    expect(
      iceStateReducer(prev, { type: 'state', value: 'checking', now: NOW }),
    ).toBe(prev)
  })
})
