/**
 * Admin call metrics dashboard.
 *
 * Route: /app/admin/calls/metrics
 *
 * Surfaces the data collected by the quality beacon so ops can spot
 * cross-network call failures BEFORE users complain. Backend endpoint:
 * GET /api/v1/chat/calls/admin/metrics/?range=24h
 *
 * Layout per DESIGN.md:
 *   - 4 KPI tiles (total / success rate / p50 setup / TURN bandwidth)
 *   - Time-range picker (1h / 24h / 7d)
 *   - No animated count-up, no colorful gradient KPIs
 *   - is_staff gated (backend enforces; FE shows nothing if non-staff)
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { apiRequest } from '../lib/api'

type Range = '1h' | '24h' | '7d'

type Metrics = {
  range: Range
  since: string
  total_calls: number
  successful_calls: number
  success_rate_pct: number
  failure_rate_pct: number
  p50_ice_setup_ms: number | null
  p99_ice_setup_ms: number | null
  total_bytes_relayed: number
  quality_report_count: number
}

const RANGE_LABELS: Record<Range, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatMs(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function AdminCallMetricsPage() {
  const [range, setRange] = useState<Range>('24h')
  const [data, setData] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiRequest<Metrics>(`/chat/calls/admin/metrics/?range=${range}`)
      setData(result)
    } catch {
      setError('Could not load metrics.')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div data-testid="admin-call-metrics-page">
      <Link className="back-btn" to="/app/admin">
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to Admin
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Call Metrics</h1>
          <p className="page-description">
            Cross-network call health and TURN bandwidth usage.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            className="select"
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            data-testid="metrics-range-select"
            aria-label="Time range"
          >
            {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
              <option key={r} value={r}>
                {RANGE_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={() => void load()}
            aria-label="Refresh"
            disabled={loading}
          >
            <RefreshCw size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      {loading && !data ? (
        <div style={{ padding: '1rem', color: 'hsl(var(--muted-foreground))' }}>Loading metrics...</div>
      ) : data ? (
        <>
          {/* KPI tiles */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}
            data-testid="metrics-kpi-grid"
          >
            <KPI label="Total calls" value={String(data.total_calls)} />
            <KPI
              label="Success rate"
              value={`${data.success_rate_pct}%`}
              tone={
                data.total_calls === 0
                  ? 'neutral'
                  : data.success_rate_pct >= 95
                    ? 'good'
                    : data.success_rate_pct >= 80
                      ? 'warn'
                      : 'bad'
              }
              aria-label={`Success rate: ${data.success_rate_pct} percent`}
            />
            <KPI
              label="p50 connect time"
              value={formatMs(data.p50_ice_setup_ms)}
              sub={`p99: ${formatMs(data.p99_ice_setup_ms)}`}
            />
            <KPI label="Bandwidth relayed" value={formatBytes(data.total_bytes_relayed)} />
          </div>

          {/* Quality report count — operational signal */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', fontSize: '0.875rem' }}>
              <strong>{data.quality_report_count}</strong> quality reports received in{' '}
              <strong>{RANGE_LABELS[data.range]}</strong>. Calls with no quality report
              either failed before ICE connected, or the client failed to flush the
              beacon (page killed before send).
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

type KPIProps = {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad' | 'neutral'
  sub?: string
  'aria-label'?: string
}

function KPI({ label, value, tone, sub, ...rest }: KPIProps) {
  const valueColor =
    tone === 'bad'
      ? 'hsl(var(--destructive))'
      : tone === 'good'
        ? 'hsl(var(--foreground))'
        : tone === 'warn'
          ? 'hsl(38 92% 50%)'
          : 'hsl(var(--foreground))'
  return (
    <div
      className="card"
      style={{
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
      {...rest}
    >
      <span
        style={{
          fontSize: '0.75rem',
          color: 'hsl(var(--muted-foreground))',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: '1.75rem', fontWeight: 600, color: valueColor }}>{value}</span>
      {sub ? (
        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{sub}</span>
      ) : null}
    </div>
  )
}
