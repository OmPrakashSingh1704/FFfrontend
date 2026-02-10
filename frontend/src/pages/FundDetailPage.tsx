import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Calendar,
  TrendingUp,
  Target,
  Globe,
  ExternalLink,
  User,
  Wallet,
  Send,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { Markdown } from '../components/Markdown'
import type { FundDetail } from '../types/fund'

export function FundDetailPage() {
  const { id } = useParams()
  const [fund, setFund] = useState<FundDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<FundDetail>(`/funds/${id}/`)
        if (!cancelled) {
          setFund(data)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load fund details.')
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
    <div>
      <Link to="/app/funds" className="back-btn">
        <ArrowLeft style={{ width: '1rem', height: '1rem' }} strokeWidth={1.5} />
        Back to Funds
      </Link>

      {loading && (
        <div className="empty-state">
          <Wallet className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading fund...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {fund && (
        <>
          {/* Fund Header */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {fund.name}
                </h1>
                {fund.organization && (
                  <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
                    {fund.organization}
                  </p>
                )}
                {fund.description && (
                  <Markdown>{fund.description}</Markdown>
                )}
              </div>
              {fund.application_link && (
                <a
                  href={fund.application_link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-sm primary"
                  style={{ flexShrink: 0 }}
                >
                  <Send style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Apply Now
                </a>
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
                    Organization
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{fund.organization || '\u2014'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <DollarSign style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Ticket Size
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>
                    {fund.min_ticket_size || fund.max_ticket_size
                      ? `$${fund.min_ticket_size ?? '\u2014'} - $${fund.max_ticket_size ?? '\u2014'}`
                      : 'Not specified'}
                  </p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Stages
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{fund.stages?.join(', ') || 'Not specified'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Target style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Industries
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{fund.industries?.join(', ') || 'Not specified'}</p>
                </div>
                <div>
                  <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                    Deadline
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>
                    {fund.deadline ? new Date(fund.deadline).toLocaleDateString() : 'Open'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Posted By */}
          {fund.posted_by && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Posted By
                </div>
                <p style={{ fontSize: '0.875rem' }}>{fund.posted_by.display_name}</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {fund.tags && fund.tags.length > 0 && (
            <div className="section">
              <div className="card">
                <div className="section-label">Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {fund.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Links */}
          {(fund.website_url || fund.application_link) && (
            <div className="section">
              <div className="card">
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Links
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {fund.website_url && (
                    <a href={fund.website_url} target="_blank" rel="noreferrer" className="btn-sm ghost">
                      <Globe style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Website
                      <ExternalLink style={{ width: '0.625rem', height: '0.625rem', opacity: 0.5 }} strokeWidth={1.5} />
                    </a>
                  )}
                  {fund.application_link && (
                    <a href={fund.application_link} target="_blank" rel="noreferrer" className="btn-sm primary">
                      <Send style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                      Apply
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
