import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>{investor?.display_name ?? 'Investor profile'}</h1>
          <p>{investor?.headline ?? 'Investor details and focus areas.'}</p>
        </div>
        <Link className="btn ghost" to="/app/investors">
          Back to investors
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading investor...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {investor ? (
        <div className="content-card">
          <div className="detail-grid">
            <div>
              <span className="data-eyebrow">Type</span>
              <p>{investor.investor_type || 'Not specified'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Fund</span>
              <p>{investor.fund_name || 'Independent'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Check size</span>
              <p>
                {investor.check_size_min || investor.check_size_max
                  ? `$${investor.check_size_min ?? '—'} - $${investor.check_size_max ?? '—'}`
                  : 'Not specified'}
              </p>
            </div>
            <div>
              <span className="data-eyebrow">Location</span>
              <p>{investor.location || 'Not shared'}</p>
            </div>
          </div>

          {investor.industries_focus && investor.industries_focus.length > 0 ? (
            <div>
              <span className="data-eyebrow">Industries</span>
              <div className="tag-list">
                {investor.industries_focus.map((industry) => (
                  <span key={industry} className="tag">
                    {industry}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {investor.stages_focus && investor.stages_focus.length > 0 ? (
            <div>
              <span className="data-eyebrow">Stages</span>
              <div className="tag-list">
                {investor.stages_focus.map((stage) => (
                  <span key={stage} className="tag">
                    {stage}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="link-list">
            {investor.linkedin_url ? (
              <a href={investor.linkedin_url} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            ) : null}
            {investor.website_url ? (
              <a href={investor.website_url} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
