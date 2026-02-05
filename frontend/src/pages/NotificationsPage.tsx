import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { NotificationItem } from '../types/notification'

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [listData, unreadData] = await Promise.all([
          apiRequest<NotificationItem[] | { results: NotificationItem[] }>('/notifications/'),
          apiRequest<{ count: number } | { unread_count: number }>('/notifications/unread-count/'),
        ])
        if (!cancelled) {
          setItems(normalizeList(listData))
          const count = 'count' in unreadData ? unreadData.count : unreadData.unread_count
          setUnread(count ?? 0)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load notifications.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Notifications</h1>
          <p>Unread: {unread ?? '—'}</p>
        </div>
      </header>

      {loading ? <div className="page-loader">Loading notifications...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Bell className="w-8 h-8" />
            </div>
            <h3>All caught up</h3>
            <p>You have no notifications at the moment. We'll let you know when something important happens.</p>
          </div>
        ) : (
          <div className="feed-list">
            {items.map((item) => (
              <article key={item.id} className="feed-card">
                <div className="feed-meta">
                  <span className="data-eyebrow">{item.notification_type ?? 'Notification'}</span>
                  <span>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</span>
                </div>
                <h3>{item.title ?? 'Update'}</h3>
                <p>{item.message ?? ''}</p>
                <div className="data-meta">
                  <span>{item.is_read ? 'Read' : 'Unread'}</span>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}
    </section>
  )
}
