import { apiRequest } from './api'
import { normalizeList } from './pagination'
import type { ConnectionRequest } from '../types/connection'

/** Where the current user stands with another user. */
export type ConnectionStatus = 'accepted' | 'pending'

/**
 * Fetch the current user's connection state with every other user they
 * have a record for. Returns a Map keyed by the OTHER user's id.
 *
 *   - `accepted` → the connection request was accepted; you're connected.
 *   - `pending`  → you've sent a request that hasn't been accepted yet.
 *
 * Anyone not in the map has no active request, so the Connect button
 * should show as "Connect" (default).
 *
 * `accepted` overrides `pending` when both somehow exist — the connection
 * is live, so the pending flag is stale.
 */
export async function fetchConnectionStatuses(
  currentUserId: string,
): Promise<Map<string, ConnectionStatus>> {
  const statuses = new Map<string, ConnectionStatus>()
  try {
    const [accepted, sent] = await Promise.all([
      apiRequest<ConnectionRequest[] | { results: ConnectionRequest[] }>('/connections/'),
      apiRequest<ConnectionRequest[] | { results: ConnectionRequest[] }>('/connections/sent/'),
    ])
    // Pending first so accepted overrides it on collision.
    for (const req of normalizeList(sent)) {
      if (req.receiver?.id) statuses.set(req.receiver.id, 'pending')
    }
    for (const req of normalizeList(accepted)) {
      const other = req.sender?.id === currentUserId ? req.receiver?.id : req.sender?.id
      if (other) statuses.set(other, 'accepted')
    }
  } catch {
    // non-fatal — worst case buttons show "Connect" and re-send returns 409.
  }
  return statuses
}

/**
 * Backward-compat helper: returns the set of user IDs the current user is
 * accepted-connected with OR has a pending outgoing request for. Prefer
 * `fetchConnectionStatuses` in new code — this helper loses the distinction
 * between accepted and pending, which the UI now needs to render correctly.
 *
 * @deprecated use {@link fetchConnectionStatuses}
 */
export async function fetchConnectedUserIds(currentUserId: string): Promise<Set<string>> {
  const map = await fetchConnectionStatuses(currentUserId)
  return new Set(map.keys())
}
