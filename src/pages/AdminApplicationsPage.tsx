import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, Search } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList, type PaginatedResponse } from '../lib/pagination'
import type { ApplicationListItem } from '../types/application'

const statusOptions = [
  'draft',
  'applied',
  'under_review',
  'shortlisted',
  'pitch_scheduled',
  'pitch_completed',
  'due_diligence',
  'term_sheet',
  'negotiating',
  'accepted',
  'rejected',
  'withdrawn',
  'on_hold',
]

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'accepted':
      return 'badge success'
    case 'rejected':
    case 'withdrawn':
      return 'badge error'
    case 'under_review':
    case 'shortlisted':
    case 'pitch_scheduled':
    case 'due_diligence':
    case 'negotiating':
      return 'badge warning'
    case 'applied':
    case 'term_sheet':
    case 'pitch_completed':
      return 'badge info'
    default:
      return 'badge'
  }
}

export function AdminApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    fund: '',
    startup: '',
  })

  const query = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    params.set('page', String(page))
    return params.toString()
  }, [filters, page])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<ApplicationListItem[] | PaginatedResponse<ApplicationListItem>>(`/admin/applications/?${query}`)
        const list = normalizeList(data)
        if (!cancelled) {
          setApplications(list)
          setTotal(!Array.isArray(data) ? data.count ?? null : null)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load applications.')
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
  }, [query])

  return (
    <div data-testid="admin-applications-page">
      <Link className="back-btn" to="/app/admin">
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to Admin
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Applications</h1>
          <p className="page-description">Review all applications across startups and funds.</p>
        </div>
        {total !== null && <span className="badge info">{total} total</span>}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Filters</h2>
        </div>
        <div className="grid-4" style={{ gap: '0.75rem' }}>
          <div className="form-group">
            <label>Search</label>
            <input
              className="input"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Startup or fund"
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="select" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="">Any</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Fund ID</label>
            <input
              className="input"
              value={filters.fund}
              onChange={(event) => setFilters((prev) => ({ ...prev, fund: event.target.value }))}
              placeholder="UUID"
            />
          </div>
          <div className="form-group">
            <label>Startup ID</label>
            <input
              className="input"
              value={filters.startup}
              onChange={(event) => setFilters((prev) => ({ ...prev, startup: event.target.value }))}
              placeholder="UUID"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="empty-state">
          <FileText className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading applications...</p>
        </div>
      )}
      {error && <div className="empty-state"><p className="empty-description" style={{ color: '#ef4444' }}>{error}</p></div>}

      {!loading && !error && (
        <>
          {applications.length === 0 ? (
            <div className="empty-state">
              <Search className="empty-icon" strokeWidth={1.5} />
              <h3 className="empty-title">No applications found</h3>
              <p className="empty-description">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="card">
              <table className="data-table" data-testid="applications-table">
                <thead>
                  <tr>
                    <th>Startup</th>
                    <th>Fund</th>
                    <th>Status</th>
                    <th>Applied Date</th>
                    <th>Startup ID</th>
                    <th>Fund ID</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.id} data-testid={`application-row-${application.id}`}>
                      <td style={{ fontWeight: 500 }}>{application.startup_name || 'Startup'}</td>
                      <td>{application.fund_name || 'Fund'}</td>
                      <td>
                        <span className={statusBadgeClass(application.status || '')}>
                          {(application.status || 'draft').replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        {application.applied_date ? new Date(application.applied_date).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        {application.startup || '—'}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        {application.fund || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
            <button className="btn-sm ghost" type="button" onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={page === 1}>
              Previous
            </button>
            <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
              Page {page}
              {total ? ` · ${total} total` : ''}
            </span>
            <button className="btn-sm ghost" type="button" onClick={() => setPage((prev) => prev + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
