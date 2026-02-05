import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'

type AuditLog = {
  id: string
  timestamp: string
  user_email?: string | null
  actor_email?: string | null
  category?: string | null
  action?: string | null
  description?: string | null
  ip_address?: string | null
  success?: boolean
  error_message?: string | null
  target_type?: string | null
  target_id?: string | null
}

type AuditStats = {
  period_days: number
  total_events: number
  success_count: number
  failure_count: number
  success_rate: number
  by_category: Record<string, number>
  top_actions: Array<{ action: string; count: number }>
  failed_actions: Array<{ action: string; count: number }>
  top_ips: Array<{ ip_address: string; count: number }>
  security_events: number
}

type SecuritySummary = {
  period_hours: number
  total_events: number
  events: Array<{
    id: string
    timestamp: string
    action: string
    user_email?: string | null
    ip_address?: string | null
    success?: boolean
  }>
}

type AuditResponse = {
  results: AuditLog[]
  total: number
}

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : '—'

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [security, setSecurity] = useState<SecuritySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AuditLog | null>(null)
  const [page, setPage] = useState(0)

  const [filters, setFilters] = useState({
    user_id: '',
    category: '',
    action: '',
    success: '',
    start_date: '',
    end_date: '',
    ip_address: '',
  })

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    params.set('limit', '20')
    params.set('offset', String(page * 20))
    return params.toString()
  }, [filters, page])

  const loadStats = async () => {
    const [statsData, securityData] = await Promise.all([
      apiRequest<AuditStats>('/audit/stats/?days=7'),
      apiRequest<SecuritySummary>('/audit/security/?hours=24'),
    ])
    setStats(statsData)
    setSecurity(securityData)
  }

  const loadLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<AuditResponse>(`/audit/?${queryString}`)
      setLogs(data.results ?? [])
    } catch {
      setError('Unable to load audit logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        await loadStats()
        if (!cancelled) {
          await loadLogs()
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load audit data.')
        }
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void loadLogs()
  }, [queryString])

  return (
    <section className="content-section audit-page">
      <header className="content-header">
        <div>
          <h1>Audit Logs</h1>
          <p>Review security events, admin actions, and system changes.</p>
        </div>
        <button className="btn ghost" type="button" onClick={() => void loadLogs()}>
          Refresh
        </button>
      </header>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="audit-grid">
        <div className="metric-card">
          <span className="metric-label">Events (7d)</span>
          <span className="metric-value">{stats?.total_events ?? '—'}</span>
          <span className="metric-sub">Success rate {stats?.success_rate ?? 0}%</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Failures</span>
          <span className="metric-value">{stats?.failure_count ?? '—'}</span>
          <span className="metric-sub">Security events {stats?.security_events ?? 0}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Top actions</span>
          <span className="metric-value">{stats?.top_actions?.[0]?.action ?? '—'}</span>
          <span className="metric-sub">{stats?.top_actions?.[0]?.count ?? 0} events</span>
        </div>
      </div>

      <div className="audit-filters">
        <label>
          User ID
          <input
            value={filters.user_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, user_id: event.target.value }))}
            placeholder="UUID"
          />
        </label>
        <label>
          Category
          <input
            value={filters.category}
            onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="security, auth, admin"
          />
        </label>
        <label>
          Action
          <input
            value={filters.action}
            onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
            placeholder="login_failed"
          />
        </label>
        <label>
          Success
          <select value={filters.success} onChange={(event) => setFilters((prev) => ({ ...prev, success: event.target.value }))}>
            <option value="">Any</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
          </select>
        </label>
        <label>
          Start date
          <input
            type="date"
            value={filters.start_date}
            onChange={(event) => setFilters((prev) => ({ ...prev, start_date: event.target.value }))}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={filters.end_date}
            onChange={(event) => setFilters((prev) => ({ ...prev, end_date: event.target.value }))}
          />
        </label>
        <label>
          IP address
          <input
            value={filters.ip_address}
            onChange={(event) => setFilters((prev) => ({ ...prev, ip_address: event.target.value }))}
            placeholder="192.168.0.1"
          />
        </label>
        <button className="btn primary" type="button" onClick={() => void loadLogs()}>
          Apply filters
        </button>
      </div>

      {loading ? <div className="page-loader">Loading audit logs...</div> : null}

      {!loading ? (
        <div className="audit-table">
          <div className="audit-row head">
            <span>Time</span>
            <span>Category</span>
            <span>Action</span>
            <span>User</span>
            <span>IP</span>
            <span>Status</span>
          </div>
          {logs.map((log) => (
            <button key={log.id} className="audit-row" type="button" onClick={() => setSelected(log)}>
              <span>{formatDate(log.timestamp)}</span>
              <span>{log.category || '—'}</span>
              <span>
                <strong>{log.action}</strong>
                <small>{log.description}</small>
              </span>
              <span>{log.user_email || log.actor_email || '—'}</span>
              <span>{log.ip_address || '—'}</span>
              <span className={`audit-badge ${log.success ? 'success' : 'fail'}`}>
                {log.success ? 'OK' : 'Failed'}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="audit-pagination">
        <button className="btn ghost" type="button" onClick={() => setPage((prev) => Math.max(prev - 1, 0))} disabled={page === 0}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button className="btn ghost" type="button" onClick={() => setPage((prev) => prev + 1)}>
          Next
        </button>
      </div>

      <div className="audit-panels">
        <div className="series-card">
          <header>
            <h3>Categories</h3>
            <span>{stats ? `${stats.period_days} day window` : '—'}</span>
          </header>
          <div className="tag-list">
            {stats
              ? Object.entries(stats.by_category).map(([category, count]) => (
                  <span key={category} className="tag">
                    {category}: {count}
                  </span>
                ))
              : null}
          </div>
        </div>
        <div className="series-card">
          <header>
            <h3>Security signals</h3>
            <span>{security?.period_hours ?? 0} hours</span>
          </header>
          <div className="audit-security-list">
            {security?.events?.slice(0, 6).map((event) => (
              <div key={event.id} className="audit-security-item">
                <div>
                  <strong>{event.action}</strong>
                  <p>{event.user_email || 'Unknown user'}</p>
                </div>
                <span>{formatDate(event.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected ? (
        <div className="audit-drawer" role="dialog" aria-modal="true">
          <div className="audit-drawer-panel">
            <header>
              <div>
                <h3>{selected.action || 'Audit event'}</h3>
                <p>{selected.description || 'No description'}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)}>
                ✕
              </button>
            </header>
            <div className="audit-drawer-grid">
              <div>
                <span>Timestamp</span>
                <strong>{formatDate(selected.timestamp)}</strong>
              </div>
              <div>
                <span>User</span>
                <strong>{selected.user_email || selected.actor_email || '—'}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{selected.category || '—'}</strong>
              </div>
              <div>
                <span>IP address</span>
                <strong>{selected.ip_address || '—'}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{selected.success ? 'Success' : 'Failed'}</strong>
              </div>
              <div>
                <span>Target</span>
                <strong>{selected.target_type || '—'} {selected.target_id || ''}</strong>
              </div>
            </div>
            {selected.error_message ? (
              <div className="audit-drawer-alert">
                <strong>Error</strong>
                <p>{selected.error_message}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
