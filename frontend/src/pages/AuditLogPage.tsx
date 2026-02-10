import { useEffect, useMemo, useState } from 'react'
import { ScrollText, ShieldAlert, Activity, RefreshCw, X, AlertTriangle } from 'lucide-react'
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
    <div data-testid="audit-log-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-description">Review security events, admin actions, and system changes.</p>
        </div>
        <button className="btn-sm ghost" type="button" onClick={() => void loadLogs()}>
          <RefreshCw size={14} strokeWidth={1.5} />
          Refresh
        </button>
      </div>

      {error && <div className="empty-state" style={{ padding: '1rem 0' }}><p className="empty-description" style={{ color: '#ef4444' }}>{error}</p></div>}

      {/* Stats Cards */}
      <div className="section">
        <div className="grid-3">
          <div className="stat-card" data-testid="stat-events">
            <div className="stat-header">
              <span className="stat-label">Events (7d)</span>
              <Activity className="stat-icon" strokeWidth={1.5} />
            </div>
            <div className="stat-value">{stats?.total_events ?? '—'}</div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Success rate {stats?.success_rate ?? 0}%</span>
          </div>
          <div className="stat-card" data-testid="stat-failures">
            <div className="stat-header">
              <span className="stat-label">Failures</span>
              <AlertTriangle className="stat-icon" strokeWidth={1.5} />
            </div>
            <div className="stat-value">{stats?.failure_count ?? '—'}</div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Security events {stats?.security_events ?? 0}</span>
          </div>
          <div className="stat-card" data-testid="stat-top-action">
            <div className="stat-header">
              <span className="stat-label">Top Action</span>
              <ScrollText className="stat-icon" strokeWidth={1.5} />
            </div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>{stats?.top_actions?.[0]?.action ?? '—'}</div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{stats?.top_actions?.[0]?.count ?? 0} events</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Filters</h2>
          <button className="btn-sm primary" type="button" onClick={() => void loadLogs()}>
            Apply filters
          </button>
        </div>
        <div className="grid-4" style={{ gap: '0.75rem' }}>
          <div className="form-group">
            <label>User ID</label>
            <input
              className="input"
              value={filters.user_id}
              onChange={(event) => setFilters((prev) => ({ ...prev, user_id: event.target.value }))}
              placeholder="UUID"
            />
          </div>
          <div className="form-group">
            <label>Category</label>
            <input
              className="input"
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="security, auth, admin"
            />
          </div>
          <div className="form-group">
            <label>Action</label>
            <input
              className="input"
              value={filters.action}
              onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
              placeholder="login_failed"
            />
          </div>
          <div className="form-group">
            <label>Success</label>
            <select className="select" value={filters.success} onChange={(event) => setFilters((prev) => ({ ...prev, success: event.target.value }))}>
              <option value="">Any</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
          </div>
          <div className="form-group">
            <label>Start date</label>
            <input
              className="input"
              type="date"
              value={filters.start_date}
              onChange={(event) => setFilters((prev) => ({ ...prev, start_date: event.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>End date</label>
            <input
              className="input"
              type="date"
              value={filters.end_date}
              onChange={(event) => setFilters((prev) => ({ ...prev, end_date: event.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>IP address</label>
            <input
              className="input"
              value={filters.ip_address}
              onChange={(event) => setFilters((prev) => ({ ...prev, ip_address: event.target.value }))}
              placeholder="192.168.0.1"
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      {loading && (
        <div className="empty-state">
          <ScrollText className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading audit logs...</p>
        </div>
      )}

      {!loading && (
        <div className="card">
          {logs.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <ScrollText className="empty-icon" strokeWidth={1.5} />
              <h3 className="empty-title">No audit logs found</h3>
              <p className="empty-description">Try adjusting your filters.</p>
            </div>
          ) : (
            <table className="data-table" data-testid="audit-log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Category</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>IP</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} data-testid={`audit-row-${log.id}`} onClick={() => setSelected(log)} style={{ cursor: 'pointer' }}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{formatDate(log.timestamp)}</td>
                    <td><span className="tag">{log.category || '—'}</span></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{log.action || '—'}</div>
                      {log.description && (
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.125rem' }}>{log.description}</div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>{log.user_email || log.actor_email || '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{log.ip_address || '—'}</td>
                    <td>
                      <span className={`badge ${log.success ? 'success' : 'error'}`}>
                        {log.success ? 'OK' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
        <button className="btn-sm ghost" type="button" onClick={() => setPage((prev) => Math.max(prev - 1, 0))} disabled={page === 0}>
          Previous
        </button>
        <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
          Page {page + 1}
        </span>
        <button className="btn-sm ghost" type="button" onClick={() => setPage((prev) => prev + 1)}>
          Next
        </button>
      </div>

      {/* Bottom Panels */}
      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        {/* Categories */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Categories</h2>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
              {stats ? `${stats.period_days} day window` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0 0 0.5rem' }}>
            {stats
              ? Object.entries(stats.by_category).map(([category, count]) => (
                  <span key={category} className="tag">
                    {category}: {count}
                  </span>
                ))
              : <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>No data</span>}
          </div>
        </div>

        {/* Security Signals */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={16} strokeWidth={1.5} />
              Security Signals
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
              {security?.period_hours ?? 0} hours
            </span>
          </div>
          {security?.events?.length ? (
            <div>
              {security.events.slice(0, 6).map((event) => (
                <div key={event.id} className="list-item">
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{event.action}</div>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{event.user_email || 'Unknown user'}</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>{formatDate(event.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '1.5rem 0' }}>
              <p className="empty-description">No recent security events.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div
            className="card"
            style={{ maxWidth: '520px', width: '100%', margin: '1rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <div>
                <h2 className="card-title">{selected.action || 'Audit event'}</h2>
                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
                  {selected.description || 'No description'}
                </p>
              </div>
              <button className="btn-sm ghost" type="button" onClick={() => setSelected(null)}>
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="stat-card">
                <span className="stat-label">Timestamp</span>
                <div className="stat-value" style={{ fontSize: '0.875rem' }}>{formatDate(selected.timestamp)}</div>
              </div>
              <div className="stat-card">
                <span className="stat-label">User</span>
                <div className="stat-value" style={{ fontSize: '0.875rem' }}>{selected.user_email || selected.actor_email || '—'}</div>
              </div>
              <div className="stat-card">
                <span className="stat-label">Category</span>
                <div className="stat-value" style={{ fontSize: '0.875rem' }}>{selected.category || '—'}</div>
              </div>
              <div className="stat-card">
                <span className="stat-label">IP Address</span>
                <div className="stat-value" style={{ fontSize: '0.875rem' }}>{selected.ip_address || '—'}</div>
              </div>
              <div className="stat-card">
                <span className="stat-label">Status</span>
                <div><span className={`badge ${selected.success ? 'success' : 'error'}`}>{selected.success ? 'Success' : 'Failed'}</span></div>
              </div>
              <div className="stat-card">
                <span className="stat-label">Target</span>
                <div className="stat-value" style={{ fontSize: '0.875rem' }}>{selected.target_type || '—'} {selected.target_id || ''}</div>
              </div>
            </div>

            {selected.error_message && (
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#ef4444', marginBottom: '0.25rem' }}>Error</div>
                <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>{selected.error_message}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
