import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  TrendingUp,
  Clock,
  Handshake,
  PhoneCall,
  PhoneMissed,
  Users,
  Star,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useToast } from '../context/ToastContext'
import type { NotificationItem } from '../types/notification'

const PAGE_SIZE = 30

type PaginatedResponse = { count: number; next: string | null; previous: string | null; results: NotificationItem[] }

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

type IconEntry = { icon: typeof Bell; color: string }

const TYPE_ICON: Record<string, IconEntry> = {
  chat_message:            { icon: MessageSquare, color: '#3b82f6' },
  chat_mention:            { icon: MessageSquare, color: '#8b5cf6' },
  group_invite:            { icon: Users,         color: '#3b82f6' },
  intro_received:          { icon: UserPlus,      color: '#10b981' },
  intro_accepted:          { icon: UserPlus,      color: '#10b981' },
  intro_declined:          { icon: UserPlus,      color: '#ef4444' },
  respect_received:        { icon: Heart,         color: '#ec4899' },
  league_promoted:         { icon: Star,          color: '#f59e0b' },
  credits_earned:          { icon: DollarSign,    color: '#f59e0b' },
  opportunity_match:       { icon: TrendingUp,    color: '#06b6d4' },
  profile_view:            { icon: Info,          color: '#6b7280' },
  investor_verified:       { icon: Shield,        color: '#10b981' },
  verification_submitted:  { icon: Shield,        color: '#f59e0b' },
  verification_approved:   { icon: Shield,        color: '#10b981' },
  verification_rejected:   { icon: Shield,        color: '#ef4444' },
  application_status:      { icon: DollarSign,    color: '#f59e0b' },
  interest_expressed:      { icon: Handshake,     color: '#8b5cf6' },
  deal_room_created:       { icon: Handshake,     color: '#10b981' },
  nda_signed:              { icon: Shield,        color: '#06b6d4' },
  join_request_received:   { icon: UserPlus,      color: '#f59e0b' },
  join_request_approved:   { icon: UserPlus,      color: '#10b981' },
  join_request_rejected:   { icon: UserPlus,      color: '#ef4444' },
  fund_expiring:           { icon: Clock,         color: '#ef4444' },
  benefit_expiring:        { icon: Clock,         color: '#f59e0b' },
  call_invite:             { icon: PhoneCall,     color: '#10b981' },
  call_missed:             { icon: PhoneMissed,   color: '#ef4444' },
  system:                  { icon: Info,          color: '#6b7280' },
}

function NotificationIcon({ type }: { type?: string }) {
  const entry = type ? TYPE_ICON[type] : undefined
  const Icon = entry?.icon ?? Bell
  const color = entry?.color ?? 'hsl(var(--muted-foreground))'
  return <Icon style={{ width: '1rem', height: '1rem', strokeWidth: 1.5, color }} />
}

const GROUP_ORDER: ('Today' | 'This week' | 'Older')[] = ['Today', 'This week', 'Older']

export function NotificationsPage() {
  const { pushToast } = useToast()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [listData, unreadData] = await Promise.all([
          apiRequest<PaginatedResponse>(`/notifications/?page=${page}&page_size=${PAGE_SIZE}`),
          apiRequest<{ unread_count: number }>('/notifications/unread-count/'),
        ])
        if (!cancelled) {
          setItems(listData.results ?? [])
          setTotalCount(listData.count ?? 0)
          setUnread(unreadData.unread_count ?? 0)
        }
      } catch {
        if (!cancelled) setError('Unable to load notifications.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const loadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const data = await apiRequest<PaginatedResponse>(`/notifications/?page=${nextPage}&page_size=${PAGE_SIZE}`)
      setItems((prev) => [...prev, ...(data.results ?? [])])
      setPage(nextPage)
    } catch {
      pushToast('Failed to load more notifications.', 'error')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleMarkAllRead = async () => {
    if (markingAll) return
    setMarkingAll(true)
    try {
      await apiRequest('/notifications/read-all/', { method: 'POST' })
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })))
      setUnread(0)
      pushToast('All notifications marked as read.', 'success')
    } catch {
      pushToast('Unable to mark notifications as read.', 'error')
    } finally {
      setMarkingAll(false)
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read/`, { method: 'POST' })
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, is_read: true } : item))
      setUnread((prev) => Math.max(0, (prev ?? 1) - 1))
    } catch {
      // silent
    }
  }

  const grouped = items.reduce<Record<string, NotificationItem[]>>((acc, item) => {
    const group = dateGroup(item.created_at)
    if (!acc[group]) acc[group] = []
    acc[group].push(item)
    return acc
  }, {})

  const hasMore = items.length < totalCount

  return (
    <section data-testid="notifications-page" style={{ maxWidth: '42rem', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Notifications
            {totalCount > 0 && (
              <span className="badge info" style={{ marginLeft: '0.5rem', verticalAlign: 'middle', fontSize: '0.8125rem' }}>{totalCount}</span>
            )}
          </h1>
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

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '3rem 0', color: 'hsl(var(--muted-foreground))' }}>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading notifications...</span>
        </div>
      )}

      {error && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#ef4444', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        items.length === 0 ? (
          <div className="empty-state">
            <Bell className="empty-icon" />
            <div className="empty-title">All caught up</div>
            <div className="empty-description">No notifications yet. We'll let you know when something happens.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
                <div key={group} className="section" style={{ marginBottom: 0 }}>
                  <div className="section-label">{group}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {grouped[group].map((item) => {
                      const isUnread = item.is_read === false
                      const inner = (
                        <div
                          className="list-item"
                          data-testid={`notification-${item.id}`}
                          style={{
                            borderLeft: isUnread ? '2px solid var(--gold)' : '2px solid transparent',
                            background: isUnread ? 'hsl(var(--muted) / 0.3)' : undefined,
                            cursor: item.link ? 'pointer' : 'default',
                          }}
                          onClick={() => { if (isUnread) void handleMarkRead(item.id) }}
                        >
                          <div className="avatar" style={{ width: '2rem', height: '2rem', flexShrink: 0 }}>
                            <NotificationIcon type={item.type} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.875rem', fontWeight: isUnread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.title ?? 'Notification'}
                              </span>
                              {isUnread && <span className="status-dot busy" style={{ flexShrink: 0 }} />}
                            </div>
                            {item.message && (
                              <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', margin: '0.125rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.message}
                              </p>
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {relativeTime(item.created_at)}
                          </span>
                        </div>
                      )

                      return item.link ? (
                        <Link key={item.id} to={item.link} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                          {inner}
                        </Link>
                      ) : (
                        <div key={item.id}>{inner}</div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button className="btn-sm ghost" onClick={() => void loadMore()} disabled={loadingMore} data-testid="load-more-btn">
                  {loadingMore ? <><Loader2 size={14} className="animate-spin" /> Loading...</> : 'Load more'}
                </button>
              </div>
            )}
          </>
        )
      )}
    </section>
  )
}
