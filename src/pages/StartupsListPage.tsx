import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, TrendingUp, Search, X } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { formatLabel } from '../lib/format'
import { Pagination } from '../components/Pagination'
import type { StartupListItem } from '../types/startup'

type PaginatedResponse = {
  count: number
  next: string | null
  previous: string | null
  results: StartupListItem[]
}

const PAGE_SIZE = 20

export function StartupsListPage() {
  const [startups, setStartups] = useState<StartupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const searchTimer = useRef<number | null>(null)

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ page: String(page) })
        if (search) params.set('search', search)
        const data = await apiRequest<PaginatedResponse>(`/founders/startups/?${params}`)
        if (!cancelled) {
          setStartups(data.results ?? [])
          setTotalCount(data.count ?? 0)
        }
      } catch {
        if (!cancelled) setError('Unable to load startups.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [page, search])

  const handleSearchChange = (value: string) => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }

  return (
    <div data-testid="startups-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Startups
            {!loading && !error && (
              <span className="badge info" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                {totalCount}
              </span>
            )}
          </h1>
          <p className="page-description">Explore the startups raising on FoundersLib.</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search size={15} strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }} />
        <input
          className="input"
          type="text"
          placeholder="Search by name, industry, stage, location…"
          defaultValue={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{ paddingLeft: 38, paddingRight: search ? 36 : undefined }}
          data-testid="startups-search"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setPage(1) }}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 2, display: 'flex' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loading && (
        <div className="empty-state">
          <Briefcase className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading startups...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {!loading && !error && startups.length === 0 && (
        <div className="empty-state">
          <Briefcase className="empty-icon" strokeWidth={1.5} />
          <h3 className="empty-title">{search ? 'No results' : 'No startups found'}</h3>
          <p className="empty-description">{search ? 'Try a different search term.' : 'Be the first to add yours!'}</p>
        </div>
      )}

      {!loading && !error && startups.length > 0 && (
        <>
          <div className="grid-3" data-testid="startups-grid">
            {startups.map((startup) => (
              <Link
                key={startup.id}
                to={`/app/startups/${startup.id}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                data-testid={`startup-card-${startup.id}`}
              >
                <div style={{ fontWeight: 500, fontSize: '1rem', marginBottom: '0.25rem' }}>
                  {startup.name}
                </div>

                {startup.tagline && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'hsl(var(--muted-foreground))',
                    marginBottom: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {startup.tagline}
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: 'auto' }}>
                  {startup.industry && (
                    <span className="tag">
                      <Building2 style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                      {formatLabel(startup.industry)}
                    </span>
                  )}
                  {startup.current_stage && (
                    <span className="tag">
                      <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                      {formatLabel(startup.current_stage)}
                    </span>
                  )}
                  {startup.fundraising_status && (
                    <span className="badge warning">{formatLabel(startup.fundraising_status)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
