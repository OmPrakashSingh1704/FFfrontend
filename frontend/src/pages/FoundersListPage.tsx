import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { FounderProfile } from '../types/founder'

export function FoundersListPage() {
  const [founders, setFounders] = useState<FounderProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<FounderProfile[] | { results: FounderProfile[] }>('/founders/')
        if (!cancelled) {
          setFounders(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load founders.')
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
          <h1>Founders</h1>
          <p>Browse founder profiles and reach out with context.</p>
        </div>
        <Link className="btn ghost" to="/onboarding">
          Update my profile
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading founders...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {!loading && !error ? (
        <div className="data-grid">
          {founders.map((founder) => (
            <Link key={founder.id} to={`/app/founders/${founder.id}`} className="data-card">
              <span className="data-eyebrow">Founder</span>
              <h3>{founder.user?.full_name ?? 'Founder'}</h3>
              <p>{founder.headline}</p>
              <div className="data-meta">
                {founder.location ? <span>{founder.location}</span> : null}
                {founder.current_stage ? <span>{founder.current_stage}</span> : null}
                {founder.fundraising_status ? <span>{founder.fundraising_status}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}
