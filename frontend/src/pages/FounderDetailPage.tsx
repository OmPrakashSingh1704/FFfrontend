import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import type { FounderProfile } from '../types/founder'

export function FounderDetailPage() {
  const { id } = useParams()
  const [founder, setFounder] = useState<FounderProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<FounderProfile>(`/founders/${id}/`)
        if (!cancelled) {
          setFounder(data)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load founder profile.')
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
          <h1>{founder?.user?.full_name ?? 'Founder profile'}</h1>
          <p>{founder?.headline ?? 'Founder details and background.'}</p>
        </div>
        <Link className="btn ghost" to="/app/founders">
          Back to founders
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading profile...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {founder ? (
        <div className="content-card">
          <div className="detail-grid">
            <div>
              <span className="data-eyebrow">Bio</span>
              <p>{founder.bio || 'No bio provided yet.'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Location</span>
              <p>{founder.location || 'Not shared'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Fundraising status</span>
              <p>{founder.fundraising_status || 'Not specified'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Stage</span>
              <p>{founder.current_stage || 'Not specified'}</p>
            </div>
          </div>

          {founder.skills && founder.skills.length > 0 ? (
            <div className="tag-list">
              {founder.skills.map((skill) => (
                <span key={skill} className="tag">
                  {skill}
                </span>
              ))}
            </div>
          ) : null}

          <div className="link-list">
            {founder.linkedin_url ? (
              <a href={founder.linkedin_url} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            ) : null}
            {founder.twitter_url ? (
              <a href={founder.twitter_url} target="_blank" rel="noreferrer">
                Twitter
              </a>
            ) : null}
            {founder.website_url ? (
              <a href={founder.website_url} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
