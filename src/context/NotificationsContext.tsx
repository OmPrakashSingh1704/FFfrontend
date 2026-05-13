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
import { normalizeList } from '../lib/pagination'
import { useAuth } from './AuthContext'
import type { NotificationItem } from '../types/notification'

/**
 * Why this context exists
 * -----------------------
 * Before: NotificationDropdown fetched once when opened, and `RealtimeBridge`
 * only showed a toast when a WS notification arrived. That meant the bell
 * badge never updated in real time — you had to open the dropdown to see
 * new notifications.
 *
 * Now: a single source of truth lives here. The dropdown + page subscribe
 * to it; the WS path appends new items to it. `unreadCount` is recomputed
 * on every change, so the badge updates the instant a notification lands.
 */
interface NotificationsContextValue {
  items: NotificationItem[]
  unreadCount: number
  loading: boolean
  /** Pull the latest from the backend. Call on initial mount + on tab focus. */
  refresh: () => Promise<void>
  /** Mark one notification read locally + on the backend. */
  markRead: (id: string) => Promise<void>
  /** Mark all read locally + on the backend. */
  markAllRead: () => Promise<void>
  /** Inject a notification that just arrived over WS. Dedupes on id. */
  pushRealtime: (item: NotificationItem) => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  // Track the latest unread count from the server so a fresh login starts
  // with the right badge even if the WS-pushed items are a subset of total.
  const [serverUnread, setServerUnread] = useState<number | null>(null)
  const refreshInFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (status !== 'authenticated' || refreshInFlight.current) return
    refreshInFlight.current = true
    setLoading(true)
    try {
      const [list, unreadResp] = await Promise.all([
        apiRequest<NotificationItem[] | { results: NotificationItem[] }>('/notifications/?limit=20'),
        apiRequest<{ count: number } | { unread_count: number }>('/notifications/unread-count/'),
      ])
      setItems(normalizeList(list))
      const count =
        'count' in unreadResp
          ? unreadResp.count
          : 'unread_count' in unreadResp
            ? unreadResp.unread_count
            : 0
      setServerUnread(count)
    } catch {
      /* keep stale state on failure — better than blanking the badge */
    } finally {
      setLoading(false)
      refreshInFlight.current = false
    }
  }, [status])

  // Load on auth + refresh whenever the tab becomes visible again.
  useEffect(() => {
    if (status !== 'authenticated') {
      setItems([])
      setServerUnread(null)
      return
    }
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [status, refresh])

  const pushRealtime = useCallback((incoming: NotificationItem) => {
    setItems((prev) => {
      if (prev.some((n) => n.id === incoming.id)) return prev
      return [incoming, ...prev]
    })
    // Bump the server-side unread count optimistically. Next refresh will
    // reconcile if we drifted.
    if (incoming.is_read === false || incoming.is_read === undefined) {
      setServerUnread((prev) => (prev == null ? 1 : prev + 1))
    }
  }, [])

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    setServerUnread((prev) => (prev == null ? null : Math.max(0, prev - 1)))
    try {
      await apiRequest(`/notifications/${id}/read/`, { method: 'POST' })
    } catch {
      // Re-sync to true server state on failure so UI doesn't lie.
      void refresh()
    }
  }, [refresh])

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setServerUnread(0)
    try {
      await apiRequest('/notifications/read-all/', { method: 'POST' })
    } catch {
      void refresh()
    }
  }, [refresh])

  const unreadCount = useMemo(() => {
    // Prefer server count when available — it covers notifications beyond
    // the 20 we keep in memory. Fall back to local count for fast UI.
    if (serverUnread != null) return serverUnread
    return items.filter((n) => !n.is_read).length
  }, [serverUnread, items])

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead, pushRealtime }),
    [items, unreadCount, loading, refresh, markRead, markAllRead, pushRealtime],
  )

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
