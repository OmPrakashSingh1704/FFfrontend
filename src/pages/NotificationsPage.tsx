import { useEffect, useState } from 'react'
import {
  Bell,
  MessageSquare,
  UserPlus,
  Heart,
  DollarSign,
  Shield,
  Info,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import { useToast } from '../context/ToastContext'
import type { NotificationItem } from '../types/notification'

function relativeTime(dateStr?: string): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function dateGroup(dateStr?: string): 'Today' | 'This week' | 'Older' {
  if (!dateStr) return 'Older'
  const now = new Date()
  const then = new Date(dateStr)

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (then >= todayStart) return 'Today'

  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)
  if (then >= weekStart) return 'This week'

  return 'Older'
}

function notificationIcon(type?: string) {
  const iconStyle = { width: '1rem', height: '1rem', strokeWidth: 1.5 }
  switch (type) {
    case 'message':
    case 'chat':
      return <MessageSquare style={iconStyle} />
    case 'connection':
    case 'follow':
    case 'introduction':
      return <UserPlus style={iconStyle} />
    case 'like':
    case 'respect':
      return <Heart style={iconStyle} />
    case 'funding':
    case 'application':
    case 'investment':
      return <DollarSign style={iconStyle} />
    case 'trust':
    case 'verification':
      return <Shield style={iconStyle} />
    case 'system':
    case 'platform':
      return <Info style={iconStyle} />
    default:
      return <Bell style={iconStyle} />
  }
}

const GROUP_ORDER: ('Today' | 'This week' | 'Older')[] = ['Today', 'This week', 'Older']

export function NotificationsPage() {
  const { pushToast } = useToast()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

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

  const handleMarkAllRead = async () => {
    if (markingAll) return
    setMarkingAll(true)
    try {
      await apiRequest('/notifications/mark-all-read/', { method: 'POST' })
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })))
      setUnread(0)
      pushToast('All notifications marked as read.', 'success')
    } catch {
      pushToast('Unable to mark notifications as read.', 'error')
    } finally {
      setMarkingAll(false)
    }
  }

  const grouped = items.reduce<Record<string, NotificationItem[]>>((acc, item) => {
    const group = dateGroup(item.created_at)
    if (!acc[group]) acc[group] = []
    acc[group].push(item)
    return acc
  }, {})

  return (
    <section data-testid="notifications-page" style={{ maxWidth: '42rem', margin: '0 auto' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-description">
            {unread !== null && unread > 0
              ? `${unread} unread notification${unread === 1 ? '' : 's'}`
              : 'You are all caught up'}
          </p>
        </div>
        {unread !== null && unread > 0 && (
          <button
            type="button"
            className="btn-sm primary"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            data-testid="mark-all-read-btn"
          >
            <CheckCircle2 style={{ width: '0.875rem', height: '0.875rem', strokeWidth: 1.5 }} />
            {markingAll ? 'Marking...' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '3rem 0', color: 'hsl(var(--muted-foreground))' }}>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading notifications...</span>
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#ef4444', fontSize: '0.875rem' }}>
          {error}
        </div>
      ) : null}

      {/* Content */}
      {!loading && !error ? (
        items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Bell />
            </div>
            <div className="empty-title">All caught up</div>
            <div className="empty-description">
              You have no notifications at the moment. We will let you know when something important happens.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
              <div key={group} className="section" style={{ marginBottom: 0 }}>
                <div className="section-label">{group}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {grouped[group].map((item) => {
                    const isUnread = item.is_read === false
                    return (
                      <div
                        key={item.id}
                        className="list-item"
                        data-testid={`notification-${item.id}`}
                        style={{
                          borderLeft: isUnread ? '2px solid var(--gold)' : '2px solid transparent',
                          background: isUnread ? 'hsl(var(--muted) / 0.3)' : undefined,
                        }}
                      >
                        {/* Icon */}
                        <div
                          className="avatar"
                          style={{
                            width: '2rem',
                            height: '2rem',
                            flexShrink: 0,
                          }}
                        >
                          {notificationIcon(item.notification_type)}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.875rem',
                                fontWeight: isUnread ? 600 : 400,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.title ?? 'Notification'}
                            </span>
                            {isUnread && (
                              <span
                                className="status-dot busy"
                                style={{ flexShrink: 0 }}
                              />
                            )}
                          </div>
                          {item.message && (
                            <p
                              style={{
                                fontSize: '0.8125rem',
                                color: 'hsl(var(--muted-foreground))',
                                margin: '0.125rem 0 0',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.message}
                            </p>
                          )}
                        </div>

                        {/* Timestamp */}
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'hsl(var(--muted-foreground))',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {relativeTime(item.created_at)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  )
}
