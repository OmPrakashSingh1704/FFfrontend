import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import {
  Shield,
  Star,
  Users,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
} from 'lucide-react'

type TrustStatus = {
  league?: string
  credits?: number
  intro_requests_this_month?: number
  intro_limit?: number
  cooldown_until?: string | null
  onboarding_completed?: boolean
  next_league_threshold?: number | null
}

type CreditEvent = {
  id: string
  amount?: number
  reason?: string
  created_at?: string
}

export function TrustPage() {
  const [status, setStatus] = useState<TrustStatus | null>(null)
  const [events, setEvents] = useState<CreditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [statusData, historyData] = await Promise.all([
          apiRequest<TrustStatus>('/trust/status/'),
          apiRequest<CreditEvent[] | { results: CreditEvent[] }>('/trust/credit-history/'),
        ])
        if (!cancelled) {
          setStatus(statusData)
          setEvents(normalizeList(historyData))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load trust status.')
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
    <div style={{ padding: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Trust & Credits</h1>
          <p className="page-description">Track your league, credits, and reputation signals.</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="empty-state">
          <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite' }} />
          <p className="empty-description">Loading trust status...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card" style={{ borderColor: '#ef4444', marginBottom: '1.5rem' }}>
          <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stats Grid */}
          <div className="grid-3 section">
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">League</span>
                <div className="stat-icon">
                  <Shield style={{ width: 20, height: 20 }} strokeWidth={1.5} />
                </div>
              </div>
              <span className="stat-value" style={{ textTransform: 'capitalize' }}>
                {status?.league ?? '\u2014'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                Next threshold: {status?.next_league_threshold ?? '\u2014'}
              </span>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Credits</span>
                <div className="stat-icon">
                  <Star style={{ width: 20, height: 20 }} strokeWidth={1.5} />
                </div>
              </div>
              <span className="stat-value">
                {status?.credits ?? 0}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                Intro limit: {status?.intro_limit ?? '\u2014'}
              </span>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Intro Usage</span>
                <div className="stat-icon">
                  <Users style={{ width: 20, height: 20 }} strokeWidth={1.5} />
                </div>
              </div>
              <span className="stat-value">
                {status?.intro_requests_this_month ?? 0}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                Cooldown: {status?.cooldown_until ? new Date(status.cooldown_until).toLocaleDateString() : '\u2014'}
              </span>
            </div>
          </div>

          {/* Credit History Timeline */}
          <div className="card section">
            <div className="card-header">
              <span className="card-title">
                <Clock style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} strokeWidth={1.5} />
                Credit History
              </span>
              <span className="badge info">{events.length} events</span>
            </div>

            {events.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 0' }}>
                <Clock className="empty-icon" />
                <h3 className="empty-title">No credit history</h3>
                <p className="empty-description">Credit events will appear here as you use the platform.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {events.map((event, index) => {
                  const amount = event.amount ?? 0
                  const isPositive = amount > 0
                  const isNegative = amount < 0
                  const isLast = index === events.length - 1

                  return (
                    <div
                      key={event.id}
                      className="list-item"
                      style={{
                        cursor: 'default',
                        borderBottom: !isLast ? '1px solid hsl(var(--border) / 0.5)' : undefined,
                        borderRadius: 0,
                        paddingLeft: '1rem',
                        paddingRight: '1rem',
                      }}
                    >
                      {/* Timeline indicator */}
                      <div style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        background: isPositive
                          ? 'rgba(34, 197, 94, 0.12)'
                          : isNegative
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'hsl(var(--muted))',
                      }}>
                        {isPositive ? (
                          <TrendingUp style={{ width: 14, height: 14, color: '#22c55e' }} strokeWidth={1.5} />
                        ) : isNegative ? (
                          <TrendingDown style={{ width: 14, height: 14, color: '#ef4444' }} strokeWidth={1.5} />
                        ) : (
                          <Minus style={{ width: 14, height: 14, color: 'hsl(var(--muted-foreground))' }} strokeWidth={1.5} />
                        )}
                      </div>

                      {/* Event details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                          {event.reason ?? 'Credit update'}
                        </div>
                        {event.created_at && (
                          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                            {new Date(event.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Amount */}
                      {event.amount !== undefined && (
                        <span style={{
                          fontWeight: 600,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.8125rem',
                          flexShrink: 0,
                          color: isPositive ? '#22c55e' : isNegative ? '#ef4444' : 'hsl(var(--foreground))',
                        }}>
                          {isPositive ? '+' : ''}{event.amount}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
