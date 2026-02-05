import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import type { StartupDetail } from '../types/startup'

export function StartupDetailPage() {
  const { id } = useParams()
  const [startup, setStartup] = useState<StartupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<StartupDetail>(`/founders/startups/${id}/`)
        if (!cancelled) {
          setStartup(data)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load startup details.')
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
  }, [id])

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>{startup?.name ?? 'Startup'}</h1>
          <p>{startup?.tagline ?? 'Startup details and metrics.'}</p>
        </div>
        <Link className="btn ghost" to="/app/startups">
          Back to startups
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading startup...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {startup ? (
        <div className="content-card">
          <div className="detail-grid">
            <div>
              <span className="data-eyebrow">Description</span>
              <p>{startup.description || 'No description yet.'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Industry</span>
              <p>{startup.industry || 'Not specified'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Stage</span>
              <p>{startup.current_stage || 'Not specified'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Fundraising status</span>
              <p>{startup.fundraising_status || 'Not specified'}</p>
            </div>
          </div>

          {startup.founders_list && startup.founders_list.length > 0 ? (
            <div>
              <span className="data-eyebrow">Founders</span>
              <div className="tag-list">
                {startup.founders_list.map((founder) => (
                  <span key={founder.id} className="tag">
                    {founder.full_name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="link-list">
            {startup.website_url ? (
              <a href={startup.website_url} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : null}
            {startup.deck_url ? (
              <a href={startup.deck_url} target="_blank" rel="noreferrer">
                Deck
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
