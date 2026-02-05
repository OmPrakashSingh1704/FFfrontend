import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

  return (
    <section className="content-section admin-funds-page">
      <header className="content-header">
        <div>
          <h1>Admin Funds</h1>
          <p>Review all funding opportunities across the platform.</p>
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
            placeholder="Name or organization"
          />
        </label>
        <label>
          Active
          <select value={filters.active} onChange={(event) => setFilters((prev) => ({ ...prev, active: event.target.value }))}>
            <option value="">Any</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <label>
          Featured
          <select value={filters.featured} onChange={(event) => setFilters((prev) => ({ ...prev, featured: event.target.value }))}>
            <option value="">Any</option>
            <option value="true">Featured</option>
            <option value="false">Not featured</option>
          </select>
        </label>
        <label>
          Sponsored
          <select value={filters.sponsored} onChange={(event) => setFilters((prev) => ({ ...prev, sponsored: event.target.value }))}>
            <option value="">Any</option>
            <option value="true">Sponsored</option>
            <option value="false">Not sponsored</option>
          </select>
        </label>
        <label>
          Fund type
          <input
            value={filters.fund_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, fund_type: event.target.value }))}
            placeholder="vc, angel, accelerator"
          />
        </label>
        <label>
          Opportunity type
          <input
            value={filters.opportunity_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, opportunity_type: event.target.value }))}
            placeholder="grant, vc_program"
          />
        </label>
      </div>

      {loading ? <div className="page-loader">Loading funds...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="data-grid">
            {funds.map((fund) => (
              <article key={fund.id} className="data-card">
                <div className="data-meta">
                  <span>{fund.fund_type || 'fund'}</span>
                  {fund.opportunity_type ? <span>{fund.opportunity_type}</span> : null}
                </div>
                <h3>{fund.name}</h3>
                <p>{fund.organization || '-'}</p>
                <div className="tag-list">
                  {fund.is_active !== undefined ? (
                    <span className={`status-pill ${fund.is_active ? 'ok' : 'warn'}`}>
                      {fund.is_active ? 'Active' : 'Inactive'}
                    </span>
                  ) : null}
                  {fund.is_featured ? <span className="status-pill">Featured</span> : null}
                  {fund.is_sponsored ? <span className="status-pill">Sponsored</span> : null}
                </div>
                <div className="data-meta">
                  {fund.headquarters_city ? <span>{fund.headquarters_city}</span> : null}
                  {fund.headquarters_country ? <span>{fund.headquarters_country}</span> : null}
                  {fund.deadline ? <span>Deadline: {new Date(fund.deadline).toLocaleDateString()}</span> : null}
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
