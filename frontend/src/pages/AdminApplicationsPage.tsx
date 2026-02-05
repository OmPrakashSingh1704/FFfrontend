import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
    <section className="content-section admin-apps-page">
      <header className="content-header">
        <div>
          <h1>Admin Applications</h1>
          <p>Review all applications across startups and funds.</p>
        </div>
        <div className="data-actions">
          <Link className="btn ghost" to="/app/admin">
            Back to admin
          </Link>
        </div>
      </header>

      <div className="admin-filter-bar">
        <label>
          Search
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Startup or fund"
          />
        </label>
        <label>
          Status
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">Any</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fund ID
          <input
            value={filters.fund}
            onChange={(event) => setFilters((prev) => ({ ...prev, fund: event.target.value }))}
            placeholder="UUID"
          />
        </label>
        <label>
          Startup ID
          <input
            value={filters.startup}
            onChange={(event) => setFilters((prev) => ({ ...prev, startup: event.target.value }))}
            placeholder="UUID"
          />
        </label>
      </div>

      {loading ? <div className="page-loader">Loading applications...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="data-grid">
            {applications.map((application) => (
              <article key={application.id} className="data-card">
                <div className="data-meta">
                  <span>{application.status || 'status'}</span>
                  {application.applied_date ? <span>{new Date(application.applied_date).toLocaleDateString()}</span> : null}
                </div>
                <h3>{application.startup_name || 'Startup'}</h3>
                <p>{application.fund_name || 'Fund'}</p>
                <div className="data-meta">
                  <span>Startup: {application.startup}</span>
                  <span>Fund: {application.fund}</span>
                </div>
              </article>
            ))}
          </div>
          <div className="admin-pagination">
            <button className="btn ghost" type="button" onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={page === 1}>
              Previous
            </button>
            <span>
              Page {page}
              {total ? ` · ${total} total` : ''}
            </span>
            <button className="btn ghost" type="button" onClick={() => setPage((prev) => prev + 1)}>
              Next
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}
