import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Building2,
  DollarSign,
  Globe,
  Linkedin,
  ExternalLink,
  User,
  Target,
  Layers,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import type { InvestorProfile } from '../types/investor'

export function InvestorDetailPage() {
  const { id } = useParams()
  const [investor, setInvestor] = useState<InvestorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<InvestorProfile>(`/investors/${id}/`)
        if (!cancelled) {
          setInvestor(data)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load investor profile.')
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
    <div>
      <Link to="/app/investors" className="back-btn">
        <ArrowLeft style={{ width: '1rem', height: '1rem' }} strokeWidth={1.5} />
        Back to Investors
      </Link>

      {loading && (
        <div className="empty-state">
          <User className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading investor...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {investor && (
        <>
          {/* Profile Header */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div className="avatar xl">
                {investor.user?.avatar_url ? (
                  <img src={investor.user.avatar_url} alt={investor.display_name} />
                ) : (
                  getInitials(investor.display_name || 'I')
                )}
              </div>
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {investor.display_name ?? 'Investor profile'}
                </h1>
                {investor.headline && (
                  <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                    {investor.headline}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {investor.investor_type && (
                <span className="badge">{investor.investor_type}</span>
              )}
              {investor.fund_name && (
                <span className="tag">
                  <Building2 style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                  {investor.fund_name}
                </span>
              )}
              {investor.location && (
                <span className="tag">
                  <MapPin style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                  {investor.location}
                </span>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="section">
            <div className="card">
              <div className="grid-2">
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Type
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{investor.investor_type || 'Not specified'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Fund
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{investor.fund_name || 'Independent'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <DollarSign style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Check Size
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>
                    {investor.check_size_min || investor.check_size_max
                      ? `$${investor.check_size_min ?? '\u2014'} - $${investor.check_size_max ?? '\u2014'}`
                      : 'Not specified'}
                  </p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Location
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{investor.location || 'Not shared'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Industries Focus */}
          {investor.industries_focus && investor.industries_focus.length > 0 && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Target style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Industries
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {investor.industries_focus.map((industry) => (
                    <span key={industry} className="tag">
                      {industry}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stages Focus */}
          {investor.stages_focus && investor.stages_focus.length > 0 && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Stages
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {investor.stages_focus.map((stage) => (
                    <span key={stage} className="tag">
                      {stage}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Links Section */}
          {(investor.linkedin_url || investor.website_url) && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Links
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {investor.linkedin_url && (
                    <a
                      href={investor.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-sm ghost"
                    >
                      <Linkedin style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      LinkedIn
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                  {investor.website_url && (
                    <a
                      href={investor.website_url}
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
