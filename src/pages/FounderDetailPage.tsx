import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, TrendingUp, ExternalLink, Linkedin, Twitter, Globe, User, Briefcase, Sparkles } from 'lucide-react'
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div data-testid="founder-detail">
      <Link to="/app/founders" className="back-btn">
        <ArrowLeft style={{ width: '1rem', height: '1rem' }} strokeWidth={1.5} />
        Back to Founders
      </Link>

      {loading && (
        <div className="empty-state">
          <User className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading profile...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {founder && (
        <>
          {/* Profile Header */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div className="avatar xl">
                {founder.user?.avatar_url ? (
                  <img src={founder.user.avatar_url} alt={founder.user?.full_name ?? 'Founder'} />
                ) : (
                  getInitials(founder.user?.full_name ?? 'F')
                )}
              </div>
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {founder.user?.full_name ?? 'Founder profile'}
                </h1>
                {founder.headline && (
                  <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                    {founder.headline}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {founder.location && (
                <span className="tag">
                  <MapPin style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                  {founder.location}
                </span>
              )}
              {founder.current_stage && (
                <span className="tag">
                  <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                  {founder.current_stage}
                </span>
              )}
              {founder.fundraising_status && (
                <span className="badge warning">{founder.fundraising_status}</span>
              )}
            </div>
          </div>

          {/* Bio Section */}
          <div className="section" data-testid="founder-profile-card">
            <div className="card">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                Bio
              </div>
              <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
                {founder.bio || 'No bio provided yet.'}
              </p>
            </div>
          </div>

          {/* Details Section */}
          <div className="section">
            <div className="card">
              <div className="grid-2">
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Location
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{founder.location || 'Not shared'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Briefcase style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Fundraising Status
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{founder.fundraising_status || 'Not specified'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Stage
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{founder.current_stage || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Skills Section */}
          {founder.skills && founder.skills.length > 0 && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Skills
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {founder.skills.map((skill) => (
                    <span key={skill} className="tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Links Section */}
          {(founder.linkedin_url || founder.twitter_url || founder.website_url) && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Links
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {founder.linkedin_url && (
                    <a
                      href={founder.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-sm ghost"
                    >
                      <Linkedin style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      LinkedIn
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                  {founder.twitter_url && (
                    <a
                      href={founder.twitter_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-sm ghost"
                    >
                      <Twitter style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Twitter
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                  {founder.website_url && (
                    <a
                      href={founder.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-sm ghost"
                    >
                      <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Website
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
