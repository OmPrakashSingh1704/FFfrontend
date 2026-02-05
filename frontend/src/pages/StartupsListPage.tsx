import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Startups</h1>
          <p>Explore the startups raising on FoundersLib.</p>
        </div>
        <Link className="btn ghost" to="/onboarding">
          Add my startup
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading startups...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid">
          {startups.map((startup) => (
            <Link key={startup.id} to={`/app/startups/${startup.id}`} className="data-card">
              <span className="data-eyebrow">Startup</span>
              <h3>{startup.name}</h3>
              <p>{startup.tagline || 'No tagline provided yet.'}</p>
              <div className="data-meta">
                {startup.industry ? <span>{startup.industry}</span> : null}
                {startup.current_stage ? <span>{startup.current_stage}</span> : null}
                {startup.fundraising_status ? <span>{startup.fundraising_status}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}
