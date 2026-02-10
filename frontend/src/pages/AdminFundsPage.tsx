import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Landmark, Search } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList, type PaginatedResponse } from '../lib/pagination'
import type { FundListItem } from '../types/fund'

type AdminFund = FundListItem & {
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export function AdminFundsPage() {
  const [funds, setFunds] = useState<AdminFund[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    search: '',
    active: '',
    featured: '',
    sponsored: '',
    fund_type: '',
    opportunity_type: '',
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
        const data = await apiRequest<AdminFund[] | PaginatedResponse<AdminFund>>(`/admin/funds/?${query}`)
        const list = normalizeList(data)
        if (!cancelled) {
          setFunds(list)
          setTotal(!Array.isArray(data) ? data.count ?? null : null)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load funds.')
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

  const statusBadge = (fund: AdminFund) => {
    if (fund.is_active === undefined) return null
    return fund.is_active
      ? <span className="badge success">Active</span>
      : <span className="badge warning">Inactive</span>
  }

  return (
    <div data-testid="admin-funds-page">
      <Link className="back-btn" to="/app/admin">
        <ArrowLeft size={16} strokeWidth={1.5} />
        Back to Admin
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Funds</h1>
          <p className="page-description">Review all funding opportunities across the platform.</p>
        </div>
        {total !== null && <span className="badge info">{total} total</span>}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Filters</h2>
        </div>
        <div className="grid-3" style={{ gap: '0.75rem' }}>
          <div className="form-group">
            <label>Search</label>
            <input
              className="input"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Name or organization"
            />
          </div>
          <div className="form-group">
            <label>Active</label>
            <select className="select" value={filters.active} onChange={(event) => setFilters((prev) => ({ ...prev, active: event.target.value }))}>
              <option value="">Any</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div className="form-group">
            <label>Featured</label>
            <select className="select" value={filters.featured} onChange={(event) => setFilters((prev) => ({ ...prev, featured: event.target.value }))}>
              <option value="">Any</option>
              <option value="true">Featured</option>
              <option value="false">Not featured</option>
            </select>
          </div>
          <div className="form-group">
            <label>Sponsored</label>
            <select className="select" value={filters.sponsored} onChange={(event) => setFilters((prev) => ({ ...prev, sponsored: event.target.value }))}>
              <option value="">Any</option>
              <option value="true">Sponsored</option>
              <option value="false">Not sponsored</option>
            </select>
          </div>
          <div className="form-group">
            <label>Fund type</label>
            <input
              className="input"
              value={filters.fund_type}
              onChange={(event) => setFilters((prev) => ({ ...prev, fund_type: event.target.value }))}
              placeholder="vc, angel, accelerator"
            />
          </div>
          <div className="form-group">
            <label>Opportunity type</label>
            <input
              className="input"
              value={filters.opportunity_type}
              onChange={(event) => setFilters((prev) => ({ ...prev, opportunity_type: event.target.value }))}
              placeholder="grant, vc_program"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="empty-state">
          <Landmark className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading funds...</p>
        </div>
      )}
      {error && <div className="empty-state"><p className="empty-description" style={{ color: '#ef4444' }}>{error}</p></div>}

      {!loading && !error && (
        <>
          {funds.length === 0 ? (
            <div className="empty-state">
              <Search className="empty-icon" strokeWidth={1.5} />
              <h3 className="empty-title">No funds found</h3>
              <p className="empty-description">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="card">
              <table className="data-table" data-testid="funds-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Organization</th>
                    <th>Type</th>
                    <th>Opportunity</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Tags</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {funds.map((fund) => (
                    <tr key={fund.id} data-testid={`fund-row-${fund.id}`}>
                      <td style={{ fontWeight: 500 }}>{fund.name}</td>
                      <td>{fund.organization || '—'}</td>
                      <td><span className="tag">{fund.fund_type || 'fund'}</span></td>
                      <td>{fund.opportunity_type ? <span className="tag">{fund.opportunity_type}</span> : '—'}</td>
                      <td>
                        {fund.headquarters_city || fund.headquarters_country
                          ? `${fund.headquarters_city || ''}${fund.headquarters_city && fund.headquarters_country ? ', ' : ''}${fund.headquarters_country || ''}`
                          : '—'}
                      </td>
                      <td>{statusBadge(fund)}</td>
                      <td style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {fund.is_featured ? <span className="badge info">Featured</span> : null}
                        {fund.is_sponsored ? <span className="badge warning">Sponsored</span> : null}
                      </td>
                      <td>{fund.deadline ? new Date(fund.deadline).toLocaleDateString() : '—'}</td>
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
              {total ? ` of ${Math.ceil(total / 20)}` : ''}
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
