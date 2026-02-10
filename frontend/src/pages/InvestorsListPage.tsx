import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, MapPin, Building2, MessageCircle } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { normalizeList } from '../lib/pagination'
import type { InvestorProfile } from '../types/investor'

export function InvestorsListPage() {
  const [investors, setInvestors] = useState<InvestorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await apiRequest<InvestorProfile[] | { results: InvestorProfile[] }>('/investors/')
        if (!cancelled) {
          setInvestors(normalizeList(data))
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load investors.')
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

  const handleStartChat = (e: React.MouseEvent, investor: InvestorProfile) => {
    e.preventDefault()
    e.stopPropagation()
    // Navigate to chat with investor's user ID as participant
    const userId = investor.user?.id || investor.id
    navigate(`/app/chat?newChat=${userId}&name=${encodeURIComponent(investor.display_name || 'Investor')}`)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div data-testid="investors-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Investors
            {!loading && !error && (
              <span className="badge info" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                {investors.length}
              </span>
            )}
          </h1>
          <p className="page-description">Discover investors and their focus areas.</p>
        </div>
      </div>

      {loading && (
        <div className="empty-state">
          <TrendingUp className="empty-icon" strokeWidth={1.5} />
          <p className="empty-description">Loading investors...</p>
        </div>
      )}

      {error && <div className="badge error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {!loading && !error && investors.length === 0 && (
        <div className="empty-state">
          <TrendingUp className="empty-icon" strokeWidth={1.5} />
          <h3 className="empty-title">No investors found</h3>
          <p className="empty-description">Check back soon!</p>
        </div>
      )}

      {!loading && !error && investors.length > 0 && (
        <div className="grid-3" data-testid="investors-grid">
          {investors.map((investor) => {
            const name = investor.display_name || 'Investor'
            return (
              <Link
                key={investor.id}
                to={`/app/investors/${investor.id}`}
                className="card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                data-testid={`investor-card-${investor.id}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="avatar">
                    {investor.user?.avatar_url ? (
                      <img src={investor.user.avatar_url} alt={name} />
                    ) : (
                      getInitials(name)
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </div>
                    {investor.investor_type && (
                      <span className="badge" style={{ marginTop: '0.25rem' }}>{investor.investor_type}</span>
                    )}
                  </div>
                </div>

                {(investor.headline || investor.investment_thesis) && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'hsl(var(--muted-foreground))',
                    marginBottom: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {investor.headline || investor.investment_thesis}
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
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

                <hr className="divider" />

                <button
                  type="button"
                  className="btn-sm ghost"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={(e) => handleStartChat(e, investor)}
                  data-testid={`chat-investor-${investor.id}`}
                >
                  <MessageCircle style={{ width: '0.875rem', height: '0.875rem' }} strokeWidth={1.5} />
                  Start Chat
                </button>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
