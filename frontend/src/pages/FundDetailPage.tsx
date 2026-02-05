import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../lib/api'
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
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>{fund?.name ?? 'Fund'}</h1>
          <p>{fund?.description ?? 'Opportunity details and requirements.'}</p>
        </div>
        <Link className="btn ghost" to="/app/funds">
          Back to funds
        </Link>
      </header>

      {loading ? <div className="page-loader">Loading fund...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {fund ? (
        <div className="content-card">
          <div className="detail-grid">
            <div>
              <span className="data-eyebrow">Organization</span>
              <p>{fund.organization || '—'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Ticket size</span>
              <p>
                {fund.min_ticket_size || fund.max_ticket_size
                  ? `$${fund.min_ticket_size ?? '—'} - $${fund.max_ticket_size ?? '—'}`
                  : 'Not specified'}
              </p>
            </div>
            <div>
              <span className="data-eyebrow">Stages</span>
              <p>{fund.stages?.join(', ') || 'Not specified'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Industries</span>
              <p>{fund.industries?.join(', ') || 'Not specified'}</p>
            </div>
            <div>
              <span className="data-eyebrow">Deadline</span>
              <p>{fund.deadline ? new Date(fund.deadline).toLocaleDateString() : 'Open'}</p>
            </div>
          </div>

          {fund.posted_by ? (
            <div>
              <span className="data-eyebrow">Posted by</span>
              <p>{fund.posted_by.display_name}</p>
            </div>
          ) : null}

          {fund.tags && fund.tags.length > 0 ? (
            <div className="tag-list">
              {fund.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="link-list">
            {fund.website_url ? (
              <a href={fund.website_url} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : null}
            {fund.application_link ? (
              <a href={fund.application_link} target="_blank" rel="noreferrer">
                Apply
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
