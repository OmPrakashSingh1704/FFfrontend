import { apiRequest } from './api'
import { normalizeList } from './pagination'
import type { ConnectionRequest } from '../types/connection'

/**
 * Fetch the set of user IDs the current user is already connected to
 * or has a pending outgoing request for. Used to pre-populate button state.
 */
export async function fetchConnectedUserIds(currentUserId: string): Promise<Set<string>> {
  const ids = new Set<string>()
  try {
    const [accepted, sent] = await Promise.all([
      apiRequest<ConnectionRequest[] | { results: ConnectionRequest[] }>('/connections/'),
      apiRequest<ConnectionRequest[] | { results: ConnectionRequest[] }>('/connections/sent/'),
    ])
    for (const req of normalizeList(accepted)) {
      const other = req.sender?.id === currentUserId ? req.receiver?.id : req.sender?.id
      if (other) ids.add(other)
    }
    for (const req of normalizeList(sent)) {
      if (req.receiver?.id) ids.add(req.receiver.id)
    }
  } catch {
    // non-fatal — worst case buttons show "Connect" and re-send gets a 409
  }
  return ids
}
