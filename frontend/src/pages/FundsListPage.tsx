import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Building2, Calendar, DollarSign } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { FundListItem } from '../types/fund'

function getDeadlineInfo(deadline: string | null | undefined): { label: string; urgent: boolean } | null {
  if (!deadline) return null
  const deadlineDate = new Date(deadline)
  const now = new Date()
  const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) return { label: 'Closed', urgent: false }
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, urgent: true }
  return { label: deadlineDate.toLocaleDateString(), urgent: false }
}

function formatTicketSize(min: number | null | undefined, max: number | null | undefined): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`
    return `$${n}`
  }
  if (min && max) return `${fmt(min)} - ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  if (max) return `Up to ${fmt(max)}`
  return null
}

export function FundsListPage() {
  const [funds, setFunds] = useState<FundListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<FundListItem[] | { results: FundListItem[] }>('/funds/')
        if (!cancelled) {
          setFunds(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load funds.')
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
    <div data-testid="funds-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Funds &amp; Opportunities
            {!loading && !error && (
              <span className="badge info" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                {funds.length}
              </span>
            )}
          </h1>
          <p className="page-description">Browse active funds and opportunities accepting applications.</p>
        </div>
        <Link className="btn-sm ghost" to="/app/applications" data-testid="view-applications-btn">
          View applications
        </Link>
      </div>

      {loading && (
        <div className="empty-state">
          <Wallet className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading funds...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {!loading && !error && funds.length === 0 && (
        <div className="empty-state">
          <Wallet className="empty-icon" strokeWidth={1.5} />
          <h3 className="empty-title">No funds available</h3>
          <p className="empty-description">Check back soon!</p>
        </div>
      )}

      {!loading && !error && funds.length > 0 && (
        <div className="grid-3" data-testid="funds-grid">
          {funds.map((fund) => {
            const deadlineInfo = getDeadlineInfo(fund.deadline)
            const ticketSize = formatTicketSize(fund.min_ticket_size, fund.max_ticket_size)

            return (
              <Link
                key={fund.id}
                to={`/app/funds/${fund.id}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                data-testid={`fund-card-${fund.id}`}
              >
                <div style={{ fontWeight: 500, fontSize: '1rem', marginBottom: '0.25rem' }}>
                  {fund.name}
                </div>

                {fund.organization && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'hsl(var(--muted-foreground))',
                    marginBottom: '0.75rem',
                  }}>
                    {fund.organization}
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                  {fund.fund_type && (
                    <span className="tag">
                      <Building2 style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                      {fund.fund_type}
                    </span>
                  )}
                  {fund.opportunity_type && (
                    <span className="tag">{fund.opportunity_type}</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {ticketSize && (
                    <span className="badge" style={{ gap: '0.25rem', display: 'inline-flex', alignItems: 'center' }}>
                      <DollarSign style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                      {ticketSize}
                    </span>
                  )}
                  {deadlineInfo && (
                    <span className={`badge ${deadlineInfo.urgent ? 'error' : ''}`} style={{ gap: '0.25rem', display: 'inline-flex', alignItems: 'center' }}>
                      <Calendar style={{ width: '0.75rem', height: '0.75rem' }} strokeWidth={1.5} />
                      {deadlineInfo.label}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
