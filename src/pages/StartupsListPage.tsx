import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, TrendingUp } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { StartupListItem } from '../types/startup'

export function StartupsListPage() {
  const [startups, setStartups] = useState<StartupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<StartupListItem[] | { results: StartupListItem[] }>('/founders/startups/')
        if (!cancelled) {
          setStartups(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load startups.')
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

  return (
    <div data-testid="startups-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Startups
            {!loading && !error && (
              <span className="badge info" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                {startups.length}
              </span>
            )}
          </h1>
          <p className="page-description">Explore the startups raising on FoundersLib.</p>
        </div>
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
          <h3 className="empty-title">No startups found</h3>
          <p className="empty-description">Be the first to add yours!</p>
        </div>
      )}

      {!loading && !error && startups.length > 0 && (
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
                    {startup.industry}
                  </span>
                )}
                {startup.current_stage && (
                  <span className="tag">
                    <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                    {startup.current_stage}
                  </span>
                )}
                {startup.fundraising_status && (
                  <span className="badge warning">{startup.fundraising_status}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
