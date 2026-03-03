import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Activity, Users, MessageSquare, Zap, TrendingUp, ArrowUp, ArrowDown, Loader2 } from 'lucide-react'
import { apiRequest } from '../lib/api'

type OverviewMetrics = {
  period_days: number
  current: {
    dau: number
    wau: number
    mau: number
  }
  totals: {
    messages: number
    new_users: number
    conversations: number
    intros: number
  }
  averages: {
    daily_active_users: number
  }
}

type SeriesPoint = {
  date: string
  value: number
}

type UserGrowth = {
  total_new_users: number
  new_users_series: SeriesPoint[]
  dau_series: SeriesPoint[]
}

type EngagementMetrics = {
  period_days: number
  messages_sent: number
  reactions_added: number
  feed_posts: number
  feed_likes: number
  avg_messages_per_user: number
}

type RealTimeStats = {
  timestamp: string
  active_users_last_hour: number
  messages_today: number
}

type ComparisonMetrics = {
  period_days: number
  metrics: {
    avg_dau: MetricComparison
    messages: MetricComparison
    new_users: MetricComparison
    intros: MetricComparison
  }
}

type MetricComparison = {
  current: number
  previous: number
  change_pct: number | null
}

type TimeSeriesResponse = {
  metric: string
  period_days: number
  data: SeriesPoint[]
}

const metricOptions = [
  { value: 'daily_active_users', label: 'Daily active users' },
  { value: 'weekly_active_users', label: 'Weekly active users' },
  { value: 'monthly_active_users', label: 'Monthly active users' },
  { value: 'new_users', label: 'New users' },
  { value: 'messages_sent', label: 'Messages sent' },
  { value: 'conversations_created', label: 'Conversations created' },
  { value: 'feed_posts', label: 'Feed posts' },
  { value: 'intros_requested', label: 'Intros requested' },
  { value: 'reactions_added', label: 'Reactions added' },
]

const formatNumber = (value?: number | null) =>
  value === undefined || value === null ? '\u2014' : value.toLocaleString()

const formatChange = (value?: number | null) => {
  if (value === null || value === undefined) return '\u2014'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}%`
}

function buildSparklinePath(series: SeriesPoint[], width: number, height: number, padding = 6) {
  if (series.length === 0) {
    return { line: '', area: '' }
  }

  const values = series.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)
  const step = (width - padding * 2) / Math.max(1, series.length - 1)

  const points = series.map((point, index) => {
    const x = padding + step * index
    const y = height - padding - ((point.value - min) / span) * (height - padding * 2)
    return { x, y }
  })

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
  const area = `${line} L${points[points.length - 1].x},${height - padding} L${points[0].x},${height - padding} Z`

  return { line, area }
}

function Sparkline({ series, height = 70 }: { series: SeriesPoint[]; height?: number }) {
  const width = 280
  const { line, area } = useMemo(() => buildSparklinePath(series, width, height), [series, width, height])

  if (!line) {
    return <div className="sparkline-empty">No data</div>
  }

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend line">
      <path className="sparkline-area" d={area} />
      <path className="sparkline-line" d={line} />
    </svg>
  )
}

function SeriesCard({ title, series }: { title: string; series: SeriesPoint[] }) {
  const maxValue = useMemo(() => Math.max(1, ...series.map((point) => point.value)), [series])

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <span className="badge info">{series.length ? `${series.length} days` : 'No data yet'}</span>
      </div>
      <Sparkline series={series.slice(-20)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.75rem' }}>
        {series.slice(-10).map((point) => (
          <div key={point.date} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', width: '5rem', flexShrink: 0 }}>
              {point.date}
            </span>
            <div style={{
              flex: 1,
              height: '0.375rem',
              borderRadius: '0.25rem',
              background: 'hsl(var(--muted))',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                borderRadius: '0.25rem',
                background: 'var(--gold)',
                width: `${(point.value / maxValue) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              fontFamily: "'JetBrains Mono', monospace",
              width: '3rem',
              textAlign: 'right',
              flexShrink: 0,
            }}>
              {formatNumber(point.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewMetrics | null>(null)
  const [userGrowth, setUserGrowth] = useState<UserGrowth | null>(null)
  const [engagement, setEngagement] = useState<EngagementMetrics | null>(null)
  const [realTime, setRealTime] = useState<RealTimeStats | null>(null)
  const [comparison, setComparison] = useState<ComparisonMetrics | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [metric, setMetric] = useState(metricOptions[0].value)
  const [loading, setLoading] = useState(true)
  const [seriesLoading, setSeriesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [overviewData, userData, engagementData, realTimeData, comparisonData] = await Promise.all([
          apiRequest<OverviewMetrics>('/analytics/dashboard/'),
          apiRequest<UserGrowth>('/analytics/dashboard/users/'),
          apiRequest<EngagementMetrics>('/analytics/dashboard/engagement/'),
          apiRequest<RealTimeStats>('/analytics/dashboard/real-time/'),
          apiRequest<ComparisonMetrics>('/analytics/dashboard/comparison/?days=7'),
        ])
        if (!cancelled) {
          setOverview(overviewData)
          setUserGrowth(userData)
          setEngagement(engagementData)
          setRealTime(realTimeData)
          setComparison(comparisonData)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load analytics data.')
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

  useEffect(() => {
    let cancelled = false
    const loadSeries = async () => {
      setSeriesLoading(true)
      try {
        const data = await apiRequest<TimeSeriesResponse>(`/analytics/dashboard/time-series/?metric=${metric}`)
        if (!cancelled) {
          setSeries(data.data ?? [])
        }
      } catch {
        if (!cancelled) {
          setSeries([])
        }
      } finally {
        if (!cancelled) {
          setSeriesLoading(false)
        }
      }
    }

    void loadSeries()
    return () => {
      cancelled = true
    }
  }, [metric])

  return (
    <div style={{ padding: '1.5rem' }} data-testid="analytics-page">
      {/* Page Header with metric selector */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-description">Admin metrics across growth, engagement, and system health.</p>
        </div>
        <select
          className="select"
          style={{ width: 'auto', minWidth: '12rem' }}
          value={metric}
          onChange={(event) => setMetric(event.target.value)}
          data-testid="metric-select"
        >
          {metricOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="empty-state">
          <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite' }} />
          <p className="empty-description">Loading analytics...</p>
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
          {/* Overview Metrics - 6 stat cards in grid-3 (2 rows) */}
          <div className="section">
            <span className="section-label">Overview</span>
            <div className="grid-3" data-testid="metrics-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">DAU</span>
                  <div className="stat-icon">
                    <Users style={{ width: 20, height: 20 }} strokeWidth={1.5} />
                  </div>
                </div>
                <span className="stat-value">{formatNumber(overview?.current?.dau)}</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  Avg: {formatNumber(overview?.averages?.daily_active_users)}
                </span>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">WAU</span>
                  <div className="stat-icon">
                    <Activity style={{ width: 20, height: 20 }} strokeWidth={1.5} />
                  </div>
                </div>
                <span className="stat-value">{formatNumber(overview?.current?.wau)}</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  MAU: {formatNumber(overview?.current?.mau)}
                </span>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Messages</span>
                  <div className="stat-icon">
                    <MessageSquare style={{ width: 20, height: 20 }} strokeWidth={1.5} />
                  </div>
                </div>
                <span className="stat-value">{formatNumber(overview?.totals?.messages)}</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  {overview?.period_days ?? 0} day total
                </span>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">New Users</span>
                  <div className="stat-icon">
                    <Users style={{ width: 20, height: 20 }} strokeWidth={1.5} />
                  </div>
                </div>
                <span className="stat-value">{formatNumber(overview?.totals?.new_users)}</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  {overview?.period_days ?? 0} day total
                </span>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Conversations</span>
                  <div className="stat-icon">
                    <MessageSquare style={{ width: 20, height: 20 }} strokeWidth={1.5} />
                  </div>
                </div>
                <span className="stat-value">{formatNumber(overview?.totals?.conversations)}</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  Created in period
                </span>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Intros</span>
                  <div className="stat-icon">
                    <Zap style={{ width: 20, height: 20 }} strokeWidth={1.5} />
                  </div>
                </div>
                <span className="stat-value">{formatNumber(overview?.totals?.intros)}</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  Requested in period
                </span>
              </div>
            </div>
          </div>

          {/* Growth Charts */}
          <div className="section">
            <span className="section-label">Growth Trends</span>
            <div className="grid-2" data-testid="series-panels">
              <SeriesCard title="New Users (last 10 days)" series={userGrowth?.new_users_series ?? []} />
              <SeriesCard title="Daily Active Users (last 10 days)" series={userGrowth?.dau_series ?? []} />
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="section">
            <span className="section-label">Engagement</span>
            <div className="grid-4">
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Messages Sent</span>
                  <div className="stat-icon">
                    <TrendingUp style={{ width: 20, height: 20 }} strokeWidth={1.5} />
                  </div>
                </div>
                <span className="stat-value">{formatNumber(engagement?.messages_sent)}</span>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Reactions</span>
                </div>
                <span className="stat-value">{formatNumber(engagement?.reactions_added)}</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Added in period</span>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Feed Posts</span>
                </div>
                <span className="stat-value">{formatNumber(engagement?.feed_posts)}</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  Likes: {formatNumber(engagement?.feed_likes)}
                </span>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Avg Msgs/User</span>
                </div>
                <span className="stat-value">{formatNumber(engagement?.avg_messages_per_user)}</span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Per day average</span>
              </div>
            </div>
          </div>

          {/* Real-Time + Weekly Comparison */}
          <div className="section">
            <div className="grid-2">
              {/* Real-time card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: '0.5rem',
                        height: '0.5rem',
                        borderRadius: '50%',
                        background: '#22c55e',
                        display: 'inline-block',
                        boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)',
                        animation: 'pulse 2s ease-in-out infinite',
                      }}
                    />
                    Live Now
                  </span>
                  <span className="badge success">Real-time</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Active users (last hour)
                    </span>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                      {formatNumber(realTime?.active_users_last_hour)}
                    </div>
                  </div>
                  <hr className="divider" style={{ margin: '0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                      Messages today
                    </span>
                    <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem' }}>
                      {formatNumber(realTime?.messages_today)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>
                    Updated: {realTime?.timestamp ? new Date(realTime.timestamp).toLocaleTimeString() : '\u2014'}
                  </div>
                </div>
              </div>

              {/* Weekly Comparison */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Weekly Comparison</span>
                  <span className="badge info">{comparison?.period_days ?? 0} day window</span>
                </div>
                {comparison?.metrics ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th style={{ textAlign: 'right' }}>Current</th>
                        <th style={{ textAlign: 'right' }}>Previous</th>
                        <th style={{ textAlign: 'right' }}>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(comparison.metrics).map(([key, value]) => {
                        const changePct = value.change_pct
                        const isUp = changePct !== null && changePct > 0
                        const isDown = changePct !== null && changePct < 0
                        return (
                          <tr key={key}>
                            <td style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                              {key.replace(/_/g, ' ')}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
                              {formatNumber(value.current)}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                              {formatNumber(value.previous)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontWeight: 600,
                                fontSize: '0.8125rem',
                                color: isUp ? '#22c55e' : isDown ? '#ef4444' : 'hsl(var(--muted-foreground))',
                              }}>
                                {isUp && <ArrowUp style={{ width: 12, height: 12 }} />}
                                {isDown && <ArrowDown style={{ width: 12, height: 12 }} />}
                                {formatChange(changePct)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state" style={{ padding: '2rem 0' }}>
                    <p className="empty-description">No comparison data available.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Focused Metric */}
          <div className="section">
            <div className="card" data-testid="focused-metric-card">
              <div className="card-header">
                <span className="card-title">
                  <BarChart3 style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: '0.375rem' }} strokeWidth={1.5} />
                  Focused Metric: {metricOptions.find((option) => option.value === metric)?.label}
                </span>
                <span className="badge info">
                  {seriesLoading ? 'Updating...' : `${series.length} datapoints`}
                </span>
              </div>

              {seriesLoading ? (
                <div className="empty-state" style={{ padding: '2rem 0' }}>
                  <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
                  <p className="empty-description">Loading metric data...</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <Sparkline series={series.slice(-30)} height={90} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {series.slice(-14).map((point) => {
                      const maxVal = Math.max(...series.map((p) => p.value), 1)
                      return (
                        <div key={point.date} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', width: '5rem', flexShrink: 0 }}>
                            {point.date}
                          </span>
                          <div style={{
                            flex: 1,
                            height: '0.375rem',
                            borderRadius: '0.25rem',
                            background: 'hsl(var(--muted))',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              borderRadius: '0.25rem',
                              background: 'var(--gold)',
                              width: `${(point.value / maxVal) * 100}%`,
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            fontFamily: "'JetBrains Mono', monospace",
                            width: '3rem',
                            textAlign: 'right',
                            flexShrink: 0,
                          }}>
                            {formatNumber(point.value)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Pulse animation for the live dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
