import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiRequest } from '../lib/api'
import { useAuth } from './AuthContext'
import { useNotifications } from './NotificationsContext'

/**
 * Total unread chat messages across all conversations.
 *
 * Why a context: the sidebar Chat tab needs the count, and the chat page
 * needs to trigger a refresh after marking a conversation read. A single
 * source of truth keeps them in sync without prop-drilling.
 *
 * Update triggers:
 *   1. Initial fetch on auth change.
 *   2. Tab visibility → refetch (catches messages that arrived while away).
 *   3. New chat-typed notification in NotificationsContext → refetch (the
 *      WS event lands in notifications first; we piggyback on that signal
 *      so we don't need a second WS listener).
 *   4. Manual `refresh()` — called by ChatPage after a read-ack.
 *
 * The backend endpoint is a single SUM(unread_count) over the user's
 * conversation participations — cheap to call as often as we need.
 */
interface ChatUnreadContextValue {
  count: number
  /** Force a refetch — call after read-acks or any other event that
   *  changes the backend state in a way WS won't push to us. */
  refresh: () => Promise<void>
}

const ChatUnreadContext = createContext<ChatUnreadContextValue | null>(null)

const CHAT_NOTIFICATION_TYPES = new Set(['chat_message', 'chat_mention', 'group_invite'])

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const { items: notificationItems } = useNotifications()
  const [count, setCount] = useState(0)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (status !== 'authenticated' || inFlight.current) return
    inFlight.current = true
    try {
      const res = await apiRequest<{ unread_count: number }>('/chat/unread-count/')
      setCount(res.unread_count ?? 0)
    } catch {
      /* keep stale value — better than showing 0 when there are unreads */
    } finally {
      inFlight.current = false
    }
  }, [status])

  // Initial fetch + tab focus refresh
  useEffect(() => {
    if (status !== 'authenticated') {
      setCount(0)
      return
    }
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [status, refresh])

  // Refetch whenever a new chat-typed notification lands. Compare against
  // the most recent id we've seen so an unrelated notification arrival
  // (e.g. an intro accepted) doesn't cause a wasted refetch.
  const lastSeenChatId = useRef<string | null>(null)
  useEffect(() => {
    const latestChat = notificationItems.find((n) => n.type && CHAT_NOTIFICATION_TYPES.has(n.type))
    if (!latestChat) return
    if (latestChat.id === lastSeenChatId.current) return
    lastSeenChatId.current = latestChat.id
    // Skip the very first run (we already fetched on mount).
    if (count === 0 && !latestChat.is_read) {
      // Could be the initial load picking up an existing unread —
      // refresh() handles it idempotently.
      void refresh()
    } else {
      void refresh()
    }
  }, [notificationItems, refresh, count])

  const value = useMemo(() => ({ count, refresh }), [count, refresh])

  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>
}

export function useChatUnread(): ChatUnreadContextValue {
  const ctx = useContext(ChatUnreadContext)
  if (!ctx) throw new Error('useChatUnread must be used within ChatUnreadProvider')
  return ctx
}
