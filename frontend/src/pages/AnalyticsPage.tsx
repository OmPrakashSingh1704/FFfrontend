import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Activity, Users, MessageSquare, Zap, TrendingUp } from 'lucide-react'
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
  value === undefined || value === null ? '—' : value.toLocaleString()

const formatChange = (value?: number | null) => {
  if (value === null || value === undefined) return '—'
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
    <div className="series-card">
      <header>
        <h3>{title}</h3>
        <span>{series.length ? `${series.length} days` : 'No data yet'}</span>
      </header>
      <Sparkline series={series.slice(-20)} />
      <div className="series-bars">
        {series.slice(-10).map((point) => (
          <div key={point.date} className="series-bar">
            <span className="series-label">{point.date}</span>
            <div className="series-track">
              <div className="series-fill" style={{ width: `${(point.value / maxValue) * 100}%` }} />
            </div>
            <span className="series-value">{formatNumber(point.value)}</span>
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
    <section className="content-section analytics-page" data-testid="analytics-page">
      <header className="content-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span className="text-xs uppercase tracking-wider text-cyan-400">Insights</span>
          </div>
          <h1>Analytics</h1>
          <p>Admin metrics across growth, engagement, and system health.</p>
        </div>
        <div className="analytics-controls">
          <label>
            Metric focus
            <select 
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
          </label>
        </div>
      </header>

      {loading ? <div className="page-loader">Loading analytics...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="analytics-grid" data-testid="metrics-grid">
            <div className="metric-card">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="metric-label">DAU</span>
              </div>
              <span className="metric-value">{formatNumber(overview?.current?.dau)}</span>
              <span className="metric-sub">Avg: {formatNumber(overview?.averages?.daily_active_users)}</span>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400" />
                <span className="metric-label">WAU</span>
              </div>
              <span className="metric-value">{formatNumber(overview?.current?.wau)}</span>
              <span className="metric-sub">MAU {formatNumber(overview?.current?.mau)}</span>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span className="metric-label">Messages</span>
              </div>
              <span className="metric-value">{formatNumber(overview?.totals?.messages)}</span>
              <span className="metric-sub">{overview?.period_days ?? 0} day total</span>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span className="metric-label">New users</span>
              </div>
              <span className="metric-value">{formatNumber(overview?.totals?.new_users)}</span>
              <span className="metric-sub">{overview?.period_days ?? 0} day total</span>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-pink-400" />
                <span className="metric-label">Conversations</span>
              </div>
              <span className="metric-value">{formatNumber(overview?.totals?.conversations)}</span>
              <span className="metric-sub">Created in period</span>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="metric-label">Intros</span>
              </div>
              <span className="metric-value">{formatNumber(overview?.totals?.intros)}</span>
              <span className="metric-sub">Requested in period</span>
            </div>
          </div>

          <div className="analytics-panels" data-testid="series-panels">
            <SeriesCard title="New users (last 10 days)" series={userGrowth?.new_users_series ?? []} />
            <SeriesCard title="Daily active users (last 10 days)" series={userGrowth?.dau_series ?? []} />
          </div>

          <div className="analytics-grid">
            <div className="metric-card">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span className="metric-label">Engagement</span>
              </div>
              <span className="metric-value">{formatNumber(engagement?.messages_sent)}</span>
              <span className="metric-sub">Messages sent</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Reactions</span>
              <span className="metric-value">{formatNumber(engagement?.reactions_added)}</span>
              <span className="metric-sub">Added in period</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Feed posts</span>
              <span className="metric-value">{formatNumber(engagement?.feed_posts)}</span>
              <span className="metric-sub">Likes {formatNumber(engagement?.feed_likes)}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Avg messages/user</span>
              <span className="metric-value">{formatNumber(engagement?.avg_messages_per_user)}</span>
              <span className="metric-sub">Per day average</span>
            </div>
          </div>

          <div className="analytics-panels">
            <div className="metric-card metric-wide">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="metric-label">Live now</span>
              </div>
              <span className="metric-value">{formatNumber(realTime?.active_users_last_hour)}</span>
              <span className="metric-sub">
                Messages today {formatNumber(realTime?.messages_today)} · Updated{' '}
                {realTime?.timestamp ? new Date(realTime.timestamp).toLocaleTimeString() : '—'}
              </span>
            </div>
            <div className="series-card">
              <header>
                <h3>Weekly comparison</h3>
                <span>{comparison?.period_days ?? 0} day window</span>
              </header>
              <div className="comparison-grid">
                {comparison?.metrics
                  ? Object.entries(comparison.metrics).map(([key, value]) => (
                      <div key={key} className="comparison-card">
                        <span>{key.replace('_', ' ')}</span>
                        <strong>{formatNumber(value.current)}</strong>
                        <em className={value.change_pct && value.change_pct < 0 ? 'trend down' : 'trend up'}>
                          {formatChange(value.change_pct)}
                        </em>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </div>

          <div className="series-card" data-testid="focused-metric-card">
            <header>
              <h3>Focused metric: {metricOptions.find((option) => option.value === metric)?.label}</h3>
              <span>{seriesLoading ? 'Updating…' : `${series.length} datapoints`}</span>
            </header>
            <Sparkline series={series.slice(-30)} height={90} />
            <div className="series-bars">
              {series.slice(-14).map((point) => (
                <div key={point.date} className="series-bar">
                  <span className="series-label">{point.date}</span>
                  <div className="series-track">
                    <div
                      className="series-fill"
                      style={{
                        width: `${
                          series.length ? (point.value / Math.max(...series.map((p) => p.value), 1)) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="series-value">{formatNumber(point.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
